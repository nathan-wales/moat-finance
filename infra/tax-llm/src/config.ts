export function requiredEnv(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is required`);
	}
	return value;
}

export function taxLlmConfig() {
	return {
		projectId: requiredEnv("GCP_PROJECT_ID"),
		zone: requiredEnv("TAX_LLM_ZONE"),
		instanceName:
			process.env.TAX_LLM_INSTANCE_NAME?.trim() || "moat-tax-llm-worker",
		topic: process.env.TAX_LLM_TOPIC?.trim() || "moat-tax-llm-extraction",
		subscription:
			process.env.TAX_LLM_SUBSCRIPTION?.trim() ||
			"moat-tax-llm-extraction-worker",
		resultsTopic:
			process.env.TAX_LLM_RESULTS_TOPIC?.trim() || "moat-tax-llm-results",
		tasksQueue:
			process.env.TAX_LLM_TASKS_QUEUE?.trim() || "moat-tax-llm-watchdog",
		tasksLocation: process.env.GCP_REGION?.trim() || "us-central1",
		moatApiUrl: requiredEnv("MOAT_API_URL").replace(/\/$/, ""),
		vllmUrl: process.env.VLLM_URL?.trim() || "http://127.0.0.1:8000",
		secretName:
			process.env.TAX_LLM_SECRET_NAME?.trim() || "tax-llm-encryption-key-v1",
		keyVersion: process.env.TAX_LLM_ENCRYPTION_KEY_VERSION?.trim() || "v1",
	};
}

export const ALLOWED_CONTROLLER_ACTIONS = new Set([
	"ensure-tax-llm-worker-running",
]);
