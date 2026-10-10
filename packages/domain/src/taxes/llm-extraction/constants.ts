export const TAX_LLM_PROVIDER = "self-hosted" as const;
export const TAX_LLM_MODEL = "Qwen/Qwen3-8B";
export const TAX_LLM_MODEL_REVISION =
	"b968826d9c46dd6066d109eabc6255188de91218";
export const TAX_LLM_INFERENCE_SERVER = "vllm";
export const TAX_LLM_SERVED_MODEL_NAME = "qwen3-8b-tax";
export const TAX_LLM_DOCUMENT_TYPE_W2 = "W2" as const;
export const TAX_LLM_IDLE_MS = 120_000;
export const TAX_LLM_INLINE_WAIT_MS = 360_000;
export const TAX_DOCUMENT_PARSE_CLIENT_TIMEOUT_MS = 480_000;
export const TAX_LLM_MAX_ATTEMPTS = 5;
export const TAX_LLM_PUBSUB_MAX_ENCODED_BYTES = 5_000_000;
export const TAX_LLM_DEFAULT_KEY_VERSION = "v1";
export const TAX_LLM_WATCHDOG_DELAYS_SECONDS = [30, 90] as const;
export const TAX_LLM_WATCHDOG_START_WINDOW_MS = 180_000;

export const TAX_LLM_ERROR_CODES = [
	"MODEL_STARTING",
	"MODEL_TIMEOUT",
	"MODEL_INVALID_JSON",
	"SCHEMA_VALIDATION_FAILED",
	"IDENTIFIER_VALIDATION_FAILED",
	"PERSISTENCE_FAILED",
	"DECRYPTION_FAILED",
	"MESSAGE_TOO_LARGE",
	"WORKER_UNAVAILABLE",
] as const;

export type TaxLlmErrorCode = (typeof TAX_LLM_ERROR_CODES)[number];

export const TAX_LLM_JOB_STATUSES = [
	"QUEUED",
	"PROCESSING",
	"COMPLETED",
	"FAILED",
] as const;

export type TaxLlmJobStatus = (typeof TAX_LLM_JOB_STATUSES)[number];
