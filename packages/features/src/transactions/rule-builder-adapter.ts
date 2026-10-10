import type { TransactionRule } from "@moat/contracts";
import type React from "react";
import type { RulePrefill } from "../rules/rule-builder-dialog/types";

export type { RulePrefill };

export type TransactionsRuleBuilderProps = {
	editingRule: TransactionRule | null;
	onOpenChange: (open: boolean) => void;
	onSaved: (rule: TransactionRule) => void;
	open: boolean;
	prefill: RulePrefill | null;
	transactionIdToLink: string | null;
};

export type TransactionsRuleBuilderRenderer = (
	props: TransactionsRuleBuilderProps,
) => React.ReactNode;
