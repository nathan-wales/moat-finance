import { createServer, type IncomingMessage, type Server } from "node:http";
import {
	GOLDEN_ACCESS_TOKEN,
	GOLDEN_INSTITUTION_ID,
	GOLDEN_INSTITUTION_NAME,
	GOLDEN_ITEM_ID,
	GOLDEN_LEDGER,
	GOLDEN_LINK_TOKEN,
	GOLDEN_PUBLIC_TOKEN,
} from "./ledger";
import type { GoldenPlaidAccount, GoldenPlaidTransaction } from "./plaid-shape";
import {
	RECONNECT_ACCESS_TOKEN_A,
	RECONNECT_ACCESS_TOKEN_B,
	RECONNECT_CURSOR_A,
	RECONNECT_CURSOR_B,
	RECONNECT_INSTITUTION_ID,
	RECONNECT_INSTITUTION_NAME,
	RECONNECT_ITEM_ID_A,
	RECONNECT_ITEM_ID_B,
	RECONNECT_LEDGER,
	RECONNECT_PUBLIC_TOKEN_A,
	RECONNECT_PUBLIC_TOKEN_B,
	RECONNECT_VARIATION_B_NEW_ACCOUNT,
} from "./reconnect-ledger";
import {
	createGoldenWebhookSigner,
	type GoldenWebhookSigner,
} from "./webhook-signing";

export type GoldenPlaidMockPlatform = "web" | "desktop";

export const GOLDEN_PLAID_MOCK_PORT = 18080;

export type GoldenPlaidMockCall = {
	path: string;
	body: Record<string, unknown>;
};

type SyncPage = {
	added: GoldenPlaidTransaction[];
	modified: GoldenPlaidTransaction[];
	removed: Array<{ transaction_id: string }>;
	nextCursor: string;
	hasMore: boolean;
	status: string;
};

const INITIAL_DONE = "golden-cursor-initial-done";
const HISTORICAL_DONE = "golden-cursor-historical-done";
const MUTATION_DONE = "golden-cursor-mutation-done";

const TOKEN_EXCHANGE: Record<string, { accessToken: string; itemId: string }> =
	{
		[GOLDEN_PUBLIC_TOKEN]: {
			accessToken: GOLDEN_ACCESS_TOKEN,
			itemId: GOLDEN_ITEM_ID,
		},
		[RECONNECT_PUBLIC_TOKEN_A]: {
			accessToken: RECONNECT_ACCESS_TOKEN_A,
			itemId: RECONNECT_ITEM_ID_A,
		},
		[RECONNECT_PUBLIC_TOKEN_B]: {
			accessToken: RECONNECT_ACCESS_TOKEN_B,
			itemId: RECONNECT_ITEM_ID_B,
		},
	};

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => {
			chunks.push(chunk);
		});
		req.on("end", () => {
			const raw = Buffer.concat(chunks).toString("utf8");
			if (!raw) {
				resolve({});
				return;
			}
			try {
				resolve(JSON.parse(raw) as Record<string, unknown>);
			} catch (error) {
				reject(error);
			}
		});
		req.on("error", reject);
	});
}

function plaidError(
	code: string,
	message: string,
): { error_code: string; error_message: string; error_type: string } {
	return {
		error_type: "ITEM_ERROR",
		error_code: code,
		error_message: message,
	};
}

function buildInitialPages(): SyncPage[] {
	const pages = GOLDEN_LEDGER.initialPages;
	return pages.map((added, index) => {
		const isLast = index === pages.length - 1;
		return {
			added,
			modified: [],
			removed: [],
			nextCursor: isLast ? INITIAL_DONE : `golden-cursor-initial-${index + 1}`,
			hasMore: !isLast,
			status: "INITIAL_UPDATE_COMPLETE",
		};
	});
}

function buildHistoricalPages(): SyncPage[] {
	const pages = GOLDEN_LEDGER.historicalPages;
	return pages.map((added, index) => {
		const isLast = index === pages.length - 1;
		return {
			added,
			modified: isLast ? GOLDEN_LEDGER.historicalModified : [],
			removed: isLast ? GOLDEN_LEDGER.historicalRemoved : [],
			nextCursor: isLast
				? HISTORICAL_DONE
				: `golden-cursor-historical-${index + 1}`,
			hasMore: !isLast,
			status: "INITIAL_UPDATE_COMPLETE",
		};
	});
}

export type GoldenPlaidMockController = {
	baseUrl: string;
	signer: GoldenWebhookSigner;
	calls: GoldenPlaidMockCall[];
	linkTokenHadWebhook: boolean | null;
	enableHistoricalPages: () => void;
	setHistoricalUpdateComplete: () => void;
	enableMutationPages: () => void;
	armMutationDuringPagination: () => void;
	replayNextSyncPage: () => void;
	markItemRemoved: (accessToken?: string) => void;
	setReconnectItemBIncludesNewAccount: (enabled: boolean) => void;
	exchangeCallCount: () => number;
	close: () => Promise<void>;
};

export async function startGoldenPlaidMock(options: {
	platform: GoldenPlaidMockPlatform;
	port?: number;
}): Promise<GoldenPlaidMockController> {
	const signer = createGoldenWebhookSigner();
	const calls: GoldenPlaidMockCall[] = [];
	let linkTokenHadWebhook: boolean | null = null;
	let productNotReadyRemaining = options.platform === "desktop" ? 1 : 0;
	let historicalEnabled = options.platform === "desktop";
	let historicalComplete = false;
	let mutationEnabled = false;
	let itemRemoved = false;
	let reconnectItemBIncludesNewAccount = false;
	const removedAccessTokens = new Set<string>();
	let replayNextPage = false;
	let failNextSyncWithMutation = false;
	let lastSyncBody: Record<string, unknown> | null = null;

	function accessTokenFrom(body: Record<string, unknown>): string {
		return String(body.access_token ?? "");
	}

	function isReconnectAccessToken(token: string): boolean {
		return (
			token === RECONNECT_ACCESS_TOKEN_A || token === RECONNECT_ACCESS_TOKEN_B
		);
	}

	function isAccessRemoved(token: string): boolean {
		if (token && removedAccessTokens.has(token)) return true;
		if (itemRemoved && !isReconnectAccessToken(token)) return true;
		return false;
	}

	function reconnectAccountsFor(token: string): GoldenPlaidAccount[] {
		if (token === RECONNECT_ACCESS_TOKEN_A) {
			return RECONNECT_LEDGER.itemA.accounts;
		}
		if (reconnectItemBIncludesNewAccount) {
			return RECONNECT_LEDGER.variationBAccounts;
		}
		return RECONNECT_LEDGER.itemB.accounts;
	}

	function reconnectTransactionsFor(token: string): GoldenPlaidTransaction[] {
		if (token === RECONNECT_ACCESS_TOKEN_A) {
			return RECONNECT_LEDGER.itemA.transactions;
		}
		return [
			...RECONNECT_LEDGER.itemB.overlapTransactions,
			...RECONNECT_LEDGER.itemB.newerTransactions,
		];
	}

	function reconnectItemIdFor(token: string): string {
		return token === RECONNECT_ACCESS_TOKEN_A
			? RECONNECT_ITEM_ID_A
			: RECONNECT_ITEM_ID_B;
	}

	function reconnectDoneCursor(token: string): string {
		return token === RECONNECT_ACCESS_TOKEN_A
			? RECONNECT_CURSOR_A
			: RECONNECT_CURSOR_B;
	}

	function resolveReconnectSync(
		token: string,
		cursor: string | null,
	): Record<string, unknown> {
		const doneCursor = reconnectDoneCursor(token);
		if (cursor === doneCursor) {
			return emptySync(doneCursor, "HISTORICAL_UPDATE_COMPLETE");
		}
		return {
			added: reconnectTransactionsFor(token),
			modified: [],
			removed: [],
			next_cursor: doneCursor,
			has_more: false,
			request_id: "golden-request",
			transactions_update_status: "HISTORICAL_UPDATE_COMPLETE",
		};
	}

	const initialPages = buildInitialPages();
	const historicalPages = buildHistoricalPages();

	function syncResponse(page: SyncPage, statusOverride?: string) {
		return {
			added: page.added,
			modified: page.modified,
			removed: page.removed,
			next_cursor: page.nextCursor,
			has_more: page.hasMore,
			request_id: "golden-request",
			transactions_update_status: statusOverride ?? page.status,
		};
	}

	function emptySync(cursor: string, status: string) {
		return {
			added: [],
			modified: [],
			removed: [],
			next_cursor: cursor,
			has_more: false,
			request_id: "golden-request",
			transactions_update_status: status,
		};
	}

	function resolveSync(
		cursor: string | null,
		count: number | null,
		accessToken: string,
	): Record<string, unknown> {
		if (isAccessRemoved(accessToken)) {
			throw Object.assign(new Error("ITEM_NOT_FOUND"), { httpStatus: 400 });
		}
		if (isReconnectAccessToken(accessToken)) {
			return resolveReconnectSync(accessToken, cursor);
		}
		// Status probes use count: 1. Keep the one-shot mutation armed for the
		// real paginated sync (count: 500) so overlay polling cannot consume it.
		if (failNextSyncWithMutation && count !== 1) {
			failNextSyncWithMutation = false;
			throw Object.assign(
				new Error("TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"),
				{ httpStatus: 400 },
			);
		}
		if (replayNextPage && lastSyncBody) {
			replayNextPage = false;
			return lastSyncBody;
		}
		if (productNotReadyRemaining > 0 && !cursor) {
			productNotReadyRemaining -= 1;
			return emptySync("", "NOT_READY");
		}

		if (
			mutationEnabled &&
			(cursor === HISTORICAL_DONE || cursor === MUTATION_DONE)
		) {
			const page: SyncPage = {
				added: GOLDEN_LEDGER.mutationAdded,
				modified: GOLDEN_LEDGER.mutationModified,
				removed: GOLDEN_LEDGER.mutationRemoved,
				nextCursor: MUTATION_DONE,
				hasMore: false,
				status: "HISTORICAL_UPDATE_COMPLETE",
			};
			if (cursor === MUTATION_DONE) {
				return emptySync(MUTATION_DONE, "HISTORICAL_UPDATE_COMPLETE");
			}
			return syncResponse(page);
		}

		if (!cursor || cursor.startsWith("golden-cursor-initial-")) {
			if (cursor === INITIAL_DONE) {
				if (historicalEnabled) {
					const first = historicalPages[0];
					if (!first) {
						return emptySync(
							HISTORICAL_DONE,
							historicalComplete
								? "HISTORICAL_UPDATE_COMPLETE"
								: "INITIAL_UPDATE_COMPLETE",
						);
					}
					return syncResponse(
						first,
						historicalComplete ? "HISTORICAL_UPDATE_COMPLETE" : first.status,
					);
				}
				return emptySync(
					INITIAL_DONE,
					historicalComplete
						? "HISTORICAL_UPDATE_COMPLETE"
						: "INITIAL_UPDATE_COMPLETE",
				);
			}
			const pageIndex = cursor
				? Number(cursor.replace("golden-cursor-initial-", ""))
				: 0;
			const page = initialPages[pageIndex] ?? initialPages[0];
			if (!page) {
				return emptySync(INITIAL_DONE, "INITIAL_UPDATE_COMPLETE");
			}
			return syncResponse(page);
		}

		if (
			cursor.startsWith("golden-cursor-historical-") ||
			cursor === HISTORICAL_DONE
		) {
			if (cursor === HISTORICAL_DONE) {
				return emptySync(
					HISTORICAL_DONE,
					historicalComplete
						? "HISTORICAL_UPDATE_COMPLETE"
						: "INITIAL_UPDATE_COMPLETE",
				);
			}
			const pageIndex = Number(cursor.replace("golden-cursor-historical-", ""));
			const page = historicalPages[pageIndex];
			if (!page) {
				return emptySync(
					HISTORICAL_DONE,
					historicalComplete
						? "HISTORICAL_UPDATE_COMPLETE"
						: "INITIAL_UPDATE_COMPLETE",
				);
			}
			return syncResponse(
				page,
				historicalComplete ? "HISTORICAL_UPDATE_COMPLETE" : page.status,
			);
		}

		return emptySync(cursor, "TRANSACTIONS_UPDATE_STATUS_UNKNOWN");
	}

	function handle(
		path: string,
		body: Record<string, unknown>,
	): {
		status: number;
		payload: Record<string, unknown>;
	} {
		calls.push({ path, body });
		if (path === "/link/token/create") {
			linkTokenHadWebhook = typeof body.webhook === "string";
			return {
				status: 200,
				payload: {
					link_token: GOLDEN_LINK_TOKEN,
					expiration: "2099-01-01T00:00:00Z",
					request_id: "golden-request",
				},
			};
		}
		if (path === "/item/public_token/exchange") {
			const publicToken = String(body.public_token ?? "");
			const mapped = TOKEN_EXCHANGE[publicToken];
			if (!mapped) {
				return {
					status: 400,
					payload: plaidError("INVALID_PUBLIC_TOKEN", "Unknown public token"),
				};
			}
			return {
				status: 200,
				payload: {
					access_token: mapped.accessToken,
					item_id: mapped.itemId,
					request_id: "golden-request",
				},
			};
		}
		if (path === "/accounts/get" || path === "/accounts/balance/get") {
			const token = accessTokenFrom(body);
			if (isAccessRemoved(token)) {
				return {
					status: 400,
					payload: plaidError("ITEM_NOT_FOUND", "ITEM_NOT_FOUND"),
				};
			}
			const reconnect = isReconnectAccessToken(token);
			return {
				status: 200,
				payload: {
					accounts: reconnect
						? reconnectAccountsFor(token)
						: GOLDEN_LEDGER.accounts,
					item: {
						item_id: reconnect ? reconnectItemIdFor(token) : GOLDEN_ITEM_ID,
						institution_id: reconnect
							? RECONNECT_INSTITUTION_ID
							: GOLDEN_INSTITUTION_ID,
					},
					request_id: "golden-request",
				},
			};
		}
		if (path === "/item/get") {
			const token = accessTokenFrom(body);
			if (isAccessRemoved(token)) {
				return {
					status: 400,
					payload: plaidError("ITEM_NOT_FOUND", "ITEM_NOT_FOUND"),
				};
			}
			const reconnect = isReconnectAccessToken(token);
			return {
				status: 200,
				payload: {
					item: {
						item_id: reconnect ? reconnectItemIdFor(token) : GOLDEN_ITEM_ID,
						institution_id: reconnect
							? RECONNECT_INSTITUTION_ID
							: GOLDEN_INSTITUTION_ID,
						webhook: null,
						billed_products: ["transactions"],
						available_products: ["investments"],
						consented_products: ["transactions"],
						products: ["transactions"],
					},
					status: { transactions: null },
					request_id: "golden-request",
				},
			};
		}
		if (path === "/institutions/get_by_id") {
			const institutionId = String(body.institution_id ?? GOLDEN_INSTITUTION_ID);
			const reconnect = institutionId === RECONNECT_INSTITUTION_ID;
			return {
				status: 200,
				payload: {
					institution: {
						institution_id: reconnect
							? RECONNECT_INSTITUTION_ID
							: GOLDEN_INSTITUTION_ID,
						name: reconnect
							? RECONNECT_INSTITUTION_NAME
							: GOLDEN_INSTITUTION_NAME,
					},
					request_id: "golden-request",
				},
			};
		}
		if (path === "/transactions/sync") {
			const cursorValue = body.cursor;
			const cursor =
				typeof cursorValue === "string" && cursorValue.length > 0
					? cursorValue
					: null;
			const countValue = body.count;
			const count =
				typeof countValue === "number" && Number.isFinite(countValue)
					? countValue
					: null;
			try {
				const payload = resolveSync(cursor, count, accessTokenFrom(body));
				lastSyncBody = payload;
				return { status: 200, payload };
			} catch (error) {
				const code =
					error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
				const httpStatus =
					error instanceof Error && "httpStatus" in error
						? Number((error as { httpStatus: number }).httpStatus)
						: 400;
				return {
					status: httpStatus,
					payload: plaidError(code, code),
				};
			}
		}
		if (path === "/item/remove") {
			const token = accessTokenFrom(body);
			if (isReconnectAccessToken(token) || token === GOLDEN_ACCESS_TOKEN) {
				removedAccessTokens.add(token);
			} else {
				itemRemoved = true;
			}
			return {
				status: 200,
				payload: { request_id: "golden-request" },
			};
		}
		if (path === "/webhook_verification_key/get") {
			return {
				status: 200,
				payload: {
					key: signer.jwk,
					request_id: "golden-request",
				},
			};
		}
		if (path === "/investments/holdings/get") {
			return {
				status: 400,
				payload: plaidError("PRODUCT_NOT_READY", "Holdings are not ready"),
			};
		}
		if (path === "/_golden/health") {
			return { status: 200, payload: { ok: true } };
		}
		if (path === "/_golden/calls") {
			return {
				status: 200,
				payload: { calls: calls.map((call) => call.path) },
			};
		}
		if (path === "/_golden/enable-historical") {
			historicalEnabled = true;
			return { status: 200, payload: { ok: true } };
		}
		if (path === "/_golden/complete-historical") {
			historicalEnabled = true;
			historicalComplete = true;
			return { status: 200, payload: { ok: true } };
		}
		if (path === "/_golden/enable-mutation") {
			mutationEnabled = true;
			historicalEnabled = true;
			historicalComplete = true;
			return { status: 200, payload: { ok: true } };
		}
		if (path === "/_golden/arm-mutation-during-pagination") {
			failNextSyncWithMutation = true;
			return { status: 200, payload: { ok: true } };
		}
		if (path === "/_golden/replay-next-page") {
			replayNextPage = true;
			return { status: 200, payload: { ok: true } };
		}
		if (path === "/_golden/reconnect-variation-b") {
			reconnectItemBIncludesNewAccount = true;
			return { status: 200, payload: { ok: true } };
		}
		if (path === "/_golden/sign") {
			const rawBody =
				typeof body.body === "string"
					? body.body
					: JSON.stringify(body.body ?? {});
			return {
				status: 200,
				payload: { token: signer.signBody(rawBody) },
			};
		}
		return {
			status: 404,
			payload: plaidError("INVALID_REQUEST", `Unknown path ${path}`),
		};
	}

	const server: Server = createServer(async (req, res) => {
		const url = new URL(req.url ?? "/", "http://127.0.0.1");
		let body: Record<string, unknown> = {};
		try {
			body = await readJsonBody(req);
		} catch {
			res.writeHead(400, { "content-type": "application/json" });
			res.end(JSON.stringify(plaidError("INVALID_BODY", "Invalid JSON")));
			return;
		}
		const result = handle(url.pathname, body);
		res.writeHead(result.status, { "content-type": "application/json" });
		res.end(JSON.stringify(result.payload));
	});

	await new Promise<void>((resolve) => {
		server.listen(options.port ?? 0, "127.0.0.1", () => resolve());
	});
	const address = server.address();
	if (!address || typeof address === "string") {
		throw new Error("Golden Plaid mock failed to bind a port");
	}
	const baseUrl = `http://127.0.0.1:${address.port}`;

	return {
		baseUrl,
		signer,
		calls,
		get linkTokenHadWebhook() {
			return linkTokenHadWebhook;
		},
		enableHistoricalPages() {
			historicalEnabled = true;
		},
		setHistoricalUpdateComplete() {
			historicalEnabled = true;
			historicalComplete = true;
		},
		enableMutationPages() {
			mutationEnabled = true;
			historicalEnabled = true;
			historicalComplete = true;
		},
		armMutationDuringPagination() {
			failNextSyncWithMutation = true;
		},
		replayNextSyncPage() {
			replayNextPage = true;
		},
		markItemRemoved(accessToken?: string) {
			if (accessToken) {
				removedAccessTokens.add(accessToken);
				return;
			}
			itemRemoved = true;
		},
		setReconnectItemBIncludesNewAccount(enabled: boolean) {
			reconnectItemBIncludesNewAccount = enabled;
		},
		exchangeCallCount() {
			return calls.filter((call) => call.path === "/item/public_token/exchange")
				.length;
		},
		close() {
			return new Promise((resolve, reject) => {
				server.close((error) => {
					if (error) reject(error);
					else resolve();
				});
			});
		},
	};
}
