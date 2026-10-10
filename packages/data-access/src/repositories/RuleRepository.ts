import type { ActiveRule, CreateRuleInput, UpdateRuleInput } from "../types";

export interface RuleRepository {
	listActive(input: { userId: string }): Promise<ActiveRule[]>;

	listAll(input: { userId: string }): Promise<ActiveRule[]>;

	findById(input: { userId: string; ruleId: string }): Promise<ActiveRule | null>;

	create(input: { userId: string } & CreateRuleInput): Promise<ActiveRule>;

	update(input: { userId: string; ruleId: string } & UpdateRuleInput): Promise<ActiveRule | null>;

	delete(input: { userId: string; ruleId: string }): Promise<void>;

	toggleActive(input: { userId: string; ruleId: string; isActive: boolean }): Promise<void>;
}
