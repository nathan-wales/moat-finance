import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { taxLlmInlineWaitOutcome } from "./inline-wait";

describe("taxLlmInlineWaitOutcome", () => {
	it("completes when the job is COMPLETED", () => {
		assert.equal(
			taxLlmInlineWaitOutcome({ status: "COMPLETED", lastErrorCode: null }),
			"completed",
		);
	});

	it("stops waiting once the job has failed", () => {
		assert.equal(
			taxLlmInlineWaitOutcome({ status: "FAILED", lastErrorCode: null }),
			"failed",
		);
		assert.equal(
			taxLlmInlineWaitOutcome({
				status: "QUEUED",
				lastErrorCode: "WORKER_UNAVAILABLE",
			}),
			"failed",
		);
		assert.equal(
			taxLlmInlineWaitOutcome({
				status: "PROCESSING",
				lastErrorCode: "MODEL_INVALID_JSON",
			}),
			"failed",
		);
		assert.equal(
			taxLlmInlineWaitOutcome({ status: "missing", lastErrorCode: null }),
			"failed",
		);
	});

	it("keeps waiting while the model is still starting", () => {
		assert.equal(
			taxLlmInlineWaitOutcome({
				status: "PROCESSING",
				lastErrorCode: "MODEL_STARTING",
			}),
			"wait",
		);
		assert.equal(
			taxLlmInlineWaitOutcome({ status: "QUEUED", lastErrorCode: null }),
			"wait",
		);
	});
});
