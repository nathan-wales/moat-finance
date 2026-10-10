import {
	resolveSplitLegTimelineDates,
	type SplitTransactionInput,
} from "@moat/contracts";
import { splitAmountsMatchOriginal } from "@moat/domain";
import { Prisma } from "../../../generated/prisma";
import type { ApiContext } from "../api-context";
import { createApiError } from "../api-context";
import type { ResolvedCategoryMatch } from "./category.service";
import {
	findCategoryByDisplayName,
	presentCategoryRef,
} from "./category.service";

type SplitClientDb = Pick<
	ApiContext["db"],
	| "transaction"
	| "category"
	| "categoryOverride"
	| "hashtag"
	| "transactionHashtag"
>;

type SplitDb = SplitClientDb & {
	$transaction: ApiContext["db"]["$transaction"];
};

type TransactionWriteDb = Pick<
	SplitClientDb,
	"category" | "categoryOverride" | "hashtag" | "transactionHashtag"
>;

function toMoneyDecimal(value: number) {
	return new Prisma.Decimal(value.toFixed(2));
}

function normalizeHashtag(name: string) {
	return name.replace(/^#/, "").toLowerCase().trim();
}

function displayHashtag(name: string) {
	return name.replace(/^#/, "").trim();
}

function normalizeNotes(notes: string | null | undefined): string | null {
	if (notes == null) return null;
	const trimmed = notes.trim();
	return trimmed.length > 0 ? trimmed : null;
}

async function findOrCreateCategory(
	db: TransactionWriteDb,
	userId: string,
	categoryName: string,
): Promise<ResolvedCategoryMatch> {
	const trimmedName = categoryName.trim();
	const existing = await findCategoryByDisplayName(db, userId, trimmedName);
	if (existing) return existing;

	const created = await db.category.create({
		data: { userId, name: trimmedName },
	});
	return {
		id: created.id,
		userId: created.userId,
		name: created.name,
		displayName: created.name,
	};
}

async function setTransactionHashtags(
	db: TransactionWriteDb,
	userId: string,
	transactionId: string,
	hashtags: string[],
) {
	const names = hashtags.map((name) => displayHashtag(name)).filter(Boolean);
	const hashtagIds: string[] = [];

	for (const name of names) {
		const normalizedName = normalizeHashtag(name);
		const hashtag = await db.hashtag.upsert({
			where: { userId_normalizedName: { userId, normalizedName } },
			create: { userId, name, normalizedName },
			update: {},
		});
		hashtagIds.push(hashtag.id);
	}

	await db.transactionHashtag.deleteMany({
		where: { transactionId },
	});

	if (hashtagIds.length === 0) return;

	await db.transactionHashtag.createMany({
		data: hashtagIds.map((hashtagId) => ({
			transactionId,
			hashtagId,
		})),
		skipDuplicates: true,
	});
}

function categoryRefInclude(userId: string) {
	return {
		include: { overrides: { where: { userId } } },
	};
}

function mapSplitTransaction<
	T extends {
		amount: { toNumber(): number } | number;
		category: string;
		account: string | null;
		categoryRef: {
			id: string;
			name: string;
			icon?: string | null;
			color?: string | null;
			isHidden: boolean;
			isDefault: boolean;
			overrides?: Array<{
				name: string | null;
				icon: string | null;
				color?: string | null;
				isHidden: boolean | null;
				isRemoved: boolean;
			}>;
		} | null;
		plaidAccount: { name: string } | null;
	},
>(tx: T) {
	const categoryRef = presentCategoryRef(tx.categoryRef);
	return {
		...tx,
		amount: Number(tx.amount),
		category: categoryRef?.name ?? tx.category,
		categoryRef,
		account: tx.account ?? tx.plaidAccount?.name ?? null,
		plaidAccount: undefined,
	};
}

async function loadGroup(
	tx: SplitClientDb,
	userId: string,
	transactionId: string,
) {
	const transaction = await tx.transaction.findFirst({
		where: { id: transactionId, userId },
	});
	if (!transaction) throw createApiError("Transaction not found", 404);
	if (!transaction.splitGroupId) {
		throw createApiError("Transaction is not split", 400);
	}

	const group = await tx.transaction.findMany({
		where: { userId, splitGroupId: transaction.splitGroupId },
		orderBy: { createdAt: "asc" },
		include: {
			hashtags: { include: { hashtag: true } },
			categoryRef: categoryRefInclude(userId),
			plaidAccount: { select: { name: true } },
		},
	});

	const parent =
		group.find((item) => !item.splitParentId) ??
		group.find((item) => item.id === transaction.splitGroupId);
	if (!parent) throw createApiError("Split parent transaction not found", 400);

	const children = group.filter((item) => item.id !== parent.id);
	return { parent, children };
}

function assertValidLegs(
	originalAmount: number,
	legs: SplitTransactionInput["legs"],
) {
	if (legs.length < 2) {
		throw createApiError("A split needs at least two legs", 400);
	}
	for (const leg of legs) {
		if (leg.amount <= 0) {
			throw createApiError("Split amounts must be greater than zero", 400);
		}
		if (!leg.description.trim() || !leg.categoryName.trim()) {
			throw createApiError("Each split needs a name and category", 400);
		}
	}
	if (!splitAmountsMatchOriginal(originalAmount, legs)) {
		throw createApiError(
			"Split amounts must add up to the original amount",
			400,
		);
	}
}

function childCreateData(
	parent: {
		id: string;
		userId: string;
		date: Date;
		postedDate: Date | null;
		authorizedDate: Date | null;
		isoCurrencyCode: string | null;
		unofficialCurrencyCode: string | null;
		originalDescription: string | null;
		merchantName: string | null;
		account: string | null;
		paymentChannel: string | null;
		plaidAccountId: string | null;
		plaidItemId: string | null;
		appleFinanceKitAccountId: string | null;
		financialConnectionId: string | null;
		financialAccountId: string | null;
		dataProvider: Prisma.TransactionUncheckedCreateInput["dataProvider"];
		providerAccountId: string | null;
		sourceAccountId: string | null;
		importBatchId: string | null;
		location: Prisma.JsonValue | null;
		raw: Prisma.JsonValue | null;
		appliedRuleId: string | null;
	},
	leg: SplitTransactionInput["legs"][number],
	type: SplitTransactionInput["type"],
	category: ResolvedCategoryMatch,
	splitOriginalAmount: Prisma.Decimal,
) {
	const timeline = resolveSplitLegTimelineDates(parent, leg.date);
	return {
		userId: parent.userId,
		date: timeline.date,
		postedDate: timeline.postedDate,
		authorizedDate: parent.authorizedDate,
		amount: toMoneyDecimal(leg.amount),
		isoCurrencyCode: parent.isoCurrencyCode,
		unofficialCurrencyCode: parent.unofficialCurrencyCode,
		type,
		category: category.name,
		categoryId: category.id,
		description: leg.description.trim(),
		originalDescription: parent.originalDescription,
		notes: normalizeNotes(leg.notes),
		merchantName: parent.merchantName,
		account: parent.account,
		paymentChannel: parent.paymentChannel,
		source: "MANUAL" as const,
		plaidAccountId: parent.plaidAccountId,
		plaidItemId: parent.plaidItemId,
		appleFinanceKitAccountId: parent.appleFinanceKitAccountId,
		financialConnectionId: parent.financialConnectionId,
		financialAccountId: parent.financialAccountId,
		dataProvider: parent.dataProvider,
		providerAccountId: parent.providerAccountId,
		sourceAccountId: parent.sourceAccountId,
		importBatchId: parent.importBatchId,
		pending: false,
		hidden: leg.hidden === true,
		location: parent.location ?? undefined,
		raw: parent.raw ?? undefined,
		appliedRuleId: parent.appliedRuleId,
		splitGroupId: parent.id,
		splitParentId: parent.id,
		splitOriginalAmount,
	};
}

export const transactionSplitService = {
	async split(db: SplitDb, userId: string, input: SplitTransactionInput) {
		return db.$transaction(async (tx) => {
			const transaction = await tx.transaction.findFirst({
				where: { id: input.id, userId },
			});
			if (!transaction) throw createApiError("Transaction not found", 404);
			if (transaction.splitGroupId) {
				throw createApiError("Transaction has already been split", 400);
			}
			if (transaction.source === "PLAID" && transaction.pending) {
				throw createApiError("Pending Plaid transactions cannot be split", 400);
			}

			const originalAmount = Number(transaction.amount);
			assertValidLegs(originalAmount, input.legs);
			const splitOriginalAmount = toMoneyDecimal(originalAmount);

			await tx.transaction.update({
				where: { id: transaction.id },
				data: {
					splitGroupId: transaction.id,
					splitParentId: null,
					splitOriginalAmount,
				},
			});

			const splitIds: string[] = [];
			for (const leg of input.legs) {
				const category = await findOrCreateCategory(
					tx,
					userId,
					leg.categoryName,
				);
				const created = await tx.transaction.create({
					data: childCreateData(
						transaction,
						leg,
						input.type,
						category,
						splitOriginalAmount,
					),
				});
				await setTransactionHashtags(tx, userId, created.id, leg.hashtags);
				splitIds.push(created.id);
			}

			return { originalId: transaction.id, splitIds };
		});
	},

	async updateSplit(db: SplitDb, userId: string, input: SplitTransactionInput) {
		return db.$transaction(async (tx) => {
			const { parent, children } = await loadGroup(tx, userId, input.id);
			const originalAmount = Number(
				parent.splitOriginalAmount ?? parent.amount,
			);
			assertValidLegs(originalAmount, input.legs);

			const splitOriginalAmount = toMoneyDecimal(originalAmount);
			const incomingIds = new Set(
				input.legs.map((leg) => leg.id).filter((id): id is string => !!id),
			);
			const existingById = new Map(children.map((child) => [child.id, child]));

			for (const id of incomingIds) {
				if (!existingById.has(id)) {
					throw createApiError("Split leg was not found", 400);
				}
			}

			const removedIds = children
				.filter((child) => !incomingIds.has(child.id))
				.map((child) => child.id);
			if (removedIds.length > 0) {
				await tx.transaction.deleteMany({
					where: { id: { in: removedIds }, userId },
				});
			}

			await tx.transaction.update({
				where: { id: parent.id },
				data: {
					type: input.type,
					splitOriginalAmount,
				},
			});

			const splitIds: string[] = [];
			for (const leg of input.legs) {
				const category = await findOrCreateCategory(
					tx,
					userId,
					leg.categoryName,
				);
				if (leg.id) {
					const timeline = resolveSplitLegTimelineDates(parent, leg.date);
					await tx.transaction.update({
						where: { id: leg.id },
						data: {
							description: leg.description.trim(),
							amount: toMoneyDecimal(leg.amount),
							type: input.type,
							category: category.name,
							categoryId: category.id,
							notes: normalizeNotes(leg.notes),
							hidden: leg.hidden === true,
							splitOriginalAmount,
							...(leg.date
								? {
										date: timeline.date,
										postedDate: timeline.postedDate,
									}
								: {}),
						},
					});
					await setTransactionHashtags(tx, userId, leg.id, leg.hashtags);
					splitIds.push(leg.id);
					continue;
				}

				const created = await tx.transaction.create({
					data: childCreateData(
						parent,
						leg,
						input.type,
						category,
						splitOriginalAmount,
					),
				});
				await setTransactionHashtags(tx, userId, created.id, leg.hashtags);
				splitIds.push(created.id);
			}

			return { originalId: parent.id, splitIds };
		});
	},

	async unsplit(db: SplitDb, userId: string, id: string) {
		return db.$transaction(async (tx) => {
			const { parent, children } = await loadGroup(tx, userId, id);
			const restoredAmount = toMoneyDecimal(
				Number(parent.splitOriginalAmount ?? parent.amount),
			);
			const removedIds = children.map((child) => child.id);

			const restored = await tx.transaction.update({
				where: { id: parent.id },
				data: {
					amount: restoredAmount,
					splitGroupId: null,
					splitParentId: null,
					splitOriginalAmount: null,
				},
			});

			if (removedIds.length > 0) {
				await tx.transaction.deleteMany({
					where: { id: { in: removedIds }, userId },
				});
			}

			return { restoredId: restored.id, removedIds };
		});
	},

	async getSplitGroup(db: SplitDb, userId: string, id: string) {
		const { parent, children } = await loadGroup(db, userId, id);
		return {
			original: mapSplitTransaction(parent),
			legs: children.map((child) => mapSplitTransaction(child)),
		};
	},
};
