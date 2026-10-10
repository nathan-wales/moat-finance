import { randomUUID } from "node:crypto";
import { resolveSplitLegTimelineDates } from "@moat/contracts";
import type {
	CreateTransactionInput,
	DashboardTransaction,
	PaginatedTransactions,
	TransactionListQuery,
	TransactionLocation,
	TransactionRepository,
	TransactionSummary,
	TransactionSummaryInput,
	UpdateTransactionInput,
} from "@moat/data-access";
import { splitParentExclusionWhere } from "@moat/data-access";
import {
	emptyTransactionSummary,
	pageIdsByAmountSort,
	sortRowsByIdOrder,
	splitAmountsMatchOriginal,
	summarizeTransactions,
} from "@moat/domain";
import {
	applyAccountDisplayName,
	loadAccountNameOverrides,
} from "../account-name-overrides";
import type { SqliteDbClient } from "../db-client";
import { TX_EFFECTIVE_MS_SQL } from "./transaction-date-sql";

type TransactionRow = {
	id: string;
	date: Date | string;
	postedDate: Date | string | null;
	amount: number;
	type: string;
	description: string | null;
	merchantName: string | null;
	originalDescription: string | null;
	notes: string | null;
	categoryName: string | null;
	categoryIcon: string | null;
	categoryColor: string | null;
	accountName: string | null;
	plaidAccountDbId: string | null;
	appliedRuleId: string | null;
	amazonRetailEnrichedAt: Date | string | null;
	hidden?: number | boolean;
	splitGroupId?: string | null;
	splitParentId?: string | null;
};

function parseTransactionLocation(
	value: string | null | undefined,
): TransactionLocation | null {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value) as Partial<TransactionLocation>;
		if (!parsed || typeof parsed !== "object") return null;
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
	} catch {
		return null;
	}
}

type HashtagJoinRow = {
	transactionId: string;
	name: string;
};

type TransactionWhereInput = {
	userId: string;
	search?: string;
	category?: string;
	categories?: string[];
	hashtag?: string;
	accountId?: string;
	accountIds?: string[];
	minAmount?: number;
	maxAmount?: number;
	startDate?: Date;
	endDate?: Date;
	type?: string;
	ids?: string[];
	retailLinkedRetailer?: "amazon";
};

function resolveCategoryNames(input: {
	category?: string;
	categories?: string[];
}): string[] {
	const names = [...(input.categories ?? [])];
	if (input.category?.trim()) {
		names.push(input.category.trim());
	}
	return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

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

const SQLITE_IN_CHUNK = 400;

function intersectIds(left: string[], right: string[]): string[] {
	const rightSet = new Set(right);
	return left.filter((id) => rightSet.has(id));
}

function idInConstraint(ids: string[]) {
	const chunks: string[][] = [];
	for (let i = 0; i < ids.length; i += SQLITE_IN_CHUNK) {
		chunks.push(ids.slice(i, i + SQLITE_IN_CHUNK));
	}
	const firstChunk = chunks[0];
	if (chunks.length === 1 && firstChunk) {
		return { id: { in: firstChunk } };
	}
	return { OR: chunks.map((chunk) => ({ id: { in: chunk } })) };
}

function normalizeHashtag(name: string): string {
	return name.replace(/^#/, "").toLowerCase().trim();
}

function displayHashtag(name: string): string {
	return name.replace(/^#/, "").trim();
}

function resolveDate(value: Date | string): Date {
	return value instanceof Date ? value : new Date(value);
}

function resolveOptionalDate(
	value: Date | string | null | undefined,
): Date | null {
	if (value == null) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function resolveAccountName(
	account: { name: string } | null | undefined,
	plaidAccount: { name: string } | null | undefined,
): string | null {
	return account?.name ?? plaidAccount?.name ?? null;
}

function mapRow(
	row: TransactionRow,
	nameOverrides: Map<string, string>,
): DashboardTransaction {
	const effectiveDate = row.postedDate
		? resolveDate(row.postedDate)
		: resolveDate(row.date);

	return {
		id: row.id,
		date: effectiveDate,
		description: row.description ?? row.merchantName,
		originalDescription: row.originalDescription ?? null,
		notes: row.notes ?? null,
		amount: row.amount,
		type: row.type as "INCOME" | "EXPENSE",
		category: row.categoryName ?? "Uncategorized",
		categoryIcon: row.categoryIcon ?? null,
		categoryColor: row.categoryColor ?? null,
		account: applyAccountDisplayName(
			row.accountName,
			row.plaidAccountDbId,
			nameOverrides,
		),
		appliedRuleId: row.appliedRuleId ?? null,
		amazonRetailEnrichedAt: resolveOptionalDate(row.amazonRetailEnrichedAt),
		hidden: Boolean(row.hidden),
		splitGroupId: row.splitGroupId ?? null,
		splitParentId: row.splitParentId ?? null,
	};
}

function buildTransactionWhere(input: TransactionWhereInput) {
	// biome-ignore lint/suspicious/noExplicitAny: Prisma where builder for generated SQLite client
	const where: any = {
		userId: input.userId,
		hidden: false,
		removedAt: null,
	};

	const andClauses: unknown[] = [splitParentExclusionWhere()];

	if (input.search) {
		andClauses.push({
			OR: [
				{ description: { contains: input.search } },
				{ merchantName: { contains: input.search } },
			],
		});
	}
	if (input.type) where.type = input.type;
	const categoryNames = resolveCategoryNames(input);
	if (categoryNames.length === 1) {
		andClauses.push({
			OR: [
				{ category: { name: categoryNames[0] } },
				{
					category: {
						overrides: {
							some: { userId: input.userId, name: categoryNames[0] },
						},
					},
				},
			],
		});
	} else if (categoryNames.length > 1) {
		andClauses.push({
			OR: [
				{ category: { name: { in: categoryNames } } },
				{
					category: {
						overrides: {
							some: { userId: input.userId, name: { in: categoryNames } },
						},
					},
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
		andClauses.push({
			OR: [
				{ accountId: { in: accountIds } },
				{ plaidAccountId: { in: accountIds } },
			],
		});
	}
	if (input.ids && input.ids.length > 0) {
		andClauses.push(idInConstraint(input.ids));
	}
	if (input.retailLinkedRetailer === "amazon") {
		andClauses.push({
			retailOrderItems: {
				some: {
					retailOrder: { retailer: "amazon" },
				},
			},
		});
	}
	if (andClauses.length > 0) where.AND = andClauses;

	return where;
}

export class SqliteTransactionRepository implements TransactionRepository {
	constructor(private db: SqliteDbClient) {}

	private async getHashtagsByTransactionIds(
		userId: string,
		transactionIds: string[],
	): Promise<Map<string, string[]>> {
		const result = new Map<string, string[]>();
		if (transactionIds.length === 0) return result;

		const placeholders = transactionIds.map(() => "?").join(", ");
		const rows = await this.db.$queryRawUnsafe<HashtagJoinRow[]>(
			`SELECT th."transactionId", h."name"
			 FROM "TransactionHashtag" th
			 INNER JOIN "Hashtag" h ON h."id" = th."hashtagId"
			 INNER JOIN "Transaction" t ON t."id" = th."transactionId"
			 WHERE th."transactionId" IN (${placeholders})
			   AND t."userId" = ?
			   AND h."userId" = ?
			 ORDER BY h."name" COLLATE NOCASE`,
			...transactionIds,
			userId,
			userId,
		);

		for (const row of rows) {
			const tags = result.get(row.transactionId) ?? [];
			tags.push(row.name);
			result.set(row.transactionId, tags);
		}

		return result;
	}

	private async findIdsByEffectiveDateRange(input: {
		userId: string;
		startDate?: Date;
		endDate?: Date;
	}): Promise<string[] | undefined> {
		if (!input.startDate && !input.endDate) return undefined;

		const conditions = ["t.userId = ?"];
		const params: unknown[] = [input.userId];
		if (input.startDate) {
			conditions.push(`(${TX_EFFECTIVE_MS_SQL}) >= ?`);
			params.push(input.startDate.getTime());
		}
		if (input.endDate) {
			conditions.push(`(${TX_EFFECTIVE_MS_SQL}) <= ?`);
			params.push(input.endDate.getTime());
		}

		const rows = await this.db.$queryRawUnsafe<{ id: string }[]>(
			`SELECT t.id FROM "Transaction" t WHERE ${conditions.join(" AND ")}`,
			...params,
		);
		return rows.map((row) => row.id);
	}

	private async resolveListConstraintIds(input: {
		userId: string;
		hashtag?: string;
		startDate?: Date;
		endDate?: Date;
	}): Promise<string[] | null> {
		const hashtagTransactionIds = input.hashtag
			? await this.getTransactionIdsByHashtag({
					userId: input.userId,
					hashtag: input.hashtag,
				})
			: undefined;
		if (hashtagTransactionIds && hashtagTransactionIds.length === 0) {
			return [];
		}

		const dateIds = await this.findIdsByEffectiveDateRange({
			userId: input.userId,
			startDate: input.startDate,
			endDate: input.endDate,
		});
		if (dateIds && dateIds.length === 0) return [];
		if (hashtagTransactionIds && dateIds) {
			return intersectIds(hashtagTransactionIds, dateIds);
		}
		return hashtagTransactionIds ?? dateIds ?? null;
	}

	private async getTransactionIdsByHashtag(input: {
		userId: string;
		hashtag: string;
	}): Promise<string[]> {
		const normalizedName = normalizeHashtag(input.hashtag);
		if (!normalizedName) return [];

		const rows = await this.db.$queryRaw<{ transactionId: string }[]>`
			SELECT th."transactionId"
			FROM "TransactionHashtag" th
			INNER JOIN "Hashtag" h ON h."id" = th."hashtagId"
			INNER JOIN "Transaction" t ON t."id" = th."transactionId"
			WHERE h."userId" = ${input.userId}
				AND t."userId" = ${input.userId}
				AND h."normalizedName" = ${normalizedName}
		`;

		return rows.map((row) => row.transactionId);
	}

	private async attachHashtags(
		userId: string,
		items: DashboardTransaction[],
	): Promise<DashboardTransaction[]> {
		const hashtagsByTransactionId = await this.getHashtagsByTransactionIds(
			userId,
			items.map((item) => item.id),
		);

		return items.map((item) => ({
			...item,
			hashtags: hashtagsByTransactionId.get(item.id) ?? [],
		}));
	}

	private async findOrCreateHashtag(
		input: {
			userId: string;
			name: string;
		},
		db: SqliteDbClient = this.db,
	): Promise<string> {
		const name = displayHashtag(input.name);
		const normalizedName = normalizeHashtag(name);
		if (!normalizedName) throw new Error("Hashtag name is required");

		const id = randomUUID();
		const now = new Date().toISOString();
		await db.$executeRaw`
			INSERT OR IGNORE INTO "Hashtag" ("id", "userId", "name", "normalizedName", "createdAt", "updatedAt")
			VALUES (${id}, ${input.userId}, ${name}, ${normalizedName}, ${now}, ${now})
		`;

		const rows = await db.$queryRaw<{ id: string }[]>`
			SELECT "id"
			FROM "Hashtag"
			WHERE "userId" = ${input.userId}
				AND "normalizedName" = ${normalizedName}
			LIMIT 1
		`;
		const row = rows[0];
		if (!row) throw new Error("Failed to resolve hashtag");
		return row.id;
	}

	private async writeHashtagLinks(
		db: SqliteDbClient,
		input: {
			userId: string;
			transactionId: string;
			hashtags: string[];
		},
	): Promise<void> {
		const uniqueNames = new Map<string, string>();
		for (const rawName of input.hashtags) {
			const name = displayHashtag(rawName);
			const normalizedName = normalizeHashtag(name);
			if (normalizedName) uniqueNames.set(normalizedName, name);
		}

		const hashtagIds: string[] = [];
		for (const name of uniqueNames.values()) {
			hashtagIds.push(
				await this.findOrCreateHashtag({ userId: input.userId, name }, db),
			);
		}

		await db.transactionHashtag.deleteMany({
			where: { transactionId: input.transactionId },
		});

		if (hashtagIds.length === 0) return;

		await db.transactionHashtag.createMany({
			data: hashtagIds.map((hashtagId) => ({
				transactionId: input.transactionId,
				hashtagId,
			})),
		});
	}

	async listRecent(input: {
		userId: string;
		limit: number;
		startDate?: Date;
		endDate?: Date;
	}): Promise<DashboardTransaction[]> {
		const { userId, limit, startDate, endDate } = input;

		const [rows, nameOverrides] = await Promise.all([
			this.db.$queryRaw<TransactionRow[]>`
			SELECT
				t.id,
				t.date,
				t.postedDate,
				t.amount,
				t.type,
				t.description,
				t.merchantName,
				t.originalDescription,
				t.notes,
				COALESCE(o.name, c.name) AS categoryName,
				COALESCE(o.icon, c.icon) AS categoryIcon,
				COALESCE(o.color, c.color) AS categoryColor,
				COALESCE(a.name, pa.name) AS accountName,
				pa.id AS plaidAccountDbId,
				t.appliedRuleId,
				t.amazonRetailEnrichedAt,
				t.hidden,
				t.splitGroupId,
				t.splitParentId
			FROM "Transaction" t
			LEFT JOIN "Category" c ON t.categoryId = c.id
			LEFT JOIN "CategoryOverride" o ON o.categoryId = c.id AND o.userId = t.userId
			LEFT JOIN "Account"  a ON t.accountId  = a.id
			LEFT JOIN "PlaidAccount" pa ON t.plaidAccountId = pa.id
			WHERE
				t.userId    = ${userId}
				AND t.hidden    = 0
				AND t.removedAt IS NULL
				AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
			ORDER BY COALESCE(t.postedDate, t.date) DESC
			LIMIT ${limit}
		`,
			loadAccountNameOverrides(this.db, userId),
		]);

		const items = rows
			.filter((row) => {
				const d = new Date((row.postedDate ?? row.date) as string).getTime();
				if (startDate && d < startDate.getTime()) return false;
				if (endDate && d > endDate.getTime()) return false;
				return true;
			})
			.map((row) => mapRow(row, nameOverrides));

		return this.attachHashtags(userId, items);
	}

	async findById(input: {
		userId: string;
		transactionId: string;
	}): Promise<DashboardTransaction | null> {
		const [rows, nameOverrides] = await Promise.all([
			this.db.$queryRaw<TransactionRow[]>`
			SELECT
				t.id,
				t.date,
				t.postedDate,
				t.amount,
				t.type,
				t.description,
				t.merchantName,
				t.originalDescription,
				t.notes,
				COALESCE(o.name, c.name) AS categoryName,
				COALESCE(o.icon, c.icon) AS categoryIcon,
				COALESCE(o.color, c.color) AS categoryColor,
				COALESCE(a.name, pa.name) AS accountName,
				pa.id AS plaidAccountDbId,
				t.appliedRuleId,
				t.amazonRetailEnrichedAt,
				t.hidden,
				t.splitGroupId,
				t.splitParentId
			FROM "Transaction" t
			LEFT JOIN "Category" c ON t.categoryId = c.id
			LEFT JOIN "CategoryOverride" o ON o.categoryId = c.id AND o.userId = t.userId
			LEFT JOIN "Account"  a ON t.accountId  = a.id
			LEFT JOIN "PlaidAccount" pa ON t.plaidAccountId = pa.id
			WHERE
				t.id     = ${input.transactionId}
				AND t.userId = ${input.userId}
			LIMIT 1
		`,
			loadAccountNameOverrides(this.db, input.userId),
		]);

		const row = rows[0];
		if (!row) return null;
		const [item] = await this.attachHashtags(input.userId, [
			mapRow(row, nameOverrides),
		]);
		return item ?? null;
	}

	async listByAppliedRuleId(input: {
		userId: string;
		appliedRuleId: string;
	}): Promise<DashboardTransaction[]> {
		const [rows, nameOverrides] = await Promise.all([
			this.db.$queryRaw<TransactionRow[]>`
			SELECT
				t.id,
				t.date,
				t.postedDate,
				t.amount,
				t.type,
				t.description,
				t.merchantName,
				t.originalDescription,
				t.notes,
				COALESCE(o.name, c.name) AS categoryName,
				COALESCE(o.icon, c.icon) AS categoryIcon,
				COALESCE(o.color, c.color) AS categoryColor,
				COALESCE(a.name, pa.name) AS accountName,
				pa.id AS plaidAccountDbId,
				t.appliedRuleId,
				t.amazonRetailEnrichedAt,
				t.hidden,
				t.splitGroupId,
				t.splitParentId
			FROM "Transaction" t
			LEFT JOIN "Category" c ON t.categoryId = c.id
			LEFT JOIN "CategoryOverride" o ON o.categoryId = c.id AND o.userId = t.userId
			LEFT JOIN "Account"  a ON t.accountId  = a.id
			LEFT JOIN "PlaidAccount" pa ON t.plaidAccountId = pa.id
			WHERE
				t.userId = ${input.userId}
				AND t.appliedRuleId = ${input.appliedRuleId}
				AND t.hidden = 0
				AND t.removedAt IS NULL
				AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
			ORDER BY t.date DESC
		`,
			loadAccountNameOverrides(this.db, input.userId),
		]);
		return this.attachHashtags(
			input.userId,
			rows.map((row) => mapRow(row, nameOverrides)),
		);
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
			categories,
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
			retailLinkedRetailer,
		} = input;

		const constrainIds = await this.resolveListConstraintIds({
			userId,
			hashtag,
			startDate,
			endDate,
		});
		if (constrainIds && constrainIds.length === 0) {
			return { items: [], nextCursor: null, total: 0 };
		}

		const where = buildTransactionWhere({
			userId,
			search,
			category,
			categories,
			hashtag,
			accountId,
			accountIds,
			minAmount,
			maxAmount,
			type,
			ids: constrainIds ?? undefined,
			retailLinkedRetailer,
		});

		type ListedRow = {
			id: string;
			date: Date | string;
			postedDate: Date | string | null;
			amount: number;
			type: string;
			description: string | null;
			merchantName: string | null;
			originalDescription: string | null;
			notes: string | null;
			appliedRuleId: string | null;
			location: string | null;
			amazonRetailEnrichedAt: Date | string | null;
			hidden: boolean;
			splitGroupId: string | null;
			splitParentId: string | null;
			category: {
				name: string;
				icon: string | null;
				color: string | null;
				overrides: Array<{
					name: string | null;
					icon: string | null;
					color: string | null;
				}>;
			} | null;
			account: { name: string } | null;
			plaidAccount: { id: string; name: string } | null;
		};

		const include = {
			category: {
				select: {
					name: true,
					icon: true,
					color: true,
					overrides: {
						where: { userId },
						select: { name: true, icon: true, color: true },
					},
				},
			},
			account: { select: { name: true } },
			plaidAccount: { select: { id: true, name: true } },
		};

		let nameOverrides: Map<string, string>;
		let total: number;
		let rows: ListedRow[];

		if (sortField === "amount") {
			const [overrides, count, sortKeys] = await Promise.all([
				loadAccountNameOverrides(this.db, userId),
				this.db.transaction.count({ where }) as Promise<number>,
				this.db.transaction.findMany({
					where,
					select: { id: true, type: true, amount: true },
				}) as Promise<Array<{ id: string; type: string; amount: number }>>,
			]);
			nameOverrides = overrides;
			total = count;
			const pageIds = pageIdsByAmountSort(sortKeys, sortDir, cursor, limit);
			if (pageIds.length === 0) {
				return { items: [], nextCursor: null, total };
			}
			const unordered = (await this.db.transaction.findMany({
				where: { id: { in: pageIds } },
				include,
			})) as ListedRow[];
			rows = sortRowsByIdOrder(unordered, pageIds);
		} else {
			const orderBy =
				sortField === "account"
					? { account: { name: sortDir } }
					: { date: sortDir };
			const [overrides, count, listed] = await Promise.all([
				loadAccountNameOverrides(this.db, userId),
				this.db.transaction.count({ where }) as Promise<number>,
				this.db.transaction.findMany({
					where,
					include,
					orderBy,
					skip: cursor,
					take: limit,
				}) as Promise<ListedRow[]>,
			]);
			nameOverrides = overrides;
			total = count;
			rows = listed;
		}

		const items: DashboardTransaction[] = rows.map((r) => {
			const override = r.category?.overrides[0];
			return {
				id: r.id,
				date: resolveDate(r.postedDate ?? r.date),
				description: r.description ?? r.merchantName,
				originalDescription: r.originalDescription ?? null,
				notes: r.notes ?? null,
				amount: r.amount,
				type: r.type as "INCOME" | "EXPENSE",
				category: override?.name ?? r.category?.name ?? "Uncategorized",
				categoryIcon: override?.icon ?? r.category?.icon ?? null,
				categoryColor: override?.color ?? r.category?.color ?? null,
				account: applyAccountDisplayName(
					resolveAccountName(r.account, r.plaidAccount),
					r.plaidAccount?.id,
					nameOverrides,
				),
				appliedRuleId: r.appliedRuleId ?? null,
				location: parseTransactionLocation(r.location),
				amazonRetailEnrichedAt: resolveOptionalDate(r.amazonRetailEnrichedAt),
				hidden: Boolean(r.hidden),
				splitGroupId: r.splitGroupId ?? null,
				splitParentId: r.splitParentId ?? null,
			};
		});

		const nextOffset = cursor + rows.length;
		return {
			items: await this.attachHashtags(userId, items),
			nextCursor: nextOffset < total ? nextOffset : null,
			total,
		};
	}

	async count(input: {
		userId: string;
		search?: string;
		category?: string;
		categories?: string[];
		hashtag?: string;
		accountId?: string;
		accountIds?: string[];
		minAmount?: number;
		maxAmount?: number;
		startDate?: Date;
		endDate?: Date;
		type?: string;
		retailLinkedRetailer?: "amazon";
	}): Promise<number> {
		const constrainIds = await this.resolveListConstraintIds({
			userId: input.userId,
			hashtag: input.hashtag,
			startDate: input.startDate,
			endDate: input.endDate,
		});
		if (constrainIds && constrainIds.length === 0) return 0;

		const where = buildTransactionWhere({
			...input,
			ids: constrainIds ?? undefined,
		});
		return this.db.transaction.count({ where }) as Promise<number>;
	}

	async getSummary(
		input: { userId: string } & TransactionSummaryInput,
	): Promise<TransactionSummary> {
		const constrainIds = await this.resolveListConstraintIds({
			userId: input.userId,
			hashtag: input.hashtag,
			startDate: input.startDate,
			endDate: input.endDate,
		});
		if (constrainIds && constrainIds.length === 0) {
			return emptyTransactionSummary();
		}

		const where = buildTransactionWhere({
			...input,
			ids: constrainIds ?? undefined,
		});
		const rows = (await this.db.transaction.findMany({
			where,
			select: { id: true, amount: true, type: true, date: true },
		})) as {
			id: string;
			amount: number;
			type: string;
			date: Date | string;
		}[];

		return summarizeTransactions(rows);
	}

	async createMany(input: {
		userId: string;
		transactions: CreateTransactionInput[];
	}): Promise<number> {
		const { userId, transactions } = input;
		const now = new Date().toISOString();
		const accountLinks = await this.resolveImportAccountLinks(
			transactions.map((transaction) => transaction.accountId),
		);
		const data = transactions.map((t) => {
			const link = accountLinks.get(t.accountId ?? "") ?? {
				accountId: null,
				plaidAccountId: null,
			};
			return {
				id: t.id ?? randomUUID(),
				userId,
				accountId: link.accountId,
				plaidAccountId: link.plaidAccountId,
				categoryId: t.categoryId ?? null,
				date: t.date.toISOString(),
				postedDate: t.postedDate?.toISOString() ?? null,
				amount: t.amount,
				type: t.type,
				description: t.description ?? null,
				originalDescription: t.originalDescription ?? null,
				merchantName: t.merchantName ?? null,
				source: t.source ?? "import",
				dedupeFingerprint: t.dedupeFingerprint ?? null,
				createdAt: now,
				updatedAt: now,
			};
		});

		const result = await this.db.transaction.createMany({ data });
		return result.count;
	}

	private async resolveImportAccountLinks(
		accountIds: Array<string | null | undefined>,
	): Promise<
		Map<string, { accountId: string | null; plaidAccountId: string | null }>
	> {
		const unique = [
			...new Set(
				accountIds.filter((id): id is string => Boolean(id && id.length > 0)),
			),
		];
		const links = new Map<
			string,
			{ accountId: string | null; plaidAccountId: string | null }
		>();
		if (unique.length === 0) return links;

		const [accounts, plaidAccounts] = await Promise.all([
			this.db.account.findMany({
				where: { id: { in: unique } },
				select: { id: true },
			}) as Promise<Array<{ id: string }>>,
			this.db.plaidAccount.findMany({
				where: { id: { in: unique } },
				select: { id: true },
			}) as Promise<Array<{ id: string }>>,
		]);
		const manualIds = new Set(accounts.map((row) => row.id));
		const plaidIds = new Set(plaidAccounts.map((row) => row.id));

		for (const id of unique) {
			links.set(id, {
				accountId: manualIds.has(id) ? id : null,
				plaidAccountId: plaidIds.has(id) ? id : null,
			});
		}
		return links;
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

	async listUnfingerprintedForDedupe(input: {
		userId: string;
		startDate: Date;
		endDate: Date;
		amounts: number[];
	}): Promise<Array<{ date: Date; amount: number; description: string }>> {
		const uniqueAmounts = [...new Set(input.amounts)];
		if (uniqueAmounts.length === 0) return [];

		const rows = (await this.db.transaction.findMany({
			where: {
				userId: input.userId,
				removedAt: null,
				dedupeFingerprint: null,
				date: { gte: input.startDate, lte: input.endDate },
				amount: { in: uniqueAmounts },
			},
			select: {
				date: true,
				postedDate: true,
				amount: true,
				description: true,
				merchantName: true,
			},
		})) as Array<{
			date: Date | string;
			postedDate: Date | string | null;
			amount: number;
			description: string | null;
			merchantName: string | null;
		}>;

		return rows.map((row) => ({
			date: row.postedDate
				? resolveDate(row.postedDate)
				: resolveDate(row.date),
			amount: row.amount,
			description: row.description ?? row.merchantName ?? "",
		}));
	}

	async update(input: {
		userId: string;
		transactionId: string;
		data: UpdateTransactionInput;
	}): Promise<DashboardTransaction | null> {
		const { userId, transactionId, data } = input;
		let resolvedCategoryId = data.categoryId;
		const existing = (await this.db.transaction.findFirst({
			where: { id: transactionId, userId },
			select: { splitGroupId: true },
		})) as { splitGroupId: string | null } | null;
		if (!existing) throw new Error("Transaction not found");

		if (data.categoryName !== undefined) {
			const trimmedCategoryName = data.categoryName?.trim();
			if (!trimmedCategoryName) {
				resolvedCategoryId = null;
			} else {
				const overrideMatch = (await this.db.categoryOverride.findFirst({
					where: {
						userId,
						name: trimmedCategoryName,
						isRemoved: false,
					},
					select: { categoryId: true },
				})) as { categoryId: string } | null;
				if (overrideMatch) {
					resolvedCategoryId = overrideMatch.categoryId;
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
								id: randomUUID(),
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
		}

		const trimmedNotes = data.notes?.trim() ?? "";
		const result = await this.db.transaction.updateMany({
			where: { id: transactionId, userId },
			data: {
				...(data.description !== undefined && {
					description: data.description,
				}),
				...(data.amount !== undefined &&
					!existing.splitGroupId && { amount: data.amount }),
				...(data.type !== undefined && { type: data.type }),
				...(resolvedCategoryId !== undefined && {
					categoryId: resolvedCategoryId,
				}),
				...(data.appliedRuleId !== undefined && {
					appliedRuleId: data.appliedRuleId,
				}),
				...(data.notes !== undefined && {
					notes: trimmedNotes.length > 0 ? trimmedNotes : null,
				}),
				updatedAt: new Date().toISOString(),
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

		await this.db.$transaction(async (tx) => {
			await this.writeHashtagLinks(tx, {
				userId: input.userId,
				transactionId: input.transactionId,
				hashtags: input.hashtags,
			});
		});
	}

	async delete(input: {
		userId: string;
		transactionId: string;
	}): Promise<void> {
		const existing = (await this.db.transaction.findFirst({
			where: { id: input.transactionId, userId: input.userId },
			select: { splitParentId: true, splitGroupId: true },
		})) as { splitParentId: string | null; splitGroupId: string | null } | null;
		if (!existing) throw new Error("Transaction not found");
		const result = await this.db.transaction.deleteMany({
			where: { id: input.transactionId, userId: input.userId },
		});
		if (result.count === 0) throw new Error("Transaction not found");
		await this.repairSplitGroupAfterDelete(input.userId, [existing]);
	}

	async hide(input: { userId: string; transactionId: string }): Promise<void> {
		const result = await this.db.transaction.updateMany({
			where: { id: input.transactionId, userId: input.userId },
			data: { hidden: true, updatedAt: new Date().toISOString() },
		});
		if (result.count === 0) throw new Error("Transaction not found");
	}

	async bulkHide(input: {
		userId: string;
		transactionIds: string[];
	}): Promise<number> {
		if (input.transactionIds.length === 0) return 0;
		const result = await this.db.transaction.updateMany({
			where: {
				userId: input.userId,
				...idInConstraint(input.transactionIds),
			},
			data: { hidden: true, updatedAt: new Date().toISOString() },
		});
		return result.count;
	}

	async bulkDelete(input: {
		userId: string;
		transactionIds: string[];
	}): Promise<number> {
		if (input.transactionIds.length === 0) return 0;
		const existing = (await this.db.transaction.findMany({
			where: { id: { in: input.transactionIds }, userId: input.userId },
			select: { splitParentId: true, splitGroupId: true },
		})) as Array<{ splitParentId: string | null; splitGroupId: string | null }>;
		const result = await this.db.transaction.deleteMany({
			where: { id: { in: input.transactionIds }, userId: input.userId },
		});
		await this.repairSplitGroupAfterDelete(input.userId, existing);
		return result.count;
	}

	async listCategories(input: { userId: string }): Promise<string[]> {
		const rows = await this.db.$queryRaw<{ name: string }[]>`
			SELECT DISTINCT COALESCE(o.name, c.name) AS name
			FROM "Transaction" t
			LEFT JOIN "Category" c ON t.categoryId = c.id
			LEFT JOIN CategoryOverride o ON o.categoryId = c.id AND o.userId = t.userId
			WHERE t.userId = ${input.userId}
				AND t.hidden = 0
				AND t.removedAt IS NULL
				AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
				AND NOT EXISTS (
					SELECT 1 FROM Category hc
					LEFT JOIN CategoryOverride ho
						ON ho.categoryId = hc.id AND ho.userId = t.userId
					WHERE hc.id = t.categoryId
						AND (
							COALESCE(ho.isRemoved, 0) = 1
							OR COALESCE(ho.isHidden, hc.isHidden) = 1
						)
				)
				AND COALESCE(o.name, c.name) IS NOT NULL
			ORDER BY name
		`;
		return rows.map((r) => r.name);
	}

	async listHashtags(input: { userId: string }): Promise<string[]> {
		const rows = await this.db.$queryRaw<{ name: string }[]>`
			SELECT h."name"
			FROM "Hashtag" h
			WHERE h."userId" = ${input.userId}
			ORDER BY h."createdAt" DESC
		`;
		return rows.map((row) => row.name);
	}

	async split(input: {
		userId: string;
		id: string;
		type: "INCOME" | "EXPENSE";
		legs: Array<{
			id?: string;
			description: string;
			amount: number;
			categoryName: string;
			hashtags: string[];
			notes?: string | null;
			hidden?: boolean;
			date?: string;
		}>;
	}): Promise<{ originalId: string; splitIds: string[] }> {
		return this.writeSplitGroup({ ...input, mode: "create" });
	}

	async updateSplit(input: {
		userId: string;
		id: string;
		type: "INCOME" | "EXPENSE";
		legs: Array<{
			id?: string;
			description: string;
			amount: number;
			categoryName: string;
			hashtags: string[];
			notes?: string | null;
			hidden?: boolean;
			date?: string;
		}>;
	}): Promise<{ originalId: string; splitIds: string[] }> {
		return this.writeSplitGroup({ ...input, mode: "update" });
	}

	async unsplit(input: {
		userId: string;
		id: string;
	}): Promise<{ restoredId: string; removedIds: string[] }> {
		const parent = await this.resolveSplitParent(input.userId, input.id);
		const children = (await this.db.transaction.findMany({
			where: { userId: input.userId, splitParentId: parent.id },
			select: { id: true },
		})) as Array<{ id: string }>;
		const removedIds = children.map((child) => child.id);
		if (removedIds.length > 0) {
			await this.db.transaction.deleteMany({
				where: { id: { in: removedIds }, userId: input.userId },
			});
		}
		await this.db.transaction.update({
			where: { id: parent.id },
			data: {
				amount: parent.splitOriginalAmount ?? parent.amount,
				splitGroupId: null,
				splitParentId: null,
				splitOriginalAmount: null,
				updatedAt: new Date().toISOString(),
			},
		});
		return { restoredId: parent.id, removedIds };
	}

	async getSplitGroup(input: { userId: string; id: string }): Promise<{
		original: DashboardTransaction;
		legs: DashboardTransaction[];
	} | null> {
		const parent = await this.resolveSplitParent(input.userId, input.id);
		const [original, children] = await Promise.all([
			this.findById({ userId: input.userId, transactionId: parent.id }),
			this.db.transaction.findMany({
				where: { userId: input.userId, splitParentId: parent.id },
				orderBy: { createdAt: "asc" },
				select: { id: true },
			}) as Promise<Array<{ id: string }>>,
		]);
		if (!original) return null;
		const legs = (
			await Promise.all(
				children.map((child) =>
					this.findById({
						userId: input.userId,
						transactionId: child.id,
					}),
				),
			)
		).filter((row): row is DashboardTransaction => row != null);
		return { original, legs };
	}

	private async repairSplitGroupAfterDelete(
		userId: string,
		deleted: Array<{
			splitParentId: string | null;
			splitGroupId: string | null;
		}>,
	): Promise<void> {
		const parentIds = new Set<string>();
		const deletedParentIds = new Set<string>();
		for (const row of deleted) {
			if (row.splitParentId) parentIds.add(row.splitParentId);
			if (row.splitGroupId && !row.splitParentId) {
				deletedParentIds.add(row.splitGroupId);
			}
		}

		for (const parentId of deletedParentIds) {
			await this.db.transaction.updateMany({
				where: { userId, splitParentId: parentId },
				data: {
					splitGroupId: null,
					splitParentId: null,
					splitOriginalAmount: null,
					updatedAt: new Date().toISOString(),
				},
			});
		}

		for (const parentId of parentIds) {
			if (deletedParentIds.has(parentId)) continue;
			const remaining = (await this.db.transaction.count({
				where: { userId, splitParentId: parentId },
			})) as number;
			if (remaining > 0) continue;
			const parent = (await this.db.transaction.findFirst({
				where: { id: parentId, userId },
				select: {
					amount: true,
					splitOriginalAmount: true,
					splitGroupId: true,
				},
			})) as {
				amount: number;
				splitOriginalAmount: number | null;
				splitGroupId: string | null;
			} | null;
			if (!parent?.splitGroupId) continue;
			await this.db.transaction.update({
				where: { id: parentId },
				data: {
					amount: parent.splitOriginalAmount ?? parent.amount,
					splitGroupId: null,
					splitParentId: null,
					splitOriginalAmount: null,
					updatedAt: new Date().toISOString(),
				},
			});
		}
	}

	private async resolveSplitParent(userId: string, id: string) {
		const transaction = (await this.db.transaction.findFirst({
			where: { id, userId },
			select: {
				id: true,
				splitGroupId: true,
				splitParentId: true,
				amount: true,
				splitOriginalAmount: true,
			},
		})) as {
			id: string;
			splitGroupId: string | null;
			splitParentId: string | null;
			amount: number;
			splitOriginalAmount: number | null;
		} | null;
		if (!transaction?.splitGroupId) {
			throw new Error("Transaction is not split");
		}
		const parent = (await this.db.transaction.findFirst({
			where: { id: transaction.splitGroupId, userId },
			select: {
				id: true,
				amount: true,
				splitOriginalAmount: true,
				date: true,
				postedDate: true,
				originalDescription: true,
				merchantName: true,
				accountId: true,
				plaidAccountId: true,
				plaidItemId: true,
				source: true,
				pending: true,
			},
		})) as {
			id: string;
			amount: number;
			splitOriginalAmount: number | null;
			date: Date | string;
			postedDate: Date | string | null;
			originalDescription: string | null;
			merchantName: string | null;
			accountId: string | null;
			plaidAccountId: string | null;
			plaidItemId: string | null;
			source: string;
			pending: boolean;
		} | null;
		if (!parent) throw new Error("Split parent transaction not found");
		return parent;
	}

	private async writeSplitGroup(input: {
		userId: string;
		id: string;
		type: "INCOME" | "EXPENSE";
		mode: "create" | "update";
		legs: Array<{
			id?: string;
			description: string;
			amount: number;
			categoryName: string;
			hashtags: string[];
			notes?: string | null;
			hidden?: boolean;
			date?: string;
		}>;
	}): Promise<{ originalId: string; splitIds: string[] }> {
		if (input.legs.length < 2) {
			throw new Error("A split needs at least two legs");
		}
		const existing = (await this.db.transaction.findFirst({
			where: { id: input.id, userId: input.userId },
		})) as {
			id: string;
			amount: number;
			splitGroupId: string | null;
			source: string;
			pending: boolean;
			date: Date | string;
			postedDate: Date | string | null;
			originalDescription: string | null;
			merchantName: string | null;
			accountId: string | null;
			plaidAccountId: string | null;
			plaidItemId: string | null;
			appliedRuleId: string | null;
			location: string | null;
			raw: string | null;
			splitOriginalAmount: number | null;
		} | null;
		if (!existing) throw new Error("Transaction not found");
		if (input.mode === "create" && existing.splitGroupId) {
			throw new Error("Transaction has already been split");
		}
		if (input.mode === "update" && !existing.splitGroupId) {
			throw new Error("Transaction is not split");
		}
		if (existing.source === "PLAID" && existing.pending) {
			throw new Error("Pending Plaid transactions cannot be split");
		}

		return this.db.$transaction(async (tx) => {
			const parentId =
				input.mode === "create" ? existing.id : existing.splitGroupId;
			if (!parentId) throw new Error("Split parent transaction not found");
			const parentRow =
				input.mode === "create"
					? existing
					: ((await tx.transaction.findFirst({
							where: { id: parentId, userId: input.userId },
							select: {
								id: true,
								amount: true,
								splitOriginalAmount: true,
							},
						})) as {
							id: string;
							amount: number;
							splitOriginalAmount: number | null;
						} | null);
			if (!parentRow) throw new Error("Split parent transaction not found");
			const originalAmount =
				input.mode === "create"
					? existing.amount
					: (parentRow.splitOriginalAmount ?? parentRow.amount);
			for (const leg of input.legs) {
				if (leg.amount <= 0) {
					throw new Error("Split amounts must be greater than zero");
				}
				if (!leg.description.trim() || !leg.categoryName.trim()) {
					throw new Error("Each split needs a name and category");
				}
			}
			if (!splitAmountsMatchOriginal(originalAmount, input.legs)) {
				throw new Error("Split amounts must add up to the original amount");
			}

			if (input.mode === "create") {
				await tx.transaction.update({
					where: { id: existing.id },
					data: {
						splitGroupId: existing.id,
						splitParentId: null,
						splitOriginalAmount: originalAmount,
						updatedAt: new Date().toISOString(),
					},
				});
			} else {
				await tx.transaction.update({
					where: { id: parentId },
					data: {
						type: input.type,
						splitOriginalAmount: originalAmount,
						updatedAt: new Date().toISOString(),
					},
				});
			}

			const existingChildren =
				input.mode === "update"
					? ((await tx.transaction.findMany({
							where: { userId: input.userId, splitParentId: parentId },
							select: { id: true },
						})) as Array<{ id: string }>)
					: [];
			const incomingIds = new Set(
				input.legs
					.map((leg) => leg.id)
					.filter((id): id is string => Boolean(id)),
			);
			for (const id of incomingIds) {
				if (!existingChildren.some((child) => child.id === id)) {
					throw new Error("Split leg was not found");
				}
			}
			const removedIds = existingChildren
				.filter((child) => !incomingIds.has(child.id))
				.map((child) => child.id);
			if (removedIds.length > 0) {
				await tx.transaction.deleteMany({
					where: { id: { in: removedIds }, userId: input.userId },
				});
			}

			const parent = (await tx.transaction.findFirst({
				where: { id: parentId, userId: input.userId },
			})) as {
				id: string;
				date: Date | string;
				postedDate: Date | string | null;
				originalDescription: string | null;
				merchantName: string | null;
				accountId: string | null;
				plaidAccountId: string | null;
				plaidItemId: string | null;
				appliedRuleId: string | null;
				location: string | null;
				raw: string | null;
			} | null;
			if (!parent) throw new Error("Split parent transaction not found");

			const splitIds: string[] = [];
			for (const leg of input.legs) {
				const categoryId = await this.resolveCategoryId(
					input.userId,
					leg.categoryName,
					tx,
				);
				const timeline = resolveSplitLegTimelineDates(parent, leg.date);
				if (leg.id) {
					await tx.transaction.update({
						where: { id: leg.id },
						data: {
							description: leg.description.trim(),
							amount: leg.amount,
							type: input.type,
							categoryId,
							notes: leg.notes?.trim() ? leg.notes.trim() : null,
							hidden: leg.hidden === true,
							splitOriginalAmount: originalAmount,
							updatedAt: new Date().toISOString(),
							...(leg.date
								? {
										date: timeline.date,
										postedDate: timeline.postedDate,
									}
								: {}),
						},
					});
					await this.writeHashtagLinks(tx, {
						userId: input.userId,
						transactionId: leg.id,
						hashtags: leg.hashtags,
					});
					splitIds.push(leg.id);
					continue;
				}

				const childId = randomUUID();
				await tx.transaction.create({
					data: {
						id: childId,
						userId: input.userId,
						date: timeline.date,
						postedDate: timeline.postedDate,
						amount: leg.amount,
						type: input.type,
						categoryId,
						description: leg.description.trim(),
						originalDescription: parent.originalDescription,
						notes: leg.notes?.trim() ? leg.notes.trim() : null,
						merchantName: parent.merchantName,
						accountId: parent.accountId,
						source: "MANUAL",
						plaidAccountId: parent.plaidAccountId,
						plaidItemId: parent.plaidItemId,
						pending: false,
						hidden: leg.hidden === true,
						appliedRuleId: parent.appliedRuleId,
						location: parent.location,
						raw: parent.raw,
						splitGroupId: parentId,
						splitParentId: parentId,
						splitOriginalAmount: originalAmount,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					},
				});
				await this.writeHashtagLinks(tx, {
					userId: input.userId,
					transactionId: childId,
					hashtags: leg.hashtags,
				});
				splitIds.push(childId);
			}

			return { originalId: parentId, splitIds };
		});
	}

	private async resolveCategoryId(
		userId: string,
		categoryName: string,
		db: SqliteDbClient = this.db,
	): Promise<string> {
		const trimmed = categoryName.trim();
		const overrideMatch = (await db.categoryOverride.findFirst({
			where: { userId, name: trimmed, isRemoved: false },
			select: { categoryId: true },
		})) as { categoryId: string } | null;
		if (overrideMatch) return overrideMatch.categoryId;
		const existing = (await db.category.findFirst({
			where: {
				name: trimmed,
				OR: [{ userId: null }, { userId }],
			},
			select: { id: true },
		})) as { id: string } | null;
		if (existing) return existing.id;
		const created = (await db.category.create({
			data: {
				id: randomUUID(),
				name: trimmed,
				userId,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		})) as { id: string };
		return created.id;
	}
}
