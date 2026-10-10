/**
 * Minimal structural subset of PrismaClient that packages/db-postgres needs.
 *
 * The generated PrismaClient from apps/api satisfies this interface
 * structurally, so apps/api can pass `ctx.db` wherever DbClient is expected.
 *
 * We intentionally use `unknown` / loose argument types here to avoid a
 * direct dependency on the generated Prisma types (which live in apps/api).
 * Type safety is enforced at the repository method boundaries via explicit
 * return-type casts to the @moat/data-access interfaces.
 */

// biome-ignore lint/suspicious/noExplicitAny: structural interface needs any for Prisma model delegate compatibility
type AnyArgs = any;

export interface DbClient {
	plaidAccount: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		update(args: AnyArgs): Promise<unknown>;
	};
	transaction: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findUnique(args: AnyArgs): Promise<unknown | null>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		count(args?: AnyArgs): Promise<number>;
		createMany(args: AnyArgs): Promise<{ count: number }>;
		updateMany(args: AnyArgs): Promise<{ count: number }>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
	};
	category: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
	};
	categoryOverride: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		findUnique(args: AnyArgs): Promise<unknown | null>;
		upsert(args: AnyArgs): Promise<unknown>;
		delete(args: AnyArgs): Promise<unknown>;
	};
	hashtag: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		upsert(args: AnyArgs): Promise<unknown>;
	};
	transactionHashtag: {
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
		createMany(args: AnyArgs): Promise<{ count: number }>;
	};
	categoryBudget: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		delete(args: AnyArgs): Promise<unknown>;
		upsert(args: AnyArgs): Promise<unknown>;
		updateMany(args: AnyArgs): Promise<{ count: number }>;
	};
	transactionRule: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
		create(args: AnyArgs): Promise<unknown>;
		update(args: AnyArgs): Promise<unknown>;
		delete(args: AnyArgs): Promise<unknown>;
		aggregate(args: AnyArgs): Promise<unknown>;
	};
	transactionRuleCondition: {
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
		createMany(args: AnyArgs): Promise<{ count: number }>;
	};
	transactionRuleConditionGroup: {
		create(args: AnyArgs): Promise<unknown>;
		deleteMany(args: AnyArgs): Promise<{ count: number }>;
	};
	transactionRuleAction: {
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
	investment: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
	};
	realEstateInvestment: {
		findMany(args?: AnyArgs): Promise<unknown[]>;
		findFirst(args?: AnyArgs): Promise<unknown | null>;
	};
	financialProfileData: {
		findUnique(args: AnyArgs): Promise<unknown | null>;
	};
	userSettings: {
		findUnique(args: AnyArgs): Promise<unknown | null>;
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
	$queryRaw<T = unknown[]>(
		strings: TemplateStringsArray,
		// biome-ignore lint/suspicious/noExplicitAny: mirrors PrismaClient.$queryRaw tagged template signature
		...values: any[]
	): Promise<T>;
}
