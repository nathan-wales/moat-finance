import { createServer } from "node:http";
import { PubSub } from "@google-cloud/pubsub";
import { CloudTasksClient } from "@google-cloud/tasks";
import {
	parseTaxLlmQueueMessage,
	TAX_LLM_WATCHDOG_DELAYS_SECONDS,
} from "@moat/domain";
import { GoogleAuth } from "google-auth-library";
import { ALLOWED_CONTROLLER_ACTIONS, taxLlmConfig } from "../config";
import { taxLlmLog, taxLlmWarn } from "../safe-log";
import { assertControllerAuth, readJson } from "./auth";
import { ensureTaxLlmWorkerRunning } from "./ensure-running";

const pubsub = new PubSub();
const tasks = new CloudTasksClient();

async function publishExtractionMessage(message: unknown): Promise<void> {
	const parsed = parseTaxLlmQueueMessage(message);
	const config = taxLlmConfig();
	await pubsub.topic(config.topic).publishMessage({
		json: parsed,
		attributes: {
			version: "1",
			documentType: parsed.documentType,
		},
	});
}

async function scheduleWatchdogs(): Promise<void> {
	const config = taxLlmConfig();
	const parent = tasks.queuePath(
		config.projectId,
		config.tasksLocation,
		config.tasksQueue,
	);
	const url = process.env.TAX_LLM_CONTROLLER_URL?.replace(/\/$/, "");
	const tasksSa = process.env.TAX_LLM_TASKS_SA?.trim();
	if (!url || !tasksSa) return;
	const nowMs = Date.now();
	const nowSeconds = Math.floor(nowMs / 1000);
	const body = Buffer.from(
		JSON.stringify({
			action: "ensure-tax-llm-worker-running",
			source: "watchdog",
			enqueuedAtMs: nowMs,
		}),
	).toString("base64");
	for (const delay of TAX_LLM_WATCHDOG_DELAYS_SECONDS) {
		await tasks.createTask({
			parent,
			task: {
				scheduleTime: { seconds: nowSeconds + delay },
				httpRequest: {
					httpMethod: "POST",
					url: `${url}/v1/ensure-running`,
					headers: { "content-type": "application/json" },
					body,
					oidcToken: {
						serviceAccountEmail: tasksSa,
						audience: url,
					},
				},
			},
		});
	}
}

async function forwardToMoat(
	path: string,
	body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const config = taxLlmConfig();
	const auth = new GoogleAuth();
	const client = await auth.getIdTokenClient(config.moatApiUrl);
	const response = await client.request({
		url: `${config.moatApiUrl}${path}`,
		method: "POST",
		data: body,
	});
	return (response.data ?? {}) as Record<string, unknown>;
}

const server = createServer(async (req, res) => {
	res.setHeader("content-type", "application/json");
	try {
		const url = new URL(req.url ?? "/", "http://127.0.0.1");
		if (req.method === "GET" && url.pathname === "/health") {
			res.end(JSON.stringify({ ok: true }));
			return;
		}

		const audience =
			process.env.TAX_LLM_CONTROLLER_URL?.replace(/\/$/, "") ?? "";
		if (!(await assertControllerAuth(req, res, audience))) return;

		if (req.method === "POST" && url.pathname === "/v1/ensure-running") {
			const body = (await readJson(req)) as {
				action?: string;
				source?: string;
				enqueuedAtMs?: unknown;
			};
			if (!body.action || !ALLOWED_CONTROLLER_ACTIONS.has(body.action)) {
				res.statusCode = 400;
				res.end(JSON.stringify({ error: "Invalid action" }));
				return;
			}
			const result = await ensureTaxLlmWorkerRunning({
				requireRecentEnqueue: body.source === "watchdog",
				enqueuedAtMs: body.enqueuedAtMs,
			});
			res.end(JSON.stringify(result));
			return;
		}

		if (req.method === "POST" && url.pathname === "/v1/enqueue") {
			const body = (await readJson(req)) as { message?: unknown };
			try {
				await ensureTaxLlmWorkerRunning();
			} catch (error) {
				taxLlmWarn("ensure_running_failed", {
					operation: "ensureTaxLlmWorkerRunning",
					errorName: error instanceof Error ? error.name : "unknown",
				});
				res.statusCode = 503;
				res.end(JSON.stringify({ error: "Worker unavailable" }));
				return;
			}
			await publishExtractionMessage(body.message);
			try {
				await scheduleWatchdogs();
			} catch (error) {
				taxLlmWarn("watchdog_schedule_failed", {
					operation: "scheduleWatchdogs",
					errorName: error instanceof Error ? error.name : "unknown",
				});
			}
			taxLlmLog("enqueue accepted");
			res.end(JSON.stringify({ status: "queued" }));
			return;
		}

		if (req.method === "POST" && url.pathname === "/v1/claim") {
			const body = (await readJson(req)) as { jobId?: string };
			const result = await forwardToMoat("/api/internal/tax-llm/claim", {
				jobId: body.jobId,
			});
			res.end(JSON.stringify(result));
			return;
		}

		if (req.method === "POST" && url.pathname === "/v1/fail") {
			const body = (await readJson(req)) as Record<string, unknown>;
			const result = await forwardToMoat("/api/internal/tax-llm/fail", body);
			res.end(JSON.stringify(result));
			return;
		}

		if (req.method === "POST" && url.pathname === "/v1/persist") {
			const body = (await readJson(req)) as { envelope?: unknown };
			const result = await forwardToMoat("/api/internal/tax-llm/result", {
				envelope: body.envelope,
			});
			taxLlmLog("job completed", {
				status: typeof result.status === "string" ? result.status : "ok",
			});
			res.end(JSON.stringify(result));
			return;
		}

		res.statusCode = 404;
		res.end(JSON.stringify({ error: "Not found" }));
	} catch (error) {
		taxLlmWarn("controller_failed", {
			operation: req.url ?? "unknown",
			errorName: error instanceof Error ? error.name : "unknown",
		});
		res.statusCode = 500;
		res.end(JSON.stringify({ error: "Internal server error" }));
	}
});

const port = Number(process.env.PORT ?? 8080);
server.listen(port, "0.0.0.0", () => {
	taxLlmLog("worker starting", { operation: "controller" });
});
