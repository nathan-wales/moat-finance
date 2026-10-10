import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TAX_LLM_IDLE_MS, TAX_LLM_WATCHDOG_START_WINDOW_MS } from "./constants";
import {
	createIdleDeadline,
	decideEnsureWorkerAction,
	isAcceptedStopStatus,
	isIdle,
	shouldStartAfterEnsure,
} from "./vm-lifecycle";

describe("worker lifecycle helpers", () => {
	it("starts terminated instances and ignores running ones", () => {
		assert.equal(decideEnsureWorkerAction("TERMINATED").action, "start");
		assert.equal(decideEnsureWorkerAction("RUNNING").action, "noop");
		assert.equal(decideEnsureWorkerAction("PROVISIONING").action, "noop");
		assert.equal(
			decideEnsureWorkerAction("STOPPING").action,
			"wait-then-start",
		);
	});

	it("treats idle as 120s after the last in-flight work", () => {
		const started = 1_000;
		const deadline = createIdleDeadline(started, TAX_LLM_IDLE_MS);
		assert.equal(
			isIdle({
				nowMs: started + 119_999,
				idleDeadlineMs: deadline,
				inFlightCount: 0,
			}),
			false,
		);
		assert.equal(
			isIdle({
				nowMs: started + 120_000,
				idleDeadlineMs: deadline,
				inFlightCount: 0,
			}),
			true,
		);
		assert.equal(
			isIdle({
				nowMs: started + 180_000,
				idleDeadlineMs: deadline,
				inFlightCount: 1,
			}),
			false,
		);
	});

	it("treats STOPPING and TERMINATED as a successful stop request", () => {
		assert.equal(isAcceptedStopStatus("STOPPING"), true);
		assert.equal(isAcceptedStopStatus("TERMINATED"), true);
		assert.equal(isAcceptedStopStatus("RUNNING"), false);
	});

	it("does not let a late watchdog start a stopped VM", () => {
		const enqueuedAtMs = 1_000;
		assert.equal(
			shouldStartAfterEnsure({
				action: "start",
				requireRecentEnqueue: false,
				enqueuedAtMs: null,
				nowMs: enqueuedAtMs + 60_000,
				windowMs: TAX_LLM_WATCHDOG_START_WINDOW_MS,
			}),
			true,
		);
		assert.equal(
			shouldStartAfterEnsure({
				action: "start",
				requireRecentEnqueue: true,
				enqueuedAtMs,
				nowMs: enqueuedAtMs + 90_000,
				windowMs: TAX_LLM_WATCHDOG_START_WINDOW_MS,
			}),
			true,
		);
		assert.equal(
			shouldStartAfterEnsure({
				action: "start",
				requireRecentEnqueue: true,
				enqueuedAtMs,
				nowMs: enqueuedAtMs + TAX_LLM_WATCHDOG_START_WINDOW_MS + 1,
				windowMs: TAX_LLM_WATCHDOG_START_WINDOW_MS,
			}),
			false,
		);
		assert.equal(
			shouldStartAfterEnsure({
				action: "start",
				requireRecentEnqueue: true,
				enqueuedAtMs: null,
				nowMs: enqueuedAtMs,
				windowMs: TAX_LLM_WATCHDOG_START_WINDOW_MS,
			}),
			false,
		);
		assert.equal(
			shouldStartAfterEnsure({
				action: "wait-then-start",
				requireRecentEnqueue: true,
				enqueuedAtMs,
				nowMs: enqueuedAtMs + 30_000,
				windowMs: TAX_LLM_WATCHDOG_START_WINDOW_MS,
			}),
			false,
		);
	});
});
