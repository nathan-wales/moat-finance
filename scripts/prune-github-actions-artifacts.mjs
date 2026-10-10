#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const retentionBuilds = Number.parseInt(
	process.env.ARTIFACT_RETENTION_BUILDS ?? "2",
	10,
);
const nameSuffix = process.env.ARTIFACT_NAME_SUFFIX ?? "-artifacts";

if (!token) {
	console.error("GITHUB_TOKEN or GH_TOKEN is required.");
	process.exit(1);
}

if (!repository) {
	console.error("GITHUB_REPOSITORY is required (owner/repo).");
	process.exit(1);
}

if (!Number.isFinite(retentionBuilds) || retentionBuilds < 0) {
	console.error("ARTIFACT_RETENTION_BUILDS must be a non-negative integer.");
	process.exit(1);
}

const apiBase = `https://api.github.com/repos/${repository}`;

async function githubRequest(path, options = {}) {
	const response = await fetch(`${apiBase}${path}`, {
		...options,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"X-GitHub-Api-Version": "2022-11-28",
			...options.headers,
		},
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`GitHub API ${options.method ?? "GET"} ${path} failed (${response.status}): ${body}`,
		);
	}

	if (response.status === 204) {
		return null;
	}

	return response.json();
}

async function listArtifacts() {
	const artifacts = [];
	let page = 1;

	while (true) {
		const payload = await githubRequest(
			`/actions/artifacts?per_page=100&page=${page}`,
		);
		artifacts.push(...payload.artifacts);
		if (payload.artifacts.length < 100) {
			break;
		}
		page += 1;
	}

	return artifacts.filter((artifact) => artifact.name.endsWith(nameSuffix));
}

function groupArtifactsByRun(artifacts) {
	const runs = new Map();

	for (const artifact of artifacts) {
		const runId = artifact.workflow_run?.id;
		if (!runId) {
			continue;
		}

		const existing = runs.get(runId);
		if (!existing) {
			runs.set(runId, {
				runId,
				artifacts: [artifact],
				latestCreatedAt: artifact.created_at,
			});
			continue;
		}

		existing.artifacts.push(artifact);
		if (artifact.created_at > existing.latestCreatedAt) {
			existing.latestCreatedAt = artifact.created_at;
		}
	}

	return [...runs.values()].sort((left, right) =>
		right.latestCreatedAt.localeCompare(left.latestCreatedAt),
	);
}

async function deleteArtifact(artifact) {
	await githubRequest(`/actions/artifacts/${artifact.id}`, {
		method: "DELETE",
	});
}

const artifacts = await listArtifacts();
if (artifacts.length === 0) {
	console.log(`No artifacts matching *${nameSuffix} found.`);
	process.exit(0);
}

const runs = groupArtifactsByRun(artifacts);
const keptRuns = runs.slice(0, retentionBuilds);
const keptRunIds = new Set(keptRuns.map((run) => run.runId));
const artifactsToDelete = artifacts.filter((artifact) => {
	const runId = artifact.workflow_run?.id;
	return runId && !keptRunIds.has(runId);
});

console.log(
	`Found ${artifacts.length} artifact(s) across ${runs.length} workflow run(s).`,
);
console.log(`Keeping the newest ${keptRuns.length} run(s):`);
for (const run of keptRuns) {
	const sizeMb =
		run.artifacts.reduce(
			(total, artifact) => total + (artifact.size_in_bytes ?? 0),
			0,
		) / (1024 * 1024);
	console.log(
		`  run ${run.runId} (${run.artifacts.length} artifact(s), ${sizeMb.toFixed(1)} MB)`,
	);
}

if (artifactsToDelete.length === 0) {
	console.log("No artifacts to delete.");
	process.exit(0);
}

console.log(`Deleting ${artifactsToDelete.length} artifact(s)...`);
for (const artifact of artifactsToDelete) {
	console.log(
		`  delete ${artifact.name} (id=${artifact.id}, run=${artifact.workflow_run?.id ?? "unknown"})`,
	);
	await deleteArtifact(artifact);
}

console.log("Artifact cleanup complete.");
