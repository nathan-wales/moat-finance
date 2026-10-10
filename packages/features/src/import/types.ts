export type ImportStep = "upload" | "map" | "preview" | "done";

export const IMPORT_WALKTHROUGH_STEPS = [
	{ id: "upload", label: "Import" },
	{ id: "map", label: "Mapping" },
	{ id: "preview", label: "Preview" },
] as const;

export type ImportWalkthroughStepId =
	(typeof IMPORT_WALKTHROUGH_STEPS)[number]["id"];

export type ColumnMapping = {
	date: string;
	description: string;
	amount: string;
	type?: string;
	category?: string;
	memo?: string;
};

export type ImportMappingTemplate = {
	id: string;
	name: string;
	isDefault: boolean;
	mapping: ColumnMapping;
	accountId: string | null;
};

export const UNASSIGNED_ACCOUNT_VALUE = "__unassigned__";
export const NONE_TEMPLATE_VALUE = "__none__";
