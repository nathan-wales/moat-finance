import { randomUUID } from "node:crypto";
import type { FinancialProfileData } from "@moat/contracts";
import type { FinancialProfileDataRepository } from "@moat/data-access";
import type { SqliteDbClient } from "../db-client";

export class SqliteFinancialProfileDataRepository
	implements FinancialProfileDataRepository
{
	constructor(private db: SqliteDbClient) {}

	async get(input: {
		userId: string;
	}): Promise<FinancialProfileData | null> {
		// Use $queryRaw since Prisma may not have the generated model yet during local dev
		const rows = await this.db.$queryRaw<
			Array<{
				id: string;
				userId: string;
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
		>`SELECT * FROM "FinancialProfileData" WHERE "userId" = ${input.userId} LIMIT 1`;

		const row = rows[0];
		if (!row) return null;

		return {
			profile: JSON.parse(row.profile),
			accounts: JSON.parse(row.accounts),
			incomeSources: JSON.parse(row.incomeSources),
			assets: JSON.parse(row.assets),
			liabilities: JSON.parse(row.liabilities),
			investments: JSON.parse(row.investments),
			insurancePolicies: JSON.parse(row.insurancePolicies),
			taxProfile: JSON.parse(row.taxProfile),
			forecastAssumptions: JSON.parse(row.forecastAssumptions),
			planningNotes: JSON.parse(row.planningNotes),
		};
	}

	async upsert(input: {
		userId: string;
		data: FinancialProfileData;
	}): Promise<FinancialProfileData> {
		const { userId, data } = input;

		const profile = JSON.stringify(data.profile);
		const accounts = JSON.stringify(data.accounts);
		const incomeSources = JSON.stringify(data.incomeSources);
		const assets = JSON.stringify(data.assets);
		const liabilities = JSON.stringify(data.liabilities);
		const investments = JSON.stringify(data.investments);
		const insurancePolicies = JSON.stringify(data.insurancePolicies);
		const taxProfile = JSON.stringify(data.taxProfile);
		const forecastAssumptions = JSON.stringify(data.forecastAssumptions);
		const planningNotes = JSON.stringify(data.planningNotes);
		const now = new Date().toISOString();

		const existing = await this.db.$queryRaw<Array<{ id: string }>>`
			SELECT "id" FROM "FinancialProfileData" WHERE "userId" = ${userId} LIMIT 1
		`;

		if (existing.length > 0) {
			await this.db.$executeRaw`
				UPDATE "FinancialProfileData"
				SET
					"profile"             = ${profile},
					"accounts"            = ${accounts},
					"incomeSources"       = ${incomeSources},
					"assets"              = ${assets},
					"liabilities"         = ${liabilities},
					"investments"         = ${investments},
					"insurancePolicies"   = ${insurancePolicies},
					"taxProfile"          = ${taxProfile},
					"forecastAssumptions" = ${forecastAssumptions},
					"planningNotes"       = ${planningNotes},
					"updatedAt"           = ${now}
				WHERE "userId" = ${userId}
			`;
		} else {
			const id = randomUUID();
			await this.db.$executeRaw`
				INSERT INTO "FinancialProfileData"
					("id", "userId", "profile", "accounts", "incomeSources", "assets", "liabilities", "investments", "insurancePolicies", "taxProfile", "forecastAssumptions", "planningNotes", "createdAt", "updatedAt")
				VALUES
					(${id}, ${userId}, ${profile}, ${accounts}, ${incomeSources}, ${assets}, ${liabilities}, ${investments}, ${insurancePolicies}, ${taxProfile}, ${forecastAssumptions}, ${planningNotes}, ${now}, ${now})
			`;
		}

		return data;
	}
}
