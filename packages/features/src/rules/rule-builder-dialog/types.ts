import type {
	RuleActionType as ContractsRuleActionType,
	RuleMatch as ContractsRuleMatch,
	RuleConditionField,
	RuleConditionOperator,
} from "@moat/contracts";

export type RuleField = RuleConditionField;
export type RuleOperator = RuleConditionOperator;
export type RuleActionType = ContractsRuleActionType;
export type RuleMatch = ContractsRuleMatch;

export type HashtagEntry = { name: string; id: string | null };

export type ConditionRow = {
	id: string;
	field: RuleField;
	operator: RuleOperator;
	valueText: string;
	valueNumber: string;
	secondValueNumber: string;
};

export type ConditionGroupRow = {
	id: string;
	match: RuleMatch;
	conditions: ConditionRow[];
};

export type ActionRow = {
	id: string;
	type: RuleActionType;
	valueText: string;
	hashtagId: string | null | undefined;
	hashtagEntries: HashtagEntry[];
};

export type PreviewTx = {
	id: string;
	date: Date;
	description: string | null;
	amount: number;
	type: string;
	category: string;
	account: string | null;
	hashtags: string[];
};

export type RulePrefill = {
	conditions?: {
		field: string;
		operator: string;
		valueText: string;
		valueNumber: string;
		secondValueNumber?: string;
	}[];
	actions?: {
		type: RuleActionType;
		valueText: string;
		hashtagId?: string | null;
	}[];
};
