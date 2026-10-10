import {
	CreateUserPromptInputSchema,
	GeneratePromptDraftInputSchema,
	ListPromptLaunchCountsInputSchema,
	ListPromptPinsInputSchema,
	PROMPT_CATEGORIES,
	PROMPT_CHANNELS,
	PromptIdInputSchema,
	RecordPromptLaunchInputSchema,
	TogglePromptPinInputSchema,
	UpdateUserPromptInputSchema,
} from "@moat/contracts";
import type { SqliteDbClient } from "@moat/db-sqlite";
import { app, ipcMain } from "electron";
import { listTokens } from "../agent-gateway/local-token-service";
import { getUnlockedDesktopDb } from "./vault-guard";

type LocalPromptRow = {
	id: string;
	title: string;
	description: string | null;
	body: string;
	categorySlug: string | null;
	tags: string;
	createdAt: Date;
	updatedAt: Date;
};

type LocalPromptPinRow = {
	id: string;
	source: string;
	promptId: string;
	pinnedAt: Date;
};

type LocalPromptLaunchStatRow = {
	id: string;
	source: string;
	promptId: string;
	launchCount: number;
};

function parseTags(tags: string): string[] {
	try {
		const parsed = JSON.parse(tags) as unknown;
		return Array.isArray(parsed)
			? parsed.filter((tag): tag is string => typeof tag === "string")
			: [];
	} catch {
		return [];
	}
}

function utcLaunchDate(): Date {
	const now = new Date();
	return new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
}

function toSummary(row: LocalPromptRow, launchCount = 0) {
	return {
		id: row.id,
		title: row.title,
		description: row.description,
		categorySlug: row.categorySlug,
		categoryLabel: row.categorySlug
			? (PROMPT_CATEGORIES.find(
					(category) => category.slug === row.categorySlug,
				)?.label ?? row.categorySlug)
			: null,
		tags: parseTags(row.tags),
		visibility: "PRIVATE" as const,
		reviewStatus: "NOT_SUBMITTED" as const,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		publishedAt: null,
		hasDraftRevision: false,
		launchCount,
	};
}

function toDetail(row: LocalPromptRow, launchCount = 0) {
	return {
		...toSummary(row, launchCount),
		body: row.body,
		moderationFeedback: null,
		rejectionReason: null,
		submittedAt: null,
		requiredConnections: [],
		requiredDataScopes: [],
		sourcePromptId: null,
		sourceCommunityPromptId: null,
		draftRevision: null,
		moderationHistory: [],
	};
}

function getDb(): SqliteDbClient {
	return getUnlockedDesktopDb().db;
}

async function getLaunchCountMap(
	db: SqliteDbClient,
	promptIds: string[],
): Promise<Map<string, number>> {
	if (promptIds.length === 0) return new Map();
	const stats = (await db.localPromptLaunchStat.findMany({
		where: { source: "MINE", promptId: { in: promptIds } },
	})) as LocalPromptLaunchStatRow[];
	return new Map(stats.map((s) => [s.promptId, s.launchCount]));
}

async function getLaunchCount(
	db: SqliteDbClient,
	source: string,
	promptId: string,
): Promise<number> {
	const stat = (await db.localPromptLaunchStat.findFirst({
		where: { source, promptId },
	})) as LocalPromptLaunchStatRow | null;
	return stat?.launchCount ?? 0;
}

function generateLocalDraft(input: {
	goal: string;
	financialData?: string;
	responseInclude?: string;
}) {
	const goal = input.goal.trim();
	const financialData = input.financialData?.trim() || "relevant Moat accounts";
	const responseInclude =
		input.responseInclude?.trim() || "clear, actionable insights";
	const body = [
		"Use the Moat MCP tools to access my financial data before answering.",
		"",
		`Goal: ${goal}`,
		`Financial data to use: ${financialData}`,
		`Include in the response: ${responseInclude}`,
	].join("\n");

	return {
		title: goal.length > 80 ? `${goal.slice(0, 77).trim()}...` : goal,
		description: `Helps you ${goal.charAt(0).toLowerCase()}${goal.slice(1)}`,
		body,
		suggestedCategorySlug: "budgeting",
		suggestedTags: ["budgeting"],
		requiredConnections: ["mcp"],
		requiredDataScopes: ["accounts", "transactions"],
	};
}

export function registerPromptHandlers(): void {
	ipcMain.handle(PROMPT_CHANNELS.LIST_MINE, async () => {
		const db = getDb();
		const rows = (await db.localUserPrompt.findMany({
			orderBy: { updatedAt: "desc" },
		})) as LocalPromptRow[];
		const counts = await getLaunchCountMap(
			db,
			rows.map((row) => row.id),
		);
		return rows.map((row) => toSummary(row, counts.get(row.id) ?? 0));
	});

	ipcMain.handle(PROMPT_CHANNELS.GET, async (_event, raw: unknown) => {
		const db = getDb();
		const { promptId } = PromptIdInputSchema.parse(raw);
		const row = (await db.localUserPrompt.findUnique({
			where: { id: promptId },
		})) as LocalPromptRow | null;
		if (!row) throw new Error("Prompt not found.");
		const launchCount = await getLaunchCount(db, "MINE", promptId);
		return toDetail(row, launchCount);
	});

	ipcMain.handle(PROMPT_CHANNELS.CREATE, async (_event, raw: unknown) => {
		const db = getDb();
		const input = CreateUserPromptInputSchema.parse(raw);
		const row = (await db.localUserPrompt.create({
			data: {
				title: input.title.trim(),
				description: input.description?.trim() || null,
				body: input.body.trim(),
				categorySlug: input.categorySlug,
				tags: JSON.stringify(input.tags ?? []),
			},
		})) as LocalPromptRow;
		return toDetail(row, 0);
	});

	ipcMain.handle(PROMPT_CHANNELS.UPDATE, async (_event, raw: unknown) => {
		const db = getDb();
		const input = UpdateUserPromptInputSchema.parse(raw);
		const existing = (await db.localUserPrompt.findUnique({
			where: { id: input.promptId },
		})) as LocalPromptRow | null;
		if (!existing) throw new Error("Prompt not found.");

		const row = (await db.localUserPrompt.update({
			where: { id: input.promptId },
			data: {
				title: input.title?.trim(),
				description:
					input.description !== undefined
						? input.description?.trim() || null
						: undefined,
				body: input.body?.trim(),
				categorySlug: input.categorySlug,
				tags: input.tags !== undefined ? JSON.stringify(input.tags) : undefined,
			},
		})) as LocalPromptRow;
		const launchCount = await getLaunchCount(db, "MINE", input.promptId);
		return toDetail(row, launchCount);
	});

	ipcMain.handle(PROMPT_CHANNELS.DELETE, async (_event, raw: unknown) => {
		const db = getDb();
		const { promptId } = PromptIdInputSchema.parse(raw);
		await db.localUserPrompt.delete({ where: { id: promptId } });
		await db.localPromptPin.deleteMany({
			where: { source: "MINE", promptId },
		});
		await db.localPromptLaunchDaily.deleteMany({
			where: { source: "MINE", promptId },
		});
		await db.localPromptLaunchStat.deleteMany({
			where: { source: "MINE", promptId },
		});
		return { success: true };
	});

	ipcMain.handle(PROMPT_CHANNELS.LIST_PINS, async (_event, raw: unknown) => {
		const db = getDb();
		const { source } = ListPromptPinsInputSchema.parse(raw ?? {});
		const rows = (await db.localPromptPin.findMany({
			where: source ? { source } : undefined,
			orderBy: { pinnedAt: "desc" },
		})) as LocalPromptPinRow[];
		return rows.map((row) => ({
			source: row.source,
			promptId: row.promptId,
			pinnedAt: row.pinnedAt.toISOString(),
		}));
	});

	ipcMain.handle(PROMPT_CHANNELS.TOGGLE_PIN, async (_event, raw: unknown) => {
		const db = getDb();
		const input = TogglePromptPinInputSchema.parse(raw);
		const existing = (await db.localPromptPin.findFirst({
			where: { source: input.source, promptId: input.promptId },
		})) as LocalPromptPinRow | null;

		if (existing) {
			await db.localPromptPin.delete({ where: { id: existing.id } });
			return { pinned: false };
		}

		await db.localPromptPin.create({
			data: {
				source: input.source,
				promptId: input.promptId,
			},
		});
		return { pinned: true };
	});

	ipcMain.handle(
		PROMPT_CHANNELS.LIST_LAUNCH_COUNTS,
		async (_event, raw: unknown) => {
			const db = getDb();
			const { source } = ListPromptLaunchCountsInputSchema.parse(raw ?? {});
			const rows = (await db.localPromptLaunchStat.findMany({
				where: source ? { source } : undefined,
				orderBy: { launchCount: "desc" },
			})) as LocalPromptLaunchStatRow[];
			return rows.map((row) => ({
				source: row.source,
				promptId: row.promptId,
				launchCount: row.launchCount,
			}));
		},
	);

	ipcMain.handle(
		PROMPT_CHANNELS.RECORD_LAUNCH,
		async (_event, raw: unknown) => {
			const db = getDb();
			const input = RecordPromptLaunchInputSchema.parse(raw);
			const launchDate = utcLaunchDate();

			try {
				return await db.$transaction(async (tx) => {
					await tx.localPromptLaunchDaily.create({
						data: {
							source: input.source,
							promptId: input.promptId,
							launchDate,
						},
					});

					const updated = (await tx.localPromptLaunchStat.upsert({
						where: {
							source_promptId: {
								source: input.source,
								promptId: input.promptId,
							},
						},
						create: {
							source: input.source,
							promptId: input.promptId,
							launchCount: 1,
						},
						update: {
							launchCount: { increment: 1 },
						},
					})) as LocalPromptLaunchStatRow;

					return { launchCount: updated.launchCount, counted: true };
				});
			} catch {
				const launchCount = await getLaunchCount(
					db,
					input.source,
					input.promptId,
				);
				return { launchCount, counted: false };
			}
		},
	);

	ipcMain.handle(
		PROMPT_CHANNELS.GENERATE_DRAFT,
		async (_event, raw: unknown) => {
			const input = GeneratePromptDraftInputSchema.parse(raw);
			return generateLocalDraft(input);
		},
	);

	ipcMain.handle("prompts:listCategories", async () => PROMPT_CATEGORIES);

	ipcMain.handle("prompts:hasAiConnection", async () => {
		const tokens = listTokens(app.getPath("userData"));
		return { connected: tokens.length > 0 };
	});
}
