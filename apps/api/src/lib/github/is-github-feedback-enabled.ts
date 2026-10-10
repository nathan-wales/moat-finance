function getGitHubFeedbackCredentials():
	| { owner: string; repo: string; token: string }
	| undefined {
	const token = process.env.GITHUB_FEEDBACK_TOKEN;
	const owner =
		process.env.GITHUB_FEEDBACK_OWNER ?? process.env.GITHUB_FEEDBACK_REPO_OWNER;
	const repo =
		process.env.GITHUB_FEEDBACK_REPO ?? process.env.GITHUB_FEEDBACK_REPO_NAME;

	if (!token || !owner || !repo) {
		return undefined;
	}

	return { token, owner, repo };
}

export function isGitHubFeedbackEnabled(): boolean {
	if (process.env.GITHUB_FEEDBACK_ENABLED !== "true") {
		return false;
	}

	return getGitHubFeedbackCredentials() !== undefined;
}

export function getGitHubFeedbackConfig(): {
	owner: string;
	repo: string;
	token: string;
	labels: string[];
} {
	const credentials = getGitHubFeedbackCredentials();
	if (!credentials) {
		throw new Error("GitHub feedback integration is not configured");
	}

	const configuredLabels = process.env.GITHUB_FEEDBACK_LABELS?.split(",")
		.map((label) => label.trim())
		.filter((label) => label.length > 0);

	return {
		...credentials,
		labels: configuredLabels ?? ["feedback"],
	};
}
