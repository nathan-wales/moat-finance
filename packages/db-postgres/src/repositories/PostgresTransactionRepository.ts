import { randomUUID } from "node:crypto";
import type {
	CreateTransactionInput,
	DashboardTransaction,
	PaginatedTransactions,
	TransactionListQuery,
	TransactionRepository,
	TransactionSummary,
	TransactionSummaryInput,
	UpdateTransactionInput,
} from "@moat/data-access";
import {
	emptyTransactionSummary,
	pageIdsByAmountSort,
	sortRowsByIdOrder,
	summarizeTransactions,
} from "@moat/domain";
import { splitParentExclusionWhere } from "@moat/data-access";
import type { DbClient } from "../db-client";

type TransactionRow = {
	id: string;
	userId?: string;
	date: Date;
	postedDate: Date | null;
	description: string | null;
	originalDescription: string | null;
	merchantName: string | null;
	amount: { toNumber(): number } | number;
	type: string;
	category: string;
	account: string | null;
	categoryRef: {
		name: string;
		isHidden?: boolean;
		isDefault?: boolean;
		overrides?: Array<{
			userId: string;
			name: string | null;
			isHidden: boolean | null;
			isRemoved: boolean;
		}>;
	} | null;
	plaidAccount: { name: string } | null;
	hashtags?: { hashtag: { name: string } }[];
	location?: unknown;
	hidden?: boolean;
	splitGroupId?: string | null;
	splitParentId?: string | null;
};

type TransactionWhereInput = {
	userId: string;
	search?: string;
	category?: string;
	hashtag?: string;
	accountId?: string;
	accountIds?: string[];
	minAmount?: number;
	maxAmount?: number;
	startDate?: Date;
	endDate?: Date;
	type?: string;
};

function resolveAccountIds(input: {
	accountId?: string;
	accountIds?: string[];
}): string[] {
	const ids = [...(input.accountIds ?? [])];
	if (input.accountId?.trim()) {
		ids.push(input.accountId.trim());
	}
	return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function toAmount(value: { toNumber(): number } | number): number {
	if (typeof value === "number") return value;
	return value.toNumber();
}

function normalizeHashtag(name: string): string {
	return name.replace(/^#/, "").toLowerCase().trim();
}

function displayHashtag(name: string): string {
	return name.replace(/^#/, "").trim();
}

function parseTransactionLocation(
	value: unknown,
): DashboardTransaction["location"] {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const parsed = value as Record<string, unknown>;
	return {
		address: typeof parsed.address === "string" ? parsed.address : null,
		city: typeof parsed.city === "string" ? parsed.city : null,
		region: typeof parsed.region === "string" ? parsed.region : null,
		postal_code:
			typeof parsed.postal_code === "string" ? parsed.postal_code : null,
		country: typeof parsed.country === "string" ? parsed.country : null,
		lat: typeof parsed.lat === "number" ? parsed.lat : null,
		lon: typeof parsed.lon === "number" ? parsed.lon : null,
		store_number:
			typeof parsed.store_number === "string" ? parsed.store_number : null,
	};
}

function mapRow(row: TransactionRow): DashboardTransaction {
	const override = row.categoryRef?.overrides?.[0];
	const categoryName =
		override?.name ?? row.categoryRef?.name ?? row.category ?? "Uncategorized";
	return {
		id: row.id,
		date: row.postedDate ?? row.date,
		description: row.description ?? row.merchantName,
		originalDescription: row.originalDescription ?? null,
		amount: toAmount(row.amount),
		type: row.type as "INCOME" | "EXPENSE",
		category: categoryName,
		account: row.account ?? row.plaidAccount?.name ?? null,
		hashtags: row.hashtags?.map((entry) => entry.hashtag.name) ?? [],
		location: parseTransactionLocation(row.location),
		splitGroupId: row.splitGroupId ?? null,
		splitParentId: row.splitParentId ?? null,
		hidden: row.hidden ?? false,
	};
}

function buildTransactionWhere(input: TransactionWhereInput) {
	// biome-ignore lint/suspicious/noExplicitAny: Prisma where builder for structural DbClient
	const where: any = {
		userId: input.userId,
		hidden: false,
		removedAt: null,
		NOT: {
			OR: [
				{
					categoryRef: {
						overrides: {
							some: {
								userId: input.userId,
								OR: [{ isHidden: true }, { isRemoved: true }],
							},
						},
					},
				},
				{
					AND: [
						{ categoryRef: { isHidden: true } },
						{
							categoryRef: {
								overrides: { none: { userId: input.userId, isHidden: false } },
							},
						},
					],
				},
			],
		},
	};

	const andClauses: unknown[] = [splitParentExclusionWhere()];

	if (input.search) {
		andClauses.push({
			description: { contains: input.search, mode: "insensitive" },
		});
	}
	if (input.type) where.type = input.type;
	if (input.startDate || input.endDate) {
		where.date = {
			...(input.startDate ? { gte: input.startDate } : {}),
			...(input.endDate ? { lte: input.endDate } : {}),
		};
	}
	if (input.category) {
		andClauses.push({
			OR: [
				{
					categoryRef: {
						name: { equals: input.category, mode: "insensitive" },
					},
				},
				{
					categoryRef: {
						overrides: {
							some: {
								userId: input.userId,
								name: { equals: input.category, mode: "insensitive" },
							},
						},
					},
				},
				{
					categoryId: null,
					category: { equals: input.category, mode: "insensitive" },
				},
			],
		});
	}
	if (input.minAmount !== undefined || input.maxAmount !== undefined) {
		where.amount = {
			...(input.minAmount !== undefined ? { gte: input.minAmount } : {}),
			...(input.maxAmount !== undefined ? { lte: input.maxAmount } : {}),
		};
	}
	const accountIds = resolveAccountIds(input);
	if (accountIds.length > 0) {
		where.plaidAccountId = { in: accountIds };
	}
	if (andClauses.length > 0) where.AND = andClauses;

	return where;
}

/**
 * Default categories are shared across every user, so the override relation
 * must be filtered to the caller — otherwise a single global category drags in
 * every other user's overlay rows.
 */
function transactionSelect(userId: string) {
	return {
		id: true,
		userId: true,
		date: true,
		postedDate: true,
		description: true,
		originalDescription: true,
		merchantName: true,
		location: true,
		amount: true,
		type: true,
		category: true,
		account: true,
		categoryRef: {
			select: {
				name: true,
				isDefault: true,
				isHidden: true,
				overrides: {
					where: { userId },
					select: { name: true, isHidden: true, isRemoved: true, userId: true },
				},
			},
		},
		plaidAccount: { select: { name: true } },
		hashtags: { include: { hashtag: { select: { name: true } } } },
		hidden: true,
		splitGroupId: true,
		splitParentId: true,
	};
}

export class PostgresTransactionRepository implements TransactionRepository {
	constructor(private db: DbClient) {}

	private async getTransactionIdsByHashtag(input: {
		userId: string;
		hashtag: string;
	}): Promise<string[]> {
		const normalizedName = normalizeHashtag(input.hashtag);
		if (!normalizedName) return [];

		const rows = (await this.db.transaction.findMany({
			where: {
				userId: input.userId,
				hashtags: {
					some: {
						hashtag: { normalizedName },
					},
				},
			},
			select: { id: true },
		})) as { id: string }[];

		return rows.map((row) => row.id);
	}

	async listRecent(input: {
		userId: string;
		limit: number;
		startDate?: Date;
		endDate?: Date;
	}): Promise<DashboardTransaction[]> {
		const where = buildTransactionWhere({
			userId: input.userId,
			startDate: input.startDate,
			endDate: input.endDate,
		});

		const rows = (await this.db.transaction.findMany({
			where,
			orderBy: [{ postedDate: "desc" }, { date: "desc" }],
			take: input.limit,
			select: transactionSelect(input.userId),
		})) as TransactionRow[];

		return rows.map(mapRow);
	}

	async findById(input: {
		userId: string;
		transactionId: string;
	}): Promise<DashboardTransaction | null> {
		const row = (await this.db.transaction.findFirst({
			where: {
				id: input.transactionId,
				userId: input.userId,
			},
			select: transactionSelect(input.userId),
		})) as TransactionRow | null;

		if (!row) return null;
		return mapRow(row);
	}

	async listPaginated(
		input: { userId: string } & TransactionListQuery,
	): Promise<PaginatedTransactions> {
		const {
			userId,
			cursor = 0,
			limit = 50,
			search,
			category,
			hashtag,
			accountId,
			accountIds,
			minAmount,
			maxAmount,
			startDate,
			endDate,
			type,
			sortField = "date",
			sortDir = "desc",
		} = input;

		const hashtagTransactionIds = hashtag
			? await this.getTransactionIdsByHashtag({ userId, hashtag })
			: null;
		if (hashtagTransactionIds && hashtagTransactionIds.length === 0) {
			return { items: [], nextCursor: null, total: 0 };
		}

		const where = buildTransactionWhere({
			userId,
			search,
			category,
			hashtag,
			accountId,
			accountIds,
			minAmount,
			maxAmount,
			startDate,
			endDate,
			type,
		});
		if (hashtagTransactionIds) where.id = { in: hashtagTransactionIds };

		let rows: TransactionRow[];
		let total: number;

		if (sortField === "amount") {
			const [count, sortKeys] = await Promise.all([
				this.db.transaction.count({ where }),
				this.db.transaction.findMany({
					where,
					select: { id: true, type: true, amount: true },
				}) as Promise<
					Array<{
						id: string;
						type: string;
						amount: { toNumber(): number } | number;
					}>
				>,
			]);
			total = count;
			const pageIds = pageIdsByAmountSort(
				sortKeys.map((row) => ({
					id: row.id,
					type: row.type,
					amount: toAmount(row.amount),
				})),
				sortDir,
				cursor,
				limit,
			);
			if (pageIds.length === 0) {
				return { items: [], nextCursor: null, total };
			}
			const unordered = (await this.db.transaction.findMany({
				where: { id: { in: pageIds } },
				select: transactionSelect(userId),
			})) as TransactionRow[];
			rows = sortRowsByIdOrder(unordered, pageIds);
		} else {
			const orderBy =
				sortField === "account" ? { account: sortDir } : { date: sortDir };
			const [count, listed] = await Promise.all([
				this.db.transaction.count({ where }),
				this.db.transaction.findMany({
					where,
					select: transactionSelect(userId),
					orderBy,
					skip: cursor,
					take: limit,
				}),
			]);
			total = count;
			rows = listed as TransactionRow[];
		}

		const items = rows.map(mapRow);
		const nextOffset = cursor + items.length;

		return {
			items,
			nextCursor: nextOffset < total ? nextOffset : null,
			total,
		};
	}

	async count(input: {
		userId: string;
		search?: string;
		category?: string;
		hashtag?: string;
		accountId?: string;
		accountIds?: string[];
		minAmount?: number;
		maxAmount?: number;
		startDate?: Date;
		endDate?: Date;
		type?: string;
	}): Promise<number> {
		const hashtagTransactionIds = input.hashtag
			? await this.getTransactionIdsByHashtag({
					userId: input.userId,
					hashtag: input.hashtag,
				})
			: null;
		if (hashtagTransactionIds && hashtagTransactionIds.length === 0) return 0;

		const where = buildTransactionWhere(input);
		if (hashtagTransactionIds) where.id = { in: hashtagTransactionIds };
		return this.db.transaction.count({ where });
	}

	async getSummary(
		input: { userId: string } & TransactionSummaryInput,
	): Promise<TransactionSummary> {
		const hashtagTransactionIds = input.hashtag
			? await this.getTransactionIdsByHashtag({
					userId: input.userId,
					hashtag: input.hashtag,
				})
			: null;
		if (hashtagTransactionIds && hashtagTransactionIds.length === 0) {
			return emptyTransactionSummary();
		}

		const where = buildTransactionWhere(input);
		if (hashtagTransactionIds) where.id = { in: hashtagTransactionIds };

		const rows = (await this.db.transaction.findMany({
			where,
			select: { id: true, amount: true, type: true, date: true },
		})) as {
			id: string;
			amount: { toNumber(): number } | number;
			type: string;
			date: Date;
		}[];

		return summarizeTransactions(
			rows.map((row) => ({
				id: row.id,
				amount: toAmount(row.amount),
				type: row.type,
				date: row.date,
			})),
		);
	}

	async createMany(input: {
		userId: string;
		transactions: CreateTransactionInput[];
	}): Promise<number> {
		const { userId, transactions } = input;
		const result = await this.db.transaction.createMany({
			data: transactions.map((transaction) => ({
				id: transaction.id ?? randomUUID(),
				userId,
				account: null,
				plaidAccountId: transaction.accountId ?? null,
				categoryId: transaction.categoryId ?? null,
				date: transaction.date,
				postedDate: transaction.postedDate ?? null,
				amount: transaction.amount,
				type: transaction.type,
				description: transaction.description ?? null,
				originalDescription: transaction.originalDescription ?? null,
				merchantName: transaction.merchantName ?? null,
				source: transaction.source ?? "CSV",
				dedupeFingerprint: transaction.dedupeFingerprint ?? null,
			})),
		});
		return result.count;
	}

	async findFingerprints(input: {
		userId: string;
		fingerprints: string[];
	}): Promise<string[]> {
		const unique = [...new Set(input.fingerprints.filter(Boolean))];
		if (unique.length === 0) return [];

		const found = new Set<string>();
		for (let i = 0; i < unique.length; i += 400) {
			const chunk = unique.slice(i, i + 400);
			const rows = (await this.db.transaction.findMany({
				where: {
					userId: input.userId,
					removedAt: null,
					dedupeFingerprint: { in: chunk },
				},
				select: { dedupeFingerprint: true },
			})) as Array<{ dedupeFingerprint: string | null }>;
			for (const row of rows) {
				if (row.dedupeFingerprint) found.add(row.dedupeFingerprint);
			}
		}
		return [...found];
	}

	async findAccountFingerprint(input: {
		userId: string;
		accountId: string;
	}): Promise<string | null> {
		const row = (await this.db.transaction.findFirst({
			where: {
				userId: input.userId,
				plaidAccountId: input.accountId,
				accountFingerprint: { not: null },
			},
			select: { accountFingerprint: true },
		})) as { accountFingerprint: string | null } | null;
		return row?.accountFingerprint ?? null;
	}

	async update(input: {
		userId: string;
		transactionId: string;
		data: UpdateTransactionInput;
	}): Promise<DashboardTransaction | null> {
		const { userId, transactionId, data } = input;
		let resolvedCategoryId = data.categoryId;

		if (data.categoryName !== undefined) {
			const trimmedCategoryName = data.categoryName?.trim();
			if (!trimmedCategoryName) {
				resolvedCategoryId = null;
			} else {
				const existing = (await this.db.category.findFirst({
					where: {
						name: trimmedCategoryName,
						isHidden: false,
						OR: [{ userId: null }, { userId }],
					},
					select: { id: true },
				})) as { id: string } | null;

				if (existing) {
					resolvedCategoryId = existing.id;
				} else {
					const created = (await this.db.category.create({
						data: {
							name: trimmedCategoryName,
							userId,
							isHidden: false,
							sortOrder: 999,
						},
						select: { id: true },
					})) as { id: string };
					resolvedCategoryId = created.id;
				}
			}
		}

		const result = await this.db.transaction.updateMany({
			where: { id: transactionId, userId },
			data: {
				...(data.description !== undefined && {
					description: data.description,
				}),
				...(data.amount !== undefined && { amount: data.amount }),
				...(data.type !== undefined && { type: data.type }),
				...(resolvedCategoryId !== undefined && {
					categoryId: resolvedCategoryId,
				}),
			},
		});
		if (result.count === 0) throw new Error("Transaction not found");

		if (data.hashtags !== undefined) {
			await this.setHashtags({
				userId,
				transactionId,
				hashtags: data.hashtags,
			});
		}

		return this.findById({ userId, transactionId });
	}

	private async findOrCreateHashtag(input: {
		userId: string;
		name: string;
	}): Promise<string> {
		const name = displayHashtag(input.name);
		const normalizedName = normalizeHashtag(name);
		if (!normalizedName) throw new Error("Hashtag name is required");

		const hashtag = (await this.db.hashtag.upsert({
			where: {
				userId_normalizedName: {
					userId: input.userId,
					normalizedName,
				},
			},
			create: {
				userId: input.userId,
				name,
				normalizedName,
			},
			update: {},
			select: { id: true },
		})) as { id: string };

		return hashtag.id;
	}

	async setHashtags(input: {
		userId: string;
		transactionId: string;
		hashtags: string[];
	}): Promise<void> {
		const transaction = await this.db.transaction.findFirst({
			where: { id: input.transactionId, userId: input.userId },
			select: { id: true },
		});
		if (!transaction) throw new Error("Transaction not found");

		const uniqueNames = new Map<string, string>();
		for (const rawName of input.hashtags) {
			const name = displayHashtag(rawName);
			const normalizedName = normalizeHashtag(name);
			if (normalizedName) uniqueNames.set(normalizedName, name);
		}

		const hashtagIds: string[] = [];
		for (const name of uniqueNames.values()) {
			hashtagIds.push(
				await this.findOrCreateHashtag({ userId: input.userId, name }),
			);
		}

		await this.db.transactionHashtag.deleteMany({
			where: { transactionId: input.transactionId },
		});

		if (hashtagIds.length > 0) {
			await this.db.transactionHashtag.createMany({
				data: hashtagIds.map((hashtagId) => ({
					transactionId: input.transactionId,
					hashtagId,
				})),
			});
		}
	}

	async delete(input: {
		userId: string;
		transactionId: string;
	}): Promise<void> {
		const result = await this.db.transaction.deleteMany({
			where: { id: input.transactionId, userId: input.userId },
		});
		if (result.count === 0) throw new Error("Transaction not found");
	}

	async hide(input: { userId: string; transactionId: string }): Promise<void> {
		const result = await this.db.transaction.updateMany({
			where: { id: input.transactionId, userId: input.userId },
			data: { hidden: true },
		});
		if (result.count === 0) throw new Error("Transaction not found");
	}

	async bulkHide(input: {
		userId: string;
		transactionIds: string[];
	}): Promise<number> {
		if (input.transactionIds.length === 0) return 0;
		const result = await this.db.transaction.updateMany({
			where: { id: { in: input.transactionIds }, userId: input.userId },
			data: { hidden: true },
		});
		return result.count;
	}

	async bulkDelete(input: {
		userId: string;
		transactionIds: string[];
	}): Promise<number> {
		const result = await this.db.transaction.deleteMany({
			where: { id: { in: input.transactionIds }, userId: input.userId },
		});
		return result.count;
	}

	async listCategories(input: { userId: string }): Promise<string[]> {
		const rows = await this.db.$queryRaw<{ name: string }[]>`
			SELECT DISTINCT COALESCE(o.name, c.name, t.category) AS name
			FROM "Transaction" t
			LEFT JOIN "Category" c ON c.id = t."categoryId"
			LEFT JOIN "CategoryOverride" o ON o."categoryId" = c.id AND o."userId" = t."userId"
			WHERE t."userId" = ${input.userId}
				AND t.hidden = false
				AND t."removedAt" IS NULL
				AND NOT EXISTS (
					SELECT 1 FROM "Category" hc
					LEFT JOIN "CategoryOverride" ho
						ON ho."categoryId" = hc.id AND ho."userId" = t."userId"
					WHERE hc.id = t."categoryId"
						AND (
							COALESCE(ho."isRemoved", false) = true
							OR COALESCE(ho."isHidden", hc."isHidden") = true
						)
				)
				AND COALESCE(o.name, c.name, t.category) IS NOT NULL
			ORDER BY name
		`;
		return rows.map((row) => row.name);
	}

	async listHashtags(input: { userId: string }): Promise<string[]> {
		const rows = (await this.db.hashtag.findMany({
			where: { userId: input.userId },
			select: { name: true },
			orderBy: { name: "asc" },
		})) as { name: string }[];
		return rows.map((row) => row.name);
	}
}
