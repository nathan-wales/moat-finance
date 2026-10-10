import type { AppRuntime } from "@moat/runtime";
import { applyActiveRulesToTransactions } from "../services/rules-apply";

export type ApplySyncedTransactionRulesDeps = {
	getAppRuntime: () => { appCtx: AppRuntime } | Promise<{ appCtx: AppRuntime }>;
	applyRules: (
		appRuntime: AppRuntime,
		transactionIds: string[],
	) => Promise<void>;
	logError: (
		message: string,
		context: {
			event?: string;
			feature?: string;
			operation?: string;
			metadata?: Record<string, string | number | boolean>;
		},
	) => void;
};

let testAppRuntime: AppRuntime | null = null;

export function setDesktopRulesAppRuntimeForTests(
	runtime: AppRuntime | null,
): void {
	if (process.env.NODE_ENV !== "test" && process.env.MOAT_E2E !== "1") {
		throw new Error("setDesktopRulesAppRuntimeForTests is test-only");
	}
	testAppRuntime = runtime;
}

async function defaultGetAppRuntime(): Promise<{ appCtx: AppRuntime }> {
	if (testAppRuntime) {
		return { appCtx: testAppRuntime };
	}
	const { getDesktopDb } = await import("../db");
	return getDesktopDb();
}

async function defaultLogError(
	message: string,
	context: {
		event?: string;
		feature?: string;
		operation?: string;
		metadata?: Record<string, string | number | boolean>;
	},
): Promise<void> {
	const { remoteLogger } = await import("../lib/remote-logger");
	remoteLogger.error(message, context);
}

/**
 * Runs active transaction rules against rows this Plaid sync just wrote.
 * Failures are logged and swallowed so a rules error cannot unwind a
 * cursor that is already committed.
 */
export async function applyRulesAfterDesktopPlaidSync(
	transactionIds: string[],
	deps?: Partial<ApplySyncedTransactionRulesDeps>,
): Promise<void> {
	if (transactionIds.length === 0) return;

	const applyRules = deps?.applyRules ?? applyActiveRulesToTransactions;
	const getAppRuntime = deps?.getAppRuntime ?? defaultGetAppRuntime;
	const logError = deps?.logError ?? defaultLogError;

	try {
		const { appCtx } = await Promise.resolve(getAppRuntime());
		await applyRules(appCtx, transactionIds);
	} catch (error) {
		logError("Desktop Plaid sync rules failed after persist", {
			event: "desktop.plaid_sync.rules_failed",
			feature: "plaid",
			operation: "applyRules",
			metadata: {
				transactionCount: transactionIds.length,
				errorMessage: error instanceof Error ? error.message : "unknown",
			},
		});
	}
}
