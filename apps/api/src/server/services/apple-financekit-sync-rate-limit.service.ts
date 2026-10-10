import { createApiError } from "~/server/api-context";
import { checkFixedWindowRateLimit } from "./fixed-window-rate-limit.service";

const WINDOW_MS = 10 * 60 * 1000;

/**
 * A single Apple Wallet sync fans out into one request per 500-transaction chunk per account, so
 * the import ceiling has to clear a full backfill (20 accounts x 5000 rows) while still stopping a
 * client stuck in a retry loop. Automatic foreground sync makes this worth enforcing — the
 * endpoints were previously unthrottled.
 */
const IMPORT_LIMIT_PER_WINDOW = 240;
const ACCOUNT_UPSERT_LIMIT_PER_WINDOW = 20;

export function assertAppleFinanceKitImportRateLimit(userId: string): void {
	assertWithinLimit({
		userId,
		operation: "bulkImportTransactions",
		limit: IMPORT_LIMIT_PER_WINDOW,
	});
}

export function assertAppleFinanceKitAccountUpsertRateLimit(
	userId: string,
): void {
	assertWithinLimit({
		userId,
		operation: "upsertAccounts",
		limit: ACCOUNT_UPSERT_LIMIT_PER_WINDOW,
	});
}

function assertWithinLimit(input: {
	userId: string;
	operation: string;
	limit: number;
}): void {
	const result = checkFixedWindowRateLimit({
		key: `apple-financekit:${input.operation}:${input.userId}`,
		limit: input.limit,
		windowMs: WINDOW_MS,
	});

	if (result.allowed) return;

	const retryAfterSeconds = Math.max(
		1,
		Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
	);
	const error = createApiError(
		"Apple Wallet sync rate limit reached. Try again shortly.",
		429,
	);
	(error as Error & { retryAfterSeconds?: number }).retryAfterSeconds =
		retryAfterSeconds;
	throw error;
}
