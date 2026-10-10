// Scenario CRUD.
//
// A scenario stores levers and nothing else — no balances, no rates, no
// projection. That is what makes a scenario saved two months ago reflect today's
// accounts the moment it is reopened, with no user action and no migration.

import type {
	CreateRetirementScenarioInput,
	DeleteRetirementScenarioInput,
	DuplicateRetirementScenarioInput,
	RetirementScenario,
	UpdateRetirementScenarioInput,
} from "@moat/contracts";
import type { RetirementScenarioRecord } from "@moat/data-access";
import type { AppContext } from "../context";
import { retirementNotFoundError } from "./errors";

function requireRepo(ctx: AppContext) {
	const repo = ctx.repositories.retirement;
	if (!repo) throw new Error("Retirement repository is not configured");
	return repo;
}

function toScenario(record: RetirementScenarioRecord): RetirementScenario {
	return {
		id: record.id,
		name: record.name,
		description: record.description,
		color: record.color,
		source: record.source,
		isPinned: record.isPinned,
		sortOrder: record.sortOrder,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		levers: record.levers.map((entry) => ({
			id: entry.id,
			enabled: entry.enabled,
			sortOrder: entry.sortOrder,
			lever: entry.lever,
		})),
	};
}

export async function listRetirementScenarios(
	ctx: AppContext,
): Promise<RetirementScenario[]> {
	const records = await requireRepo(ctx).listScenarios({ userId: ctx.userId });
	return records.map(toScenario);
}

export async function createRetirementScenario(
	ctx: AppContext,
	input: CreateRetirementScenarioInput,
): Promise<RetirementScenario> {
	const record = await requireRepo(ctx).createScenario({
		userId: ctx.userId,
		name: input.name,
		description: input.description ?? null,
		color: input.color ?? null,
		source: input.source ?? "USER",
		levers: input.levers.map((entry) => ({
			enabled: entry.enabled ?? true,
			sortOrder: entry.sortOrder,
			lever: entry.lever,
		})),
	});
	return toScenario(record);
}

export async function updateRetirementScenario(
	ctx: AppContext,
	input: UpdateRetirementScenarioInput,
): Promise<RetirementScenario> {
	const record = await requireRepo(ctx).updateScenario({
		userId: ctx.userId,
		id: input.id,
		data: {
			name: input.name,
			description: input.description,
			color: input.color,
			isPinned: input.isPinned,
			sortOrder: input.sortOrder,
			levers: input.levers?.map((entry) => ({
				enabled: entry.enabled ?? true,
				sortOrder: entry.sortOrder,
				lever: entry.lever,
			})),
		},
	});
	return toScenario(record);
}

export async function duplicateRetirementScenario(
	ctx: AppContext,
	input: DuplicateRetirementScenarioInput,
): Promise<RetirementScenario> {
	const repo = requireRepo(ctx);
	const source = await repo.getScenario({ userId: ctx.userId, id: input.id });
	if (source === null) {
		throw retirementNotFoundError();
	}
	const record = await repo.createScenario({
		userId: ctx.userId,
		name: input.name ?? `${source.name} copy`,
		description: source.description,
		color: source.color,
		source: source.source,
		levers: source.levers.map((entry) => ({
			enabled: entry.enabled,
			sortOrder: entry.sortOrder,
			lever: entry.lever,
		})),
	});
	return toScenario(record);
}

export async function deleteRetirementScenario(
	ctx: AppContext,
	input: DeleteRetirementScenarioInput,
): Promise<void> {
	await requireRepo(ctx).deleteScenario({ userId: ctx.userId, id: input.id });
}
