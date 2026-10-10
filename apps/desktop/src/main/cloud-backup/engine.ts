import { createHash, randomBytes } from "node:crypto";
import type {
	CloudAccountIdentity,
	CloudAccountUpdateProfileResult,
	CloudBackupDomain,
	CloudBackupDomainPreferences,
	CloudBackupPreviewCounts,
	CloudBackupProgress,
	CloudBackupRunResult,
	CloudBackupStatus,
} from "@moat/contracts";
import { CLOUD_BACKUP_CHANNELS } from "@moat/contracts";
import type { SqliteDbClient } from "@moat/db-sqlite";
import type { BrowserWindow } from "electron";
import { shell } from "electron";
import {
	clearCloudTokenPayload,
	getCloudAuthIdentity,
	readCloudTokenPayload,
	resolveCloudAccessToken,
	updateCloudTokenIdentity,
	writeCloudTokenPayload,
} from "../lib/cloud-auth";
import {
	CloudBackupApiError,
	claimDesktopAuth,
	exchangeCredentials,
	fetchDesktopBackupSummary,
	updateCloudAccountProfile as postCloudAccountProfile,
	postDesktopBackupUpsert,
	registerCloudAccount,
	revokeRefreshToken,
	startDesktopAuth,
} from "./api-client";
import {
	buildStatus,
	isBackupRunning,
	readBackupState,
	resolveSelectedDomains,
	setBackupRunning,
	writeBackupState,
} from "./state";

const GOOGLE_POLL_INTERVAL_MS = 2_000;
const GOOGLE_POLL_TIMEOUT_MS = 10 * 60 * 1000;

let googleSignInAbort: AbortController | null = null;

function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
	const codeVerifier = randomBytes(32).toString("base64url");
	const codeChallenge = createHash("sha256")
		.update(codeVerifier)
		.digest("base64url");
	return { codeVerifier, codeChallenge };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(new Error("Google sign-in cancelled"));
			return;
		}
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		function onAbort() {
			clearTimeout(timer);
			reject(new Error("Google sign-in cancelled"));
		}
		signal.addEventListener("abort", onAbort, { once: true });
	});
}

type ProgressEmitter = (progress: CloudBackupProgress) => void;

function parseJsonField(value: string | null | undefined): unknown {
	if (!value) return {};
	try {
		return JSON.parse(value);
	} catch {
		return {};
	}
}

function normalizeScenarioType(
	type: string,
): "CONSERVATIVE" | "STANDARD" | "AGGRESSIVE" | "CUSTOM" {
	const upper = type.toUpperCase();
	if (
		upper === "CONSERVATIVE" ||
		upper === "STANDARD" ||
		upper === "AGGRESSIVE" ||
		upper === "CUSTOM"
	) {
		return upper;
	}
	return "CUSTOM";
}

function normalizeTransactionSource(source: string): "CSV" | "MANUAL" {
	if (source.toUpperCase() === "CSV") return "CSV";
	return "MANUAL";
}

export async function getLocalPreviewCounts(
	db: SqliteDbClient,
	userId: string,
): Promise<CloudBackupPreviewCounts> {
	const [rules, customCategories, budgets, forecasts, hashtags, transactions] =
		await Promise.all([
			db.transactionRule.count({ where: { userId } }),
			db.category.count({ where: { userId } }),
			db.categoryBudget.count({ where: { userId } }),
			db.forecastScenario.count({ where: { userId } }),
			db.hashtag.count({ where: { userId } }),
			db.transaction.count({
				where: {
					userId,
					plaidItemId: null,
					OR: [{ source: "manual" }, { source: "CSV" }, { source: "import" }],
				},
			}),
		]);

	return {
		rules,
		categories: customCategories,
		budgets,
		forecasts,
		hashtags,
		transactions,
	};
}

export async function getLocalDomainCounts(
	db: SqliteDbClient,
	userId: string,
): Promise<Record<CloudBackupDomain, number>> {
	const counts = await getLocalPreviewCounts(db, userId);
	return {
		rules: counts.rules,
		categories: counts.categories,
		budgets: counts.budgets,
		forecasts: counts.forecasts,
		hashtags: counts.hashtags,
		transactions: counts.transactions,
	};
}

export async function getCloudBackupStatus(
	db: SqliteDbClient,
	userId: string,
): Promise<CloudBackupStatus> {
	const counts = await getLocalDomainCounts(db, userId);
	return buildStatus(counts);
}

async function resolveAccessToken(): Promise<string> {
	try {
		return await resolveCloudAccessToken();
	} catch (error) {
		const message = error instanceof Error ? error.message : "Session expired";
		if (message.startsWith("Sign in to a Moat account")) {
			throw new Error("Sign in to a Moat account before backing up");
		}
		throw error;
	}
}

export async function registerAndStoreSession(input: {
	name: string;
	email: string;
	password: string;
}): Promise<{ email: string; name: string | null }> {
	const registered = await registerCloudAccount(input);
	const exchanged = await exchangeCredentials({
		email: input.email,
		password: input.password,
	});
	if ("requires2FA" in exchanged) {
		throw new Error(
			"Two-factor authentication is required. Complete 2FA on the web app, then sign in here.",
		);
	}
	writeCloudTokenPayload({
		accessToken: exchanged.accessToken,
		refreshToken: exchanged.refreshToken,
		email: exchanged.user.email,
		name: registered.name ?? input.name,
		userId: exchanged.user.id,
		expiresAt: Date.now() + exchanged.expiresIn * 1000,
	});
	return { email: exchanged.user.email, name: registered.name ?? input.name };
}

export async function signInAndStoreSession(input: {
	email: string;
	password: string;
}): Promise<{ email: string; name: string | null }> {
	const exchanged = await exchangeCredentials(input);
	if ("requires2FA" in exchanged) {
		throw new Error(
			"Two-factor authentication is required. Complete 2FA on the web app, then sign in here.",
		);
	}
	writeCloudTokenPayload({
		accessToken: exchanged.accessToken,
		refreshToken: exchanged.refreshToken,
		email: exchanged.user.email,
		name: exchanged.user.name ?? null,
		userId: exchanged.user.id,
		expiresAt: Date.now() + exchanged.expiresIn * 1000,
	});
	return { email: exchanged.user.email, name: exchanged.user.name ?? null };
}

export function cancelGoogleSignIn(): void {
	googleSignInAbort?.abort();
	googleSignInAbort = null;
}

export async function signInWithGoogleAndStoreSession(): Promise<{
	email: string;
	name: string | null;
}> {
	cancelGoogleSignIn();
	const abort = new AbortController();
	googleSignInAbort = abort;

	try {
		const { codeVerifier, codeChallenge } = createPkcePair();
		const started = await startDesktopAuth({ codeChallenge });
		await shell.openExternal(started.authorizeUrl);

		const deadline = Date.now() + GOOGLE_POLL_TIMEOUT_MS;
		while (Date.now() < deadline) {
			if (abort.signal.aborted) {
				throw new Error("Google sign-in cancelled");
			}

			let claimed: Awaited<ReturnType<typeof claimDesktopAuth>>;
			try {
				claimed = await claimDesktopAuth({
					pairId: started.pairId,
					codeVerifier,
				});
			} catch (error) {
				if (abort.signal.aborted) {
					throw new Error("Google sign-in cancelled");
				}
				if (
					error instanceof CloudBackupApiError &&
					(error.status === 410 || error.status === 404)
				) {
					throw new Error(
						"Google sign-in expired. Please try Continue with Google again.",
					);
				}
				throw error;
			}

			if (claimed.status === "ready") {
				writeCloudTokenPayload({
					accessToken: claimed.accessToken,
					refreshToken: claimed.refreshToken,
					email: claimed.user.email,
					name: claimed.user.name,
					userId: claimed.user.id,
					expiresAt: Date.now() + claimed.expiresIn * 1000,
				});
				return { email: claimed.user.email, name: claimed.user.name };
			}

			await sleep(GOOGLE_POLL_INTERVAL_MS, abort.signal);
		}

		throw new Error(
			"Timed out waiting for Google sign-in. Finish in the browser, then try again.",
		);
	} finally {
		if (googleSignInAbort === abort) {
			googleSignInAbort = null;
		}
	}
}

export function getCloudAccountIdentity(): CloudAccountIdentity {
	const identity = getCloudAuthIdentity();
	return {
		signedIn: identity.signedIn,
		email: identity.email,
		name: identity.name,
		userId: identity.userId,
	};
}

export async function updateCloudAccountName(input: {
	name: string;
}): Promise<CloudAccountUpdateProfileResult> {
	const accessToken = await resolveCloudAccessToken();
	const updated = await postCloudAccountProfile(accessToken, input);
	updateCloudTokenIdentity({ name: updated.name });
	return { name: updated.name };
}

export async function signOutCloudBackup(): Promise<void> {
	const payload = readCloudTokenPayload();
	if (payload?.refreshToken) {
		try {
			await revokeRefreshToken(payload.refreshToken);
		} catch {
			// Best-effort revoke
		}
	}
	clearCloudTokenPayload();
	const state = readBackupState();
	writeBackupState({
		...state,
		backupsEnabled: false,
	});
}

export function updateBackupPreferences(input: {
	backupsEnabled?: boolean;
	preferences?: Partial<CloudBackupDomainPreferences>;
}): void {
	const state = readBackupState();
	const nextPreferences = {
		...state.preferences,
		...(input.preferences ?? {}),
	};
	if (input.preferences?.everything === true) {
		nextPreferences.rules = true;
		nextPreferences.categories = true;
		nextPreferences.budgets = true;
		nextPreferences.forecasts = true;
		nextPreferences.hashtags = true;
		nextPreferences.transactions = true;
	}
	writeBackupState({
		...state,
		backupsEnabled:
			input.backupsEnabled !== undefined
				? input.backupsEnabled
				: state.backupsEnabled,
		preferences: nextPreferences,
	});
}

async function buildUpsertPayload(input: {
	db: SqliteDbClient;
	userId: string;
	selected: Set<CloudBackupDomain>;
	accessToken: string;
	emit: ProgressEmitter;
}): Promise<Record<string, unknown>> {
	const { db, userId, selected, accessToken, emit } = input;
	const payload: Record<string, unknown> = {};

	emit({ phase: "prepare", message: "Preparing backup…", percent: 5 });
	const summary = await fetchDesktopBackupSummary(accessToken);
	const cloudSystemByName = new Map(
		summary.systemCategories.map((category) => [
			category.name.toLowerCase(),
			category.id,
		]),
	);

	const localCategories = (await db.category.findMany({
		where: { OR: [{ userId: null }, { userId }] },
	})) as Array<{
		id: string;
		name: string;
		icon: string | null;
		userId: string | null;
		isHidden: boolean | number;
		sortOrder: number;
	}>;

	const categoryIdMap = new Map<string, string>();
	for (const category of localCategories) {
		if (category.userId == null) {
			const cloudId = cloudSystemByName.get(category.name.toLowerCase());
			if (cloudId) {
				categoryIdMap.set(category.id, cloudId);
			}
		} else {
			categoryIdMap.set(category.id, category.id);
		}
	}

	const remapCategoryId = (id: string | null | undefined): string | null => {
		if (!id) return null;
		return categoryIdMap.get(id) ?? null;
	};

	if (selected.has("categories")) {
		emit({
			phase: "categories",
			message: "Backing up categories…",
			percent: 15,
		});
		payload.categories = localCategories
			.filter((category) => category.userId === userId)
			.map((category) => ({
				id: category.id,
				name: category.name,
				icon: category.icon,
				sortOrder: category.sortOrder,
				isHidden: Boolean(category.isHidden),
			}));
	}

	if (selected.has("hashtags") || selected.has("transactions")) {
		emit({ phase: "hashtags", message: "Backing up hashtags…", percent: 25 });
		const hashtags = (await db.hashtag.findMany({
			where: { userId },
		})) as Array<{ id: string; name: string; normalizedName: string }>;
		payload.hashtags = hashtags.map((hashtag) => ({
			id: hashtag.id,
			name: hashtag.name,
			normalizedName: hashtag.normalizedName,
		}));
	}

	if (selected.has("rules")) {
		emit({ phase: "rules", message: "Backing up rules…", percent: 40 });
		const rules = (await db.transactionRule.findMany({
			where: { userId },
			include: {
				conditionGroups: {
					orderBy: { sortOrder: "asc" },
					include: { conditions: { orderBy: { sortOrder: "asc" } } },
				},
				conditions: { orderBy: { sortOrder: "asc" } },
				actions: { orderBy: { sortOrder: "asc" } },
			},
		})) as Array<{
			id: string;
			name: string;
			isActive: boolean | number;
			priority: number;
			match: string | null;
			conditionGroups: Array<{
				id: string;
				match: string | null;
				sortOrder: number;
				conditions: Array<{ id: string }>;
			}>;
			conditions: Array<{
				id: string;
				field: string;
				operator: string;
				valueText: string | null;
				valueNumber: number | null;
				valueDate: Date | string | null;
				secondValueNumber: number | null;
				secondValueDate: Date | string | null;
				sortOrder: number;
			}>;
			actions: Array<{
				id: string;
				type: string;
				valueText: string | null;
				hashtagId: string | null;
				hashtagName: string | null;
				sortOrder: number;
			}>;
		}>;

		payload.rules = rules.map((rule) => ({
			id: rule.id,
			name: rule.name,
			isActive: Boolean(rule.isActive),
			priority: rule.priority,
			match: rule.match === "ANY" ? "ANY" : "ALL",
			conditionGroups: rule.conditionGroups.map((group) => ({
				id: group.id,
				match: group.match === "ANY" ? "ANY" : "ALL",
				sortOrder: group.sortOrder,
				conditionIds: group.conditions.map((condition) => condition.id),
			})),
			conditions: rule.conditions.map((condition) => ({
				id: condition.id,
				field: condition.field,
				operator: condition.operator,
				valueText:
					condition.field === "CATEGORY"
						? remapCategoryId(condition.valueText)
						: condition.valueText,
				valueNumber: condition.valueNumber,
				valueDate:
					condition.valueDate instanceof Date
						? condition.valueDate.toISOString()
						: condition.valueDate,
				secondValueNumber: condition.secondValueNumber,
				secondValueDate:
					condition.secondValueDate instanceof Date
						? condition.secondValueDate.toISOString()
						: condition.secondValueDate,
				sortOrder: condition.sortOrder,
			})),
			actions: rule.actions.map((action) => ({
				id: action.id,
				type: action.type,
				valueText:
					action.type === "SET_CATEGORY"
						? remapCategoryId(action.valueText)
						: action.valueText,
				hashtagId: action.hashtagId,
				hashtagName: action.hashtagName,
				sortOrder: action.sortOrder,
			})),
		}));
	}

	if (selected.has("budgets")) {
		emit({ phase: "budgets", message: "Backing up budgets…", percent: 55 });
		const budgets = (await db.categoryBudget.findMany({
			where: { userId },
		})) as Array<{ id: string; categoryId: string; monthlyGoal: number }>;
		payload.budgets = budgets
			.map((budget) => {
				const categoryId = remapCategoryId(budget.categoryId);
				if (!categoryId) return null;
				return {
					id: budget.id,
					categoryId,
					monthlyGoal: budget.monthlyGoal,
				};
			})
			.filter((row): row is NonNullable<typeof row> => row != null);
	}

	if (selected.has("forecasts")) {
		emit({
			phase: "forecasts",
			message: "Backing up forecasts and profile…",
			percent: 70,
		});
		const scenarios = (await db.forecastScenario.findMany({
			where: { userId },
		})) as Array<{
			id: string;
			name: string;
			type: string;
			investmentReturn: number;
			inflationRate: number;
			salaryGrowth: number;
			contributionChange: number;
			expenseGrowth: number;
			isActive: boolean | number;
		}>;
		payload.scenarios = scenarios.map((scenario) => ({
			id: scenario.id,
			name: scenario.name,
			type: normalizeScenarioType(scenario.type),
			investmentReturn: scenario.investmentReturn,
			inflationRate: scenario.inflationRate,
			salaryGrowth: scenario.salaryGrowth,
			contributionChange: scenario.contributionChange,
			expenseGrowth: scenario.expenseGrowth,
			isActive: Boolean(scenario.isActive),
		}));

		const profileRows = await db.$queryRaw<
			Array<{
				profile: string;
				accounts: string;
				incomeSources: string;
				assets: string;
				liabilities: string;
				investments: string;
				insurancePolicies: string;
				taxProfile: string;
				forecastAssumptions: string;
				planningNotes: string;
			}>
		>`SELECT * FROM "FinancialProfileData" WHERE "userId" = ${userId} LIMIT 1`;
		const profileData = profileRows[0];

		if (profileData) {
			payload.financialProfileData = {
				profile: parseJsonField(profileData.profile),
				accounts: parseJsonField(profileData.accounts),
				incomeSources: parseJsonField(profileData.incomeSources),
				assets: parseJsonField(profileData.assets),
				liabilities: parseJsonField(profileData.liabilities),
				investments: parseJsonField(profileData.investments),
				insurancePolicies: parseJsonField(profileData.insurancePolicies),
				taxProfile: parseJsonField(profileData.taxProfile),
				forecastAssumptions: parseJsonField(profileData.forecastAssumptions),
				planningNotes: parseJsonField(profileData.planningNotes),
			};
		}
	}

	if (selected.has("transactions")) {
		emit({
			phase: "transactions",
			message: "Backing up manual accounts and transactions…",
			percent: 85,
		});
		const accounts = (await db.account.findMany({
			where: { userId },
		})) as Array<{ id: string; name: string }>;
		const accountNameById = new Map(
			accounts.map((account) => [account.id, account.name]),
		);

		const transactions = (await db.transaction.findMany({
			where: {
				userId,
				plaidItemId: null,
				OR: [{ source: "manual" }, { source: "CSV" }, { source: "import" }],
			},
		})) as Array<{
			id: string;
			date: Date | string;
			postedDate: Date | string | null;
			amount: number;
			merchantName: string | null;
			description: string | null;
			type: string;
			pending: boolean | number;
			hidden: boolean | number;
			source: string;
			accountId: string | null;
			categoryId: string | null;
		}>;

		const transactionIds = transactions.map((tx) => tx.id);
		const hashtagLinks =
			transactionIds.length === 0
				? []
				: ((await db.transactionHashtag.findMany({
						where: { transactionId: { in: transactionIds } },
					})) as Array<{ transactionId: string; hashtagId: string }>);
		const hashtagsByTransaction = new Map<string, string[]>();
		for (const link of hashtagLinks) {
			const existing = hashtagsByTransaction.get(link.transactionId) ?? [];
			existing.push(link.hashtagId);
			hashtagsByTransaction.set(link.transactionId, existing);
		}

		payload.transactions = transactions.map((tx) => ({
			id: tx.id,
			date: tx.date instanceof Date ? tx.date.toISOString() : String(tx.date),
			postedDate:
				tx.postedDate instanceof Date
					? tx.postedDate.toISOString()
					: tx.postedDate,
			amount: tx.amount,
			merchantName: tx.merchantName,
			description: tx.description,
			type: tx.type === "INCOME" ? "INCOME" : "EXPENSE",
			pending: Boolean(tx.pending),
			hidden: Boolean(tx.hidden),
			source: normalizeTransactionSource(tx.source),
			account: tx.accountId
				? (accountNameById.get(tx.accountId) ?? null)
				: null,
			categoryId: remapCategoryId(tx.categoryId),
			hashtagIds: hashtagsByTransaction.get(tx.id) ?? [],
		}));
	}

	return payload;
}

export async function runCloudBackup(input: {
	db: SqliteDbClient;
	userId: string;
	emit?: ProgressEmitter;
	enableOnSuccess?: boolean;
}): Promise<CloudBackupRunResult> {
	if (isBackupRunning()) {
		const status = await getCloudBackupStatus(input.db, input.userId);
		return {
			ok: false,
			error: "A backup is already running",
			status,
		};
	}

	const emit = input.emit ?? (() => undefined);
	setBackupRunning(true);

	const state = readBackupState();
	const selected = resolveSelectedDomains(state.preferences);
	if (selected.size === 0) {
		setBackupRunning(false);
		const status = await getCloudBackupStatus(input.db, input.userId);
		return {
			ok: false,
			error: "Select at least one data type to back up",
			status,
		};
	}

	if (!getCloudAuthIdentity().signedIn) {
		setBackupRunning(false);
		const status = await getCloudBackupStatus(input.db, input.userId);
		return {
			ok: false,
			error: "Sign in to a Moat account before backing up",
			status,
		};
	}

	try {
		const accessToken = await resolveAccessToken();
		const payload = await buildUpsertPayload({
			db: input.db,
			userId: input.userId,
			selected,
			accessToken,
			emit,
		});

		const transactions = Array.isArray(payload.transactions)
			? (payload.transactions as unknown[])
			: null;
		if (transactions) {
			delete payload.transactions;
		}

		emit({ phase: "upload", message: "Uploading to cloud…", percent: 90 });
		await postDesktopBackupUpsert(accessToken, payload);

		if (transactions && transactions.length > 0) {
			const batchSize = 500;
			for (let offset = 0; offset < transactions.length; offset += batchSize) {
				const batch = transactions.slice(offset, offset + batchSize);
				const batchNumber = Math.floor(offset / batchSize) + 1;
				const batchCount = Math.ceil(transactions.length / batchSize);
				emit({
					phase: "transactions",
					message: `Uploading transactions (${batchNumber}/${batchCount})…`,
					percent: Math.min(
						99,
						90 + Math.round((batchNumber / batchCount) * 9),
					),
				});
				await postDesktopBackupUpsert(accessToken, { transactions: batch });
			}
		}

		const localCounts = await getLocalDomainCounts(input.db, input.userId);
		const now = new Date().toISOString();
		const nextDomainSync = { ...state.domainSync };
		for (const domain of selected) {
			nextDomainSync[domain] = {
				lastSyncedAt: now,
				lastError: null,
				lastLocalCount: localCounts[domain],
			};
		}

		writeBackupState({
			...state,
			backupsEnabled:
				input.enableOnSuccess === false ? state.backupsEnabled : true,
			lastSuccessfulSyncAt: now,
			lastAttemptAt: now,
			lastError: null,
			domainSync: nextDomainSync,
		});

		emit({ phase: "done", message: "Backup complete", percent: 100 });
		const status = await getCloudBackupStatus(input.db, input.userId);
		return { ok: true, error: null, status };
	} catch (error) {
		const message =
			error instanceof CloudBackupApiError
				? error.message
				: error instanceof Error
					? error.message
					: "Backup failed";
		const failedState = readBackupState();
		const nextDomainSync = { ...failedState.domainSync };
		for (const domain of selected) {
			nextDomainSync[domain] = {
				lastSyncedAt: nextDomainSync[domain]?.lastSyncedAt ?? null,
				lastError: message,
				lastLocalCount: nextDomainSync[domain]?.lastLocalCount ?? 0,
			};
		}
		writeBackupState({
			...failedState,
			lastAttemptAt: new Date().toISOString(),
			lastError: message,
			domainSync: nextDomainSync,
		});
		const status = await getCloudBackupStatus(input.db, input.userId);
		return { ok: false, error: message, status };
	} finally {
		setBackupRunning(false);
	}
}

export function createProgressEmitter(
	getWindow: () => BrowserWindow | null,
): ProgressEmitter {
	return (progress) => {
		const window = getWindow();
		if (!window || window.isDestroyed()) return;
		window.webContents.send(CLOUD_BACKUP_CHANNELS.progress, progress);
	};
}

export function shouldRunScheduledBackup(): boolean {
	const state = readBackupState();
	if (!state.backupsEnabled) return false;
	if (!getCloudAuthIdentity().signedIn) return false;
	if (!state.lastSuccessfulSyncAt) return true;
	const last = Date.parse(state.lastSuccessfulSyncAt);
	if (Number.isNaN(last)) return true;
	const dayMs = 24 * 60 * 60 * 1000;
	return Date.now() - last >= dayMs;
}
