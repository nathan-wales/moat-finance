import {
	AlignLeft,
	CircleDollarSign,
	CreditCard,
	EyeOff,
	Folder,
	Hash,
	type LucideIcon,
	StickyNote,
	Store,
} from "lucide-react";
import type { RuleActionType, RuleField, RuleOperator } from "./types";

export const FIELDS: {
	value: RuleField;
	label: string;
	kind: "text" | "number" | "date";
	icon: LucideIcon;
}[] = [
	{ value: "MERCHANT", label: "Merchant", kind: "text", icon: Store },
	{
		value: "DESCRIPTION",
		label: "Description",
		kind: "text",
		icon: AlignLeft,
	},
	{
		value: "AMOUNT",
		label: "Amount",
		kind: "number",
		icon: CircleDollarSign,
	},
	{ value: "CATEGORY", label: "Category", kind: "text", icon: Folder },
	{ value: "ACCOUNT", label: "Account", kind: "text", icon: CreditCard },
	{ value: "NOTES", label: "Notes", kind: "text", icon: StickyNote },
];

export const TEXT_OPERATORS: { value: RuleOperator; label: string }[] = [
	{ value: "CONTAINS", label: "contains" },
	{ value: "NOT_CONTAINS", label: "does not contain" },
	{ value: "STARTS_WITH", label: "starts with" },
	{ value: "ENDS_WITH", label: "ends with" },
	{ value: "EQUALS", label: "equals" },
	{ value: "NOT_EQUALS", label: "does not equal" },
	{ value: "IS_EMPTY", label: "is empty" },
	{ value: "IS_NOT_EMPTY", label: "is not empty" },
];

export const NUMBER_OPERATORS: { value: RuleOperator; label: string }[] = [
	{ value: "EQUALS", label: "equals" },
	{ value: "NOT_EQUALS", label: "does not equal" },
	{ value: "GREATER_THAN", label: "greater than" },
	{ value: "GREATER_THAN_OR_EQUAL", label: "greater than or equal" },
	{ value: "LESS_THAN", label: "less than" },
	{ value: "LESS_THAN_OR_EQUAL", label: "less than or equal" },
	{ value: "BETWEEN", label: "between" },
];

export const ACTION_TYPES: {
	value: RuleActionType;
	label: string;
	icon: LucideIcon;
}[] = [
	{ value: "SET_CATEGORY", label: "Set category", icon: Folder },
	{ value: "SET_DESCRIPTION", label: "Set description", icon: AlignLeft },
	{ value: "SET_TYPE", label: "Hide transaction", icon: EyeOff },
	{ value: "ADD_HASHTAG", label: "Add hashtag", icon: Hash },
];

export const NO_VALUE_OPS = new Set<RuleOperator>(["IS_EMPTY", "IS_NOT_EMPTY"]);

export const PREVIEW_PAGE_SIZE = 3;
export const PREVIEW_FETCH_LIMIT = 50;
