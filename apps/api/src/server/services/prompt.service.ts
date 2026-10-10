import type {
	CommunityPromptDetail,
	CommunityPromptSummary,
	CreateUserPromptInput,
	GeneratePromptDraftInput,
	GeneratePromptDraftResult,
	ModerationQueueItem,
	PromptLaunchCountSummary,
	PromptLibrarySource,
	PromptModerationEventSummary,
	PromptPinSummary,
	RecordPromptLaunchInput,
	RecordPromptLaunchResult,
	TogglePromptPinInput,
	TogglePromptPinResult,
	UpdateUserPromptInput,
	UserPromptDetail,
	UserPromptSummary,
} from "@moat/contracts";
import { sendPromptModerationEmail } from "~/lib/email/send-prompt-moderation-email";
import { logger } from "~/lib/logger";
import type { Prisma, PromptReviewStatus } from "../../../generated/prisma";
import { db } from "../db";
import { runAsElevatedServiceActor } from "../db-actor";
import {
	activeMcpOAuthAccessTokenWhere,
	activeMcpPersonalAccessTokenWhere,
} from "../mcp/oauth-connection";

export class PromptError extends Error {
	constructor(
		message: string,
		public statusCode = 400,
	) {
		super(message);
	}
}

const promptInclude = {
	category: true,
	revisions: {
		orderBy: { version: "desc" as const },
	},
	moderationHistory: {
		orderBy: { createdAt: "desc" as const },
		take: 20,
	},
} satisfies Prisma.UserPromptInclude;

function toIso(date: Date | null | undefined): string | null {
	return date ? date.toISOString() : null;
}

function creatorDisplayName(user: {
	name: string | null;
	username: string | null;
}): string {
	const name = user.name?.trim();
	if (name) {
		const first = name.split(/\s+/)[0];
		if (first) return first;
	}
	if (user.username?.trim()) return user.username.trim();
	return "Moat user";
}

function getDraftRevision(
	revisions: Array<{
		id: string;
		version: number;
		reviewStatus: PromptReviewStatus;
		submittedAt: Date | null;
		reviewedAt: Date | null;
	}>,
	publishedRevisionId: string | null,
) {
	return (
		revisions.find(
			(r) => r.reviewStatus === "NOT_SUBMITTED" && r.id !== publishedRevisionId,
		) ?? null
	);
}

function toSummary(
	prompt: Prisma.UserPromptGetPayload<{
		include: { category: true; revisions: true };
	}>,
	launchCount = 0,
): UserPromptSummary {
	const draft = getDraftRevision(prompt.revisions, prompt.publishedRevisionId);
	return {
		id: prompt.id,
		title: prompt.title,
		description: prompt.description,
		categorySlug: prompt.category?.slug ?? null,
		categoryLabel: prompt.category?.label ?? null,
		tags: prompt.tags,
		visibility: prompt.visibility,
		reviewStatus: prompt.reviewStatus,
		createdAt: prompt.createdAt.toISOString(),
		updatedAt: prompt.updatedAt.toISOString(),
		publishedAt: toIso(prompt.publishedAt),
		hasDraftRevision: draft !== null,
		launchCount,
	};
}

function toModerationEvent(
	event: Prisma.PromptModerationEventGetPayload<object>,
): PromptModerationEventSummary {
	return {
		id: event.id,
		action: event.action,
		feedback: event.feedback,
		reason: event.reason,
		actorId: event.actorId,
		createdAt: event.createdAt.toISOString(),
	};
}

function toDetail(
	prompt: Prisma.UserPromptGetPayload<{ include: typeof promptInclude }>,
	launchCount = 0,
): UserPromptDetail {
	const draft = getDraftRevision(prompt.revisions, prompt.publishedRevisionId);
	return {
		...toSummary(prompt, launchCount),
		body: prompt.body,
		moderationFeedback: prompt.moderationFeedback,
		rejectionReason: prompt.rejectionReason,
		submittedAt: toIso(prompt.submittedAt),
		requiredConnections: prompt.requiredConnections,
		requiredDataScopes: prompt.requiredDataScopes,
		sourcePromptId: prompt.sourcePromptId,
		sourceCommunityPromptId: prompt.sourceCommunityPromptId,
		draftRevision: draft
			? {
					id: draft.id,
					version: draft.version,
					reviewStatus: draft.reviewStatus,
					submittedAt: toIso(draft.submittedAt),
					reviewedAt: toIso(draft.reviewedAt),
				}
			: null,
		moderationHistory: prompt.moderationHistory.map(toModerationEvent),
	};
}

function computeSafetyFlags(body: string, title: string): string[] {
	const flags: string[] = [];
	const text = `${title} ${body}`.toLowerCase();
	if (/\bguaranteed\b|\bwill definitely\b|\b100%\b/.test(text)) {
		flags.push("guaranteed_results_language");
	}
	if (/\baccount number\b|\brouting number\b|\bssn\b/.test(text)) {
		flags.push("sensitive_data_request");
	}
	if (/\bignore previous\b|\boverride instructions\b/.test(text)) {
		flags.push("prompt_injection_language");
	}
	return flags;
}

async function getActiveCategory(categorySlug: string) {
	const category = await db.promptCategory.findFirst({
		where: { slug: categorySlug, isActive: true },
	});
	if (!category) {
		throw new PromptError("Invalid category.", 400);
	}
	return category;
}

async function getOwnedPrompt(userId: string, promptId: string) {
	// moderationHistory is service-only under RLS; elevate so authors see events.
	const prompt = await runAsElevatedServiceActor(() =>
		db.userPrompt.findFirst({
			where: { id: promptId, creatorId: userId, deletedAt: null },
			include: promptInclude,
		}),
	);
	if (!prompt) throw new PromptError("Prompt not found.", 404);
	return prompt;
}

async function getNextRevisionVersion(promptId: string): Promise<number> {
	const latest = await db.promptRevision.findFirst({
		where: { promptId },
		orderBy: { version: "desc" },
		select: { version: true },
	});
	return (latest?.version ?? 0) + 1;
}

function utcLaunchDate(): Date {
	const now = new Date();
	return new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
}

async function getLaunchCountMap(
	source: PromptLibrarySource,
	promptIds: string[],
): Promise<Map<string, number>> {
	if (promptIds.length === 0) return new Map();
	const stats = await runAsElevatedServiceActor(() =>
		db.promptLaunchStat.findMany({
			where: { source, promptId: { in: promptIds } },
			select: { promptId: true, launchCount: true },
		}),
	);
	return new Map(stats.map((s) => [s.promptId, s.launchCount]));
}

async function getLaunchCount(
	source: PromptLibrarySource,
	promptId: string,
): Promise<number> {
	const stat = await runAsElevatedServiceActor(() =>
		db.promptLaunchStat.findUnique({
			where: { source_promptId: { source, promptId } },
			select: { launchCount: true },
		}),
	);
	return stat?.launchCount ?? 0;
}

export async function listCategories() {
	const categories = await db.promptCategory.findMany({
		where: { isActive: true },
		orderBy: { sortOrder: "asc" },
	});
	return categories.map((c) => ({
		id: c.id,
		slug: c.slug,
		label: c.label,
		sortOrder: c.sortOrder,
	}));
}

export async function listMyPrompts(
	userId: string,
): Promise<UserPromptSummary[]> {
	const prompts = await db.userPrompt.findMany({
		where: { creatorId: userId, deletedAt: null },
		include: { category: true, revisions: true },
		orderBy: { updatedAt: "desc" },
	});
	const counts = await getLaunchCountMap(
		"MINE",
		prompts.map((p) => p.id),
	);
	return prompts.map((p) => toSummary(p, counts.get(p.id) ?? 0));
}

export async function getPrompt(
	userId: string,
	promptId: string,
): Promise<UserPromptDetail> {
	const prompt = await getOwnedPrompt(userId, promptId);
	const launchCount = await getLaunchCount("MINE", promptId);
	return toDetail(prompt, launchCount);
}

export async function createPrompt(
	userId: string,
	input: CreateUserPromptInput,
): Promise<UserPromptDetail> {
	const category = input.categorySlug
		? await getActiveCategory(input.categorySlug)
		: null;
	const prompt = await db.userPrompt.create({
		data: {
			creatorId: userId,
			title: input.title.trim(),
			description: input.description?.trim() || null,
			body: input.body.trim(),
			categoryId: category?.id ?? null,
			tags: input.tags ?? [],
			requiredConnections: input.requiredConnections ?? [],
			requiredDataScopes: input.requiredDataScopes ?? [],
		},
		include: promptInclude,
	});

	if (input.submitForReview) {
		return submitPrompt(userId, prompt.id);
	}

	return toDetail(prompt, 0);
}

export async function updatePrompt(
	userId: string,
	input: UpdateUserPromptInput,
): Promise<UserPromptDetail> {
	const prompt = await getOwnedPrompt(userId, input.promptId);

	if (prompt.reviewStatus === "PENDING") {
		if (!input.confirmWithdrawFromReview) {
			throw new PromptError(
				"Editing this prompt will remove it from review.",
				409,
			);
		}
		const pendingRevision = prompt.revisions.find(
			(r) => r.reviewStatus === "PENDING",
		);
		await runAsElevatedServiceActor(() =>
			db.$transaction(async (tx) => {
				if (pendingRevision) {
					await tx.promptRevision.update({
						where: { id: pendingRevision.id },
						data: {
							reviewStatus: "NOT_SUBMITTED",
							submittedAt: null,
						},
					});
				}
				await tx.userPrompt.update({
					where: { id: prompt.id },
					data: {
						reviewStatus: "NOT_SUBMITTED",
						submittedAt: null,
					},
				});
				await tx.promptModerationEvent.create({
					data: {
						promptId: prompt.id,
						revisionId: pendingRevision?.id,
						actorId: userId,
						action: "WITHDRAWN",
					},
				});
			}),
		);
	}

	const category =
		input.categorySlug === undefined
			? undefined
			: input.categorySlug === null
				? null
				: await getActiveCategory(input.categorySlug);

	if (prompt.publishedRevisionId) {
		const draft = getDraftRevision(
			prompt.revisions,
			prompt.publishedRevisionId,
		);
		const revisionData = {
			title: input.title?.trim() ?? prompt.title,
			description:
				input.description !== undefined
					? input.description?.trim() || null
					: prompt.description,
			body: input.body?.trim() ?? prompt.body,
			categoryId:
				category === undefined ? prompt.categoryId : (category?.id ?? null),
			tags: input.tags ?? prompt.tags,
			requiredConnections:
				input.requiredConnections ?? prompt.requiredConnections,
			requiredDataScopes: input.requiredDataScopes ?? prompt.requiredDataScopes,
		};

		if (draft) {
			await db.promptRevision.update({
				where: { id: draft.id },
				data: revisionData,
			});
		} else {
			const version = await getNextRevisionVersion(prompt.id);
			await db.promptRevision.create({
				data: {
					promptId: prompt.id,
					version,
					reviewStatus: "NOT_SUBMITTED",
					...revisionData,
				},
			});
		}
	}

	const updated = await db.userPrompt.update({
		where: { id: prompt.id },
		data: {
			title: input.title?.trim(),
			description:
				input.description !== undefined
					? input.description?.trim() || null
					: undefined,
			body: input.body?.trim(),
			categoryId: category === undefined ? undefined : (category?.id ?? null),
			tags: input.tags,
			requiredConnections: input.requiredConnections,
			requiredDataScopes: input.requiredDataScopes,
		},
		include: promptInclude,
	});

	const launchCount = await getLaunchCount("MINE", updated.id);
	return toDetail(updated, launchCount);
}

export async function deletePrompt(userId: string, promptId: string) {
	const prompt = await getOwnedPrompt(userId, promptId);
	if (prompt.visibility === "PUBLIC") {
		throw new PromptError("Published prompts cannot be deleted.", 400);
	}
	await runAsElevatedServiceActor(() =>
		db.$transaction(async (tx) => {
			await tx.userPrompt.update({
				where: { id: promptId },
				data: { deletedAt: new Date() },
			});
			await tx.promptPin.deleteMany({
				where: { userId, source: "MINE", promptId },
			});
			await tx.promptLaunchDaily.deleteMany({
				where: { source: "MINE", promptId },
			});
			await tx.promptLaunchStat.deleteMany({
				where: { source: "MINE", promptId },
			});
		}),
	);
}

export async function listPromptPins(
	userId: string,
	source?: PromptLibrarySource,
): Promise<PromptPinSummary[]> {
	const pins = await db.promptPin.findMany({
		where: {
			userId,
			...(source ? { source } : {}),
		},
		orderBy: { pinnedAt: "desc" },
	});
	return pins.map((pin) => ({
		source: pin.source,
		promptId: pin.promptId,
		pinnedAt: pin.pinnedAt.toISOString(),
	}));
}

export async function togglePromptPin(
	userId: string,
	input: TogglePromptPinInput,
): Promise<TogglePromptPinResult> {
	const existing = await db.promptPin.findUnique({
		where: {
			userId_source_promptId: {
				userId,
				source: input.source,
				promptId: input.promptId,
			},
		},
	});

	if (existing) {
		await db.promptPin.delete({ where: { id: existing.id } });
		return { pinned: false };
	}

	await db.promptPin.create({
		data: {
			userId,
			source: input.source,
			promptId: input.promptId,
		},
	});
	return { pinned: true };
}

export async function listPromptLaunchCounts(
	source?: PromptLibrarySource,
): Promise<PromptLaunchCountSummary[]> {
	const stats = await runAsElevatedServiceActor(() =>
		db.promptLaunchStat.findMany({
			where: source ? { source } : {},
			orderBy: { launchCount: "desc" },
		}),
	);
	return stats.map((stat) => ({
		source: stat.source,
		promptId: stat.promptId,
		launchCount: stat.launchCount,
	}));
}

function isUniqueConstraintError(error: unknown): boolean {
	return (
		error !== null &&
		typeof error === "object" &&
		"code" in error &&
		error.code === "P2002"
	);
}

export async function recordPromptLaunch(
	userId: string,
	input: RecordPromptLaunchInput,
): Promise<RecordPromptLaunchResult> {
	const launchDate = utcLaunchDate();

	try {
		// PromptLaunchStat is service-only; elevate the whole txn so daily +
		// aggregate stay consistent under the same actor.
		return await runAsElevatedServiceActor(() =>
			db.$transaction(async (tx) => {
				await tx.promptLaunchDaily.create({
					data: {
						userId,
						source: input.source,
						promptId: input.promptId,
						launchDate,
					},
				});

				const updated = await tx.promptLaunchStat.upsert({
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
				});

				return { launchCount: updated.launchCount, counted: true };
			}),
		);
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			const launchCount = await getLaunchCount(input.source, input.promptId);
			return { launchCount, counted: false };
		}
		throw error;
	}
}

export async function submitPrompt(
	userId: string,
	promptId: string,
): Promise<UserPromptDetail> {
	const prompt = await getOwnedPrompt(userId, promptId);
	if (prompt.reviewStatus === "PENDING") {
		throw new PromptError("Prompt is already under review.", 400);
	}

	const draft = getDraftRevision(prompt.revisions, prompt.publishedRevisionId);
	const now = new Date();

	await runAsElevatedServiceActor(() =>
		db.$transaction(async (tx) => {
			let revisionId: string;

			if (draft) {
				const updated = await tx.promptRevision.update({
					where: { id: draft.id },
					data: {
						reviewStatus: "PENDING",
						submittedAt: now,
						moderationFeedback: null,
						rejectionReason: null,
					},
				});
				revisionId = updated.id;
			} else {
				const version = await getNextRevisionVersion(prompt.id);
				const created = await tx.promptRevision.create({
					data: {
						promptId: prompt.id,
						version,
						title: prompt.title,
						description: prompt.description,
						body: prompt.body,
						categoryId: prompt.categoryId,
						tags: prompt.tags,
						reviewStatus: "PENDING",
						submittedAt: now,
						requiredConnections: prompt.requiredConnections,
						requiredDataScopes: prompt.requiredDataScopes,
					},
				});
				revisionId = created.id;
			}

			await tx.userPrompt.update({
				where: { id: prompt.id },
				data: {
					reviewStatus: "PENDING",
					submittedAt: now,
					moderationFeedback: null,
					rejectionReason: null,
				},
			});

			await tx.promptModerationEvent.create({
				data: {
					promptId: prompt.id,
					revisionId,
					actorId: userId,
					action: "SUBMITTED",
					metadata: {
						safetyFlags: computeSafetyFlags(prompt.body, prompt.title),
					},
				},
			});
		}),
	);

	const submitted = await getPrompt(userId, promptId);

	sendPromptModerationEmail({
		promptId: submitted.id,
		title: submitted.title,
		reviewStatus: submitted.reviewStatus,
	}).catch((err: unknown) => {
		logger.warn("prompt.moderation_email_failed", {
			promptId: submitted.id,
			error: err instanceof Error ? err.message : String(err),
		});
	});

	return submitted;
}

export async function withdrawPrompt(
	userId: string,
	promptId: string,
): Promise<UserPromptDetail> {
	const prompt = await getOwnedPrompt(userId, promptId);
	if (prompt.reviewStatus !== "PENDING") {
		throw new PromptError("Prompt is not under review.", 400);
	}

	const pendingRevision = prompt.revisions.find(
		(r) => r.reviewStatus === "PENDING",
	);

	await runAsElevatedServiceActor(() =>
		db.$transaction(async (tx) => {
			if (pendingRevision) {
				await tx.promptRevision.update({
					where: { id: pendingRevision.id },
					data: { reviewStatus: "NOT_SUBMITTED", submittedAt: null },
				});
			}
			await tx.userPrompt.update({
				where: { id: prompt.id },
				data: { reviewStatus: "NOT_SUBMITTED", submittedAt: null },
			});
			await tx.promptModerationEvent.create({
				data: {
					promptId: prompt.id,
					revisionId: pendingRevision?.id,
					actorId: userId,
					action: "WITHDRAWN",
				},
			});
		}),
	);

	return getPrompt(userId, promptId);
}

export async function listCommunityPrompts(): Promise<
	CommunityPromptSummary[]
> {
	const prompts = await db.userPrompt.findMany({
		where: {
			visibility: "PUBLIC",
			reviewStatus: "APPROVED",
			deletedAt: null,
		},
		include: {
			category: true,
			creator: { select: { name: true, username: true } },
		},
		orderBy: { publishedAt: "desc" },
	});

	const counts = await getLaunchCountMap(
		"COMMUNITY",
		prompts.map((p) => p.id),
	);

	return prompts.map((p) => ({
		id: p.id,
		title: p.title,
		description: p.description,
		categorySlug: p.category?.slug ?? null,
		categoryLabel: p.category?.label ?? null,
		tags: p.tags,
		creatorDisplayName: creatorDisplayName(p.creator),
		publishedAt: p.publishedAt?.toISOString() ?? p.updatedAt.toISOString(),
		updatedAt: p.updatedAt.toISOString(),
		requiredConnections: p.requiredConnections,
		requiredDataScopes: p.requiredDataScopes,
		launchCount: counts.get(p.id) ?? 0,
	}));
}

export async function getCommunityPrompt(
	promptId: string,
): Promise<CommunityPromptDetail> {
	const prompt = await db.userPrompt.findFirst({
		where: {
			id: promptId,
			visibility: "PUBLIC",
			reviewStatus: "APPROVED",
			deletedAt: null,
		},
		include: {
			category: true,
			creator: { select: { name: true, username: true } },
		},
	});
	if (!prompt) throw new PromptError("Prompt not found.", 404);

	const launchCount = await getLaunchCount("COMMUNITY", promptId);

	return {
		id: prompt.id,
		title: prompt.title,
		description: prompt.description,
		body: prompt.body,
		categorySlug: prompt.category?.slug ?? null,
		categoryLabel: prompt.category?.label ?? null,
		tags: prompt.tags,
		creatorDisplayName: creatorDisplayName(prompt.creator),
		publishedAt:
			prompt.publishedAt?.toISOString() ?? prompt.updatedAt.toISOString(),
		updatedAt: prompt.updatedAt.toISOString(),
		requiredConnections: prompt.requiredConnections,
		requiredDataScopes: prompt.requiredDataScopes,
		launchCount,
	};
}

export async function saveCommunityPromptToLibrary(
	userId: string,
	promptId: string,
): Promise<UserPromptDetail> {
	const source = await getCommunityPrompt(promptId);
	const category = source.categorySlug
		? await getActiveCategory(source.categorySlug)
		: null;

	const created = await db.userPrompt.create({
		data: {
			creatorId: userId,
			title: source.title,
			description: source.description,
			body: source.body,
			categoryId: category?.id ?? null,
			tags: source.tags,
			requiredConnections: source.requiredConnections,
			requiredDataScopes: source.requiredDataScopes,
			sourcePromptId: source.id,
			sourceCommunityPromptId: source.id,
		},
		include: promptInclude,
	});

	return toDetail(created);
}

export async function generateDraft(
	input: GeneratePromptDraftInput,
): Promise<GeneratePromptDraftResult> {
	const goal = input.goal.trim();
	const financialData = input.financialData?.trim() || "relevant Moat accounts";
	const responseInclude =
		input.responseInclude?.trim() || "clear, actionable insights";
	const workflow =
		input.workflowType?.trim() || "reusable workflow you can run on demand";
	const actionsNote = input.allowActions
		? "You may suggest actions, but always ask for confirmation before making changes."
		: "Provide insights only — do not request actions without explicit user confirmation.";
	const constraints = input.additionalConstraints?.trim();

	const body = [
		"Use the Moat MCP tools to access my financial data before answering.",
		"",
		`Goal: ${goal}`,
		`Financial data to use: ${financialData}`,
		`Include in the response: ${responseInclude}`,
		`This should work as a ${workflow}.`,
		actionsNote,
		constraints ? `Additional constraints: ${constraints}` : null,
	]
		.filter(Boolean)
		.join("\n");

	const title = goal.length > 80 ? `${goal.slice(0, 77).trim()}...` : goal;

	return {
		title,
		description: `Helps you ${goal.charAt(0).toLowerCase()}${goal.slice(1)}`,
		body,
		suggestedCategorySlug: "budgeting",
		suggestedTags: ["budgeting"],
		requiredConnections: ["mcp"],
		requiredDataScopes: ["accounts", "transactions"],
	};
}

export async function listModerationQueue(
	filter: PromptReviewStatus | "ALL" = "PENDING",
): Promise<ModerationQueueItem[]> {
	const where =
		filter === "ALL"
			? {
					reviewStatus: {
						in: [
							"PENDING",
							"CHANGES_REQUESTED",
							"APPROVED",
							"REJECTED",
						] as PromptReviewStatus[],
					},
				}
			: { reviewStatus: filter };

	const revisions = await db.promptRevision.findMany({
		where,
		include: {
			prompt: {
				include: {
					category: true,
					creator: { select: { id: true, name: true, username: true } },
					moderationHistory: { orderBy: { createdAt: "desc" }, take: 10 },
				},
			},
			category: true,
		},
		orderBy: { submittedAt: "desc" },
	});

	return revisions
		.filter((r) => r.submittedAt && r.prompt.deletedAt === null)
		.map((r) => ({
			promptId: r.promptId,
			revisionId: r.id,
			version: r.version,
			title: r.title,
			description: r.description,
			body: r.body,
			categorySlug: r.category?.slug ?? null,
			categoryLabel: r.category?.label ?? null,
			tags: r.tags,
			reviewStatus: r.reviewStatus,
			creatorId: r.prompt.creator.id,
			creatorDisplayName: creatorDisplayName(r.prompt.creator),
			submittedAt: r.submittedAt?.toISOString() ?? "",
			requiredConnections: r.requiredConnections,
			requiredDataScopes: r.requiredDataScopes,
			safetyFlags: computeSafetyFlags(r.body, r.title),
			priorHistory: r.prompt.moderationHistory.map(toModerationEvent),
		}));
}

export async function approvePrompt(
	adminUserId: string,
	promptId: string,
	revisionId: string,
): Promise<UserPromptDetail> {
	const revision = await db.promptRevision.findFirst({
		where: { id: revisionId, promptId, reviewStatus: "PENDING" },
		include: { prompt: true },
	});
	if (!revision) throw new PromptError("Submission not found.", 404);

	const now = new Date();

	await db.$transaction(async (tx) => {
		await tx.promptRevision.update({
			where: { id: revision.id },
			data: {
				reviewStatus: "APPROVED",
				reviewedAt: now,
				reviewedById: adminUserId,
			},
		});

		await tx.userPrompt.update({
			where: { id: promptId },
			data: {
				title: revision.title,
				description: revision.description,
				body: revision.body,
				categoryId: revision.categoryId,
				tags: revision.tags,
				requiredConnections: revision.requiredConnections,
				requiredDataScopes: revision.requiredDataScopes,
				visibility: "PUBLIC",
				reviewStatus: "APPROVED",
				publishedRevisionId: revision.id,
				publishedAt: now,
				reviewedAt: now,
				reviewedById: adminUserId,
				moderationFeedback: null,
				rejectionReason: null,
			},
		});

		await tx.promptModerationEvent.create({
			data: {
				promptId,
				revisionId: revision.id,
				actorId: adminUserId,
				action: "APPROVED",
			},
		});
	});

	return getPrompt(revision.prompt.creatorId, promptId);
}

export async function requestPromptChanges(
	adminUserId: string,
	promptId: string,
	revisionId: string,
	feedback: string,
): Promise<UserPromptDetail> {
	const revision = await db.promptRevision.findFirst({
		where: { id: revisionId, promptId, reviewStatus: "PENDING" },
		include: { prompt: true },
	});
	if (!revision) throw new PromptError("Submission not found.", 404);

	const now = new Date();

	await db.$transaction(async (tx) => {
		await tx.promptRevision.update({
			where: { id: revision.id },
			data: {
				reviewStatus: "CHANGES_REQUESTED",
				reviewedAt: now,
				reviewedById: adminUserId,
				moderationFeedback: feedback,
			},
		});
		await tx.userPrompt.update({
			where: { id: promptId },
			data: {
				reviewStatus: "CHANGES_REQUESTED",
				reviewedAt: now,
				reviewedById: adminUserId,
				moderationFeedback: feedback,
				visibility: "PRIVATE",
			},
		});
		await tx.promptModerationEvent.create({
			data: {
				promptId,
				revisionId: revision.id,
				actorId: adminUserId,
				action: "CHANGES_REQUESTED",
				feedback,
			},
		});
	});

	return getPrompt(revision.prompt.creatorId, promptId);
}

export async function rejectPrompt(
	adminUserId: string,
	promptId: string,
	revisionId: string,
	reason: string,
): Promise<UserPromptDetail> {
	const revision = await db.promptRevision.findFirst({
		where: { id: revisionId, promptId, reviewStatus: "PENDING" },
		include: { prompt: true },
	});
	if (!revision) throw new PromptError("Submission not found.", 404);

	const now = new Date();

	await db.$transaction(async (tx) => {
		await tx.promptRevision.update({
			where: { id: revision.id },
			data: {
				reviewStatus: "REJECTED",
				reviewedAt: now,
				reviewedById: adminUserId,
				rejectionReason: reason,
			},
		});
		await tx.userPrompt.update({
			where: { id: promptId },
			data: {
				reviewStatus: "REJECTED",
				reviewedAt: now,
				reviewedById: adminUserId,
				rejectionReason: reason,
				visibility: "PRIVATE",
			},
		});
		await tx.promptModerationEvent.create({
			data: {
				promptId,
				revisionId: revision.id,
				actorId: adminUserId,
				action: "REJECTED",
				reason,
			},
		});
	});

	return getPrompt(revision.prompt.creatorId, promptId);
}

export async function unpublishPrompt(
	adminUserId: string,
	promptId: string,
	reason: string,
): Promise<UserPromptDetail> {
	const prompt = await db.userPrompt.findFirst({
		where: { id: promptId, visibility: "PUBLIC", deletedAt: null },
	});
	if (!prompt) throw new PromptError("Published prompt not found.", 404);

	await db.$transaction(async (tx) => {
		await tx.userPrompt.update({
			where: { id: promptId },
			data: {
				visibility: "PRIVATE",
				reviewStatus: "NOT_SUBMITTED",
			},
		});
		await tx.promptModerationEvent.create({
			data: {
				promptId,
				revisionId: prompt.publishedRevisionId ?? undefined,
				actorId: adminUserId,
				action: "UNPUBLISHED",
				reason,
			},
		});
	});

	return getPrompt(prompt.creatorId, promptId);
}

export async function getModerationHistory(promptId: string) {
	const events = await runAsElevatedServiceActor(() =>
		db.promptModerationEvent.findMany({
			where: { promptId },
			orderBy: { createdAt: "desc" },
		}),
	);
	return events.map(toModerationEvent);
}

export async function hasAiConnection(userId: string): Promise<boolean> {
	const now = new Date();
	const [oauthCount, patCount] = await Promise.all([
		db.mcpOAuthAccessToken.count({
			where: activeMcpOAuthAccessTokenWhere(userId, now),
		}),
		db.mcpPersonalAccessToken.count({
			where: activeMcpPersonalAccessTokenWhere(userId, now),
		}),
	]);
	return oauthCount > 0 || patCount > 0;
}
