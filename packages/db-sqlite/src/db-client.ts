/**
 * Structural interface for the Prisma SQLite client used by packages/db-sqlite.
 *
 * The generated PrismaClient (from prisma/schema.prisma with output=../src/generated/client)
 * satisfies this interface structurally. We use this interface so that:
 *  1. TypeScript compiles correctly even before prisma generate runs in CI.
 *  2. Repository method types are enforced at each method boundary.
 *
 * Update this interface when new models are added to the SQLite schema.
 */

// biome-ignore lint/suspicious/noExplicitAny: structural interface needs any for Prisma delegate compatibility
type AnyArgs = any;

export interface SqliteDbClient {
	localUser: {
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		findMany(args?: AnyArgs): Promise<unknown[]>;
		create(args: AnyArgs): Promise<unknown>;
		upsert(args: AnyArgs): Promise<unknown>;
		count(args?: AnyArgs): Promise<number>;
	};
	account: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		upsert(args: AnyArgs): Promise<unknown>;
		count(args?: AnyArgs): Promise<number>;
	};
	transaction: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		findUnique(args: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		createMany(args: AnyArgs): Promise<{ count: number }>;
		upsert(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		updateMany(args: AnyArgs): Promise<{ count: number }>;
		delete(args: AnyArgs): Promise<unknown>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
		count(args?: AnyArgs): Promise<number>;
		groupBy(args: AnyArgs): Promise<unknown[]>;
	};
	hashtag: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		upsert(args: AnyArgs): Promise<unknown>;
		count(args?: AnyArgs): Promise<number>;
	};
	transactionHashtag: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
		createMany(args: AnyArgs): Promise<{ count: number }>;
	};
	category: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		upsert(args: AnyArgs): Promise<unknown>;
		delete(args: AnyArgs): Promise<unknown>;
		count(args?: AnyArgs): Promise<number>;
	};
	categoryOverride: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		findUnique(args: AnyArgs): Promise<unknown | null>;
		upsert(args: AnyArgs): Promise<unknown>;
		delete(args: AnyArgs): Promise<unknown>;
	};
	categoryBudget: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		upsert(args: AnyArgs): Promise<unknown>;
		updateMany(args: AnyArgs): Promise<{ count: number }>;
		delete(args: AnyArgs): Promise<unknown>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
		count(args?: AnyArgs): Promise<number>;
	};
	transactionRule: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		delete(args: AnyArgs): Promise<unknown>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
		count(args?: AnyArgs): Promise<number>;
		aggregate(args: AnyArgs): Promise<{ _max: { priority: number | null } }>;
	};
	ruleCondition: {
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
		createMany(args: AnyArgs): Promise<{ count: number }>;
	};
	ruleConditionGroup: {
		create(args: AnyArgs): Promise<unknown>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
	};
	ruleAction: {
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
		createMany(args: AnyArgs): Promise<{ count: number }>;
	};
	forecastScenario: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		createMany(args: AnyArgs): Promise<{ count: number }>;
		update(args: AnyArgs): Promise<unknown>;
		updateMany(args: AnyArgs): Promise<{ count: number }>;
		delete(args: AnyArgs): Promise<unknown>;
		count(args?: AnyArgs): Promise<number>;
	};
	financialProfile: {
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		upsert(args: AnyArgs): Promise<unknown>;
	};
	financialProfileData: {
		findUnique(args: AnyArgs): Promise<unknown | null>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		upsert(args: AnyArgs): Promise<unknown>;
	};
	plaidItem: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		findFirstOrThrow(args?: AnyArgs): Promise<unknown>;
		findUnique(args: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		updateMany(args: AnyArgs): Promise<{ count: number }>;
		delete(args: AnyArgs): Promise<unknown>;
	};
	plaidAccount: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		upsert(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		updateMany(args: AnyArgs): Promise<{ count: number }>;
	};
	plaidHolding: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		createMany(args: AnyArgs): Promise<{ count: number }>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
	};
	investment: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		delete(args: AnyArgs): Promise<unknown>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
	};
	accountBalanceHistory: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		upsert(args: AnyArgs): Promise<unknown>;
		create(args: AnyArgs): Promise<unknown>;
		deleteMany(args?: AnyArgs): Promise<{ count: number }>;
	};
	realEstateInvestment: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		delete(args: AnyArgs): Promise<unknown>;
	};
	retirementPlan: {
		findUnique(args: AnyArgs): Promise<unknown | null>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
	};
	retirementScenario: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		delete(args: AnyArgs): Promise<unknown>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
	};
	retirementScenarioLever: {
		createMany(args: AnyArgs): Promise<{ count: number }>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
	};
	retirementStandingRule: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
	};
	retirementSpendingCategoryPlan: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		upsert(args: AnyArgs): Promise<unknown>;
	};
	memory: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		updateMany(args: AnyArgs): Promise<{ count: number }>;
	};
	importMappingTemplate: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		updateMany(args: AnyArgs): Promise<{ count: number }>;
		delete(args: AnyArgs): Promise<unknown>;
	};
	taxDocument: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		delete(args: AnyArgs): Promise<unknown>;
	};
	taxFact: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
	};
	taxFormExtraction: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		create(args: AnyArgs): Promise<unknown>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
	};
	taxFactConflict: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
	};
	userSettings: {
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		upsert(args: AnyArgs): Promise<unknown>;
	};
	userMetadata: {
		findUnique(args: AnyArgs): Promise<unknown | null>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		upsert(args: AnyArgs): Promise<unknown>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
	};
	aiReport: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		count(args?: AnyArgs): Promise<number>;
	};
	aiReportShare: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		updateMany(args: AnyArgs): Promise<{ count: number }>;
	};
	aiReportVersion: {
		create(args: AnyArgs): Promise<unknown>;
	};
	localUserPrompt: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findUnique(args: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		delete(args: AnyArgs): Promise<unknown>;
	};
	localPromptPin: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findUnique(args: AnyArgs): Promise<unknown | null>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		delete(args: AnyArgs): Promise<unknown>;
		deleteMany(args?: AnyArgs): Promise<{ count: number }>;
	};
	localPromptLaunchStat: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findUnique(args: AnyArgs): Promise<unknown | null>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		upsert(args: AnyArgs): Promise<unknown>;
		deleteMany(args?: AnyArgs): Promise<{ count: number }>;
	};
	localPromptLaunchDaily: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findUnique(args: AnyArgs): Promise<unknown | null>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		deleteMany(args?: AnyArgs): Promise<{ count: number }>;
	};
	retailConnection: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		findUnique(args: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		upsert(args: AnyArgs): Promise<unknown>;
	};
	retailOrder: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		findUnique(args: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		upsert(args: AnyArgs): Promise<unknown>;
	};
	retailOrderItem: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		createMany(args: AnyArgs): Promise<{ count: number }>;
		update(args: AnyArgs): Promise<unknown>;
		updateMany(args: AnyArgs): Promise<{ count: number }>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
	};
	$queryRaw<T = unknown[]>(
		strings: TemplateStringsArray,
		// biome-ignore lint/suspicious/noExplicitAny: mirrors PrismaClient.$queryRaw varargs signature
		...values: any[]
	): Promise<T>;
	$queryRawUnsafe<T = unknown[]>(
		query: string,
		// biome-ignore lint/suspicious/noExplicitAny: mirrors PrismaClient.$queryRawUnsafe varargs signature
		...values: any[]
	): Promise<T>;
	$executeRaw(
		strings: TemplateStringsArray,
		// biome-ignore lint/suspicious/noExplicitAny: mirrors PrismaClient.$executeRaw varargs signature
		...values: any[]
	): Promise<number>;
	// biome-ignore lint/suspicious/noExplicitAny: mirrors PrismaClient.$executeRawUnsafe signature
	$executeRawUnsafe(query: string, ...values: any[]): Promise<number>;
	$transaction<T>(fn: (tx: SqliteDbClient) => Promise<T>): Promise<T>;
	$disconnect(): Promise<void>;
}
