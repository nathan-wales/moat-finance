import {
	filterMcpScopes,
	filterScopesForAvailability,
	type McpScope,
	mcpScopes,
} from "./scopes";

export const privacyLevels = ["full", "essential", "custom"] as const;
export type PrivacyLevel = (typeof privacyLevels)[number];

export const privacyPermissionSections = ["read", "actions"] as const;
export type PrivacyPermissionSection =
	(typeof privacyPermissionSections)[number];

export const privacyItemIds = [
	"accounts",
	"transactions",
	"budgets",
	"forecasts",
	"rules",
	"memories",
	"insurance",
	"assets-liabilities",
	"profile",
	"tax",
	"community-tips",
	"notifications",
	"retirement",
	"save-memories",
	"create-reports",
	"send-feedback",
	"manage-community-tips",
	"manage-rules",
	"edit-transactions",
	"manage-budgets",
	"manage-notifications",
	"manage-retirement-scenarios",
	"manage-taxes",
] as const;

export type PrivacyItemId = (typeof privacyItemIds)[number];

export type PrivacyPermissionItem = {
	id: PrivacyItemId;
	label: string;
	scopes: readonly McpScope[];
};

export type PrivacyDomain = {
	id: string;
	label: string;
	description: string;
	section: PrivacyPermissionSection;
	items: readonly PrivacyPermissionItem[];
};

export const privacyDomains = [
	{
		id: "financial-accounts",
		label: "Financial Accounts",
		description: "Accounts, transactions, balances, and budgets.",
		section: "read",
		items: [
			{
				id: "accounts",
				label: "Accounts",
				scopes: ["mcp:accounts:read"],
			},
			{
				id: "transactions",
				label: "Transactions",
				scopes: ["mcp:transactions:read"],
			},
			{
				id: "budgets",
				label: "Budgets",
				scopes: ["mcp:budget:read"],
			},
		],
	},
	{
		id: "planning",
		label: "Planning",
		description: "Forecasts, scenarios, and categorization rules.",
		section: "read",
		items: [
			{
				id: "forecasts",
				label: "Forecasts",
				scopes: ["mcp:forecast:read"],
			},
			{
				id: "retirement",
				label: "Retirement plans",
				scopes: ["mcp:retirement:read"],
			},
			{
				id: "rules",
				label: "Rules",
				scopes: ["mcp:rules:read"],
			},
			{
				id: "notifications",
				label: "Notifications",
				scopes: ["mcp:notifications:read"],
			},
		],
	},
	{
		id: "sensitive",
		label: "Sensitive",
		description:
			"Notes, memories, insurance, assets, liabilities, profile, and tax context.",
		section: "read",
		items: [
			{
				id: "memories",
				label: "Notes & Memories",
				scopes: ["mcp:memories:read"],
			},
			{
				id: "insurance",
				label: "Insurance Policies",
				scopes: ["mcp:insurance:read"],
			},
			{
				id: "assets-liabilities",
				label: "Assets & Liabilities",
				scopes: ["mcp:assets:read"],
			},
			{
				id: "profile",
				label: "Profile",
				scopes: ["mcp:profile:read"],
			},
			{
				id: "tax",
				label: "Taxes",
				scopes: ["mcp:tax:read"],
			},
			{
				id: "community-tips",
				label: "Community Tips",
				scopes: ["mcp:community-tips:read"],
			},
		],
	},
	{
		id: "actions",
		label: "AI Actions",
		description: "Things the AI can create or change on your behalf.",
		section: "actions",
		items: [
			{
				id: "save-memories",
				label: "Save memories",
				scopes: ["mcp:memories:write"],
			},
			{
				id: "create-reports",
				label: "Create reports",
				scopes: ["mcp:reports:write"],
			},
			{
				id: "send-feedback",
				label: "Send feedback",
				scopes: ["mcp:feedback:write"],
			},
			{
				id: "manage-community-tips",
				label: "Create & update community tips",
				scopes: ["mcp:community-tips:write"],
			},
			{
				id: "manage-rules",
				label: "Manage rules",
				scopes: ["mcp:rules:write"],
			},
			{
				id: "edit-transactions",
				label: "Edit and import transactions",
				scopes: ["mcp:transactions:write"],
			},
			{
				id: "manage-budgets",
				label: "Manage budgets",
				scopes: ["mcp:budget:write"],
			},
			{
				id: "manage-notifications",
				label: "Manage notifications",
				scopes: ["mcp:notifications:write"],
			},
			{
				id: "manage-retirement-scenarios",
				label: "Manage retirement scenarios",
				scopes: ["mcp:retirement:write"],
			},
			{
				id: "manage-taxes",
				label: "Manage taxes",
				scopes: ["mcp:tax:write"],
			},
		],
	},
] as const satisfies readonly PrivacyDomain[];

export const consumerPrivacyLevelPresets: {
	id: PrivacyLevel;
	label: string;
	description: string;
	recommended?: boolean;
}[] = [
	{
		id: "full",
		label: "Full Financial Assistant",
		description:
			"Gives your AI access to all available Moat permissions — accounts, planning, sensitive data, and write actions — so it can answer questions, build plans, and take action on your behalf.",
		recommended: true,
	},
	{
		id: "essential",
		label: "Essential Financial Data",
		description:
			"Transactions, accounts, balances, budgets, categories, recurring expenses, and cash flow. Does not include memories, insurance, assets, profile, tax, reports, or write actions.",
	},
	{
		id: "custom",
		label: "Custom",
		description: "Configure exactly what your AI can access.",
	},
];

const essentialPrivacyItemIds = [
	"accounts",
	"transactions",
	"budgets",
	"forecasts",
	"rules",
] as const satisfies readonly PrivacyItemId[];

const allPrivacyItems: PrivacyPermissionItem[] = privacyDomains.flatMap(
	(domain) => [...domain.items],
);

const privacyItemById = new Map(
	allPrivacyItems.map((item) => [item.id, item] as const),
);

function scopesMatch(
	granted: readonly string[],
	expected: readonly McpScope[],
): boolean {
	if (granted.length !== expected.length) return false;
	const grantedSet = new Set(granted);
	return expected.every((scope) => grantedSet.has(scope));
}

export function isPrivacyLevel(value: string): value is PrivacyLevel {
	return (privacyLevels as readonly string[]).includes(value);
}

export function isPrivacyItemId(value: string): value is PrivacyItemId {
	return (privacyItemIds as readonly string[]).includes(value);
}

export function privacyItemsForAvailableScopes(
	availableScopes: readonly McpScope[] = mcpScopes,
): PrivacyPermissionItem[] {
	const available = new Set(availableScopes);
	return allPrivacyItems.filter((item) =>
		item.scopes.every((scope) => available.has(scope)),
	);
}

export function privacyDomainsForAvailableScopes(
	availableScopes: readonly McpScope[] = mcpScopes,
): PrivacyDomain[] {
	const availableItems = new Set(
		privacyItemsForAvailableScopes(availableScopes).map((item) => item.id),
	);

	return privacyDomains
		.map((domain) => ({
			...domain,
			items: domain.items.filter((item) => availableItems.has(item.id)),
		}))
		.filter((domain) => domain.items.length > 0);
}

export function scopesForPrivacyLevel(
	level: PrivacyLevel,
	options?: {
		availableScopes?: readonly McpScope[];
		selectedItemIds?: readonly PrivacyItemId[];
	},
): McpScope[] {
	const availableScopes = options?.availableScopes ?? mcpScopes;
	const available = new Set(availableScopes);

	if (level === "full") {
		return filterScopesForAvailability([...availableScopes], availableScopes);
	}

	const selectedItemIds =
		level === "essential"
			? essentialPrivacyItemIds.filter((itemId) => {
					const item = privacyItemById.get(itemId);
					return item?.scopes.every((scope) => available.has(scope));
				})
			: (options?.selectedItemIds ?? []);

	const scopes = new Set<McpScope>();
	if (selectedItemIds.length > 0 && available.has("mcp:read")) {
		scopes.add("mcp:read");
	}

	for (const itemId of selectedItemIds) {
		const item = privacyItemById.get(itemId);
		if (!item) continue;
		for (const scope of item.scopes) {
			if (available.has(scope)) scopes.add(scope);
		}
	}

	return filterScopesForAvailability([...scopes], availableScopes);
}

export function detectPrivacyLevel(
	scopes: readonly string[],
	availableScopes: readonly McpScope[] = mcpScopes,
): PrivacyLevel {
	const granted = filterMcpScopes(scopes);
	if (
		scopesMatch(granted, scopesForPrivacyLevel("full", { availableScopes }))
	) {
		return "full";
	}
	if (
		scopesMatch(
			granted,
			scopesForPrivacyLevel("essential", { availableScopes }),
		)
	) {
		return "essential";
	}
	return "custom";
}

export function detectPrivacyItemIds(
	scopes: readonly string[],
): PrivacyItemId[] {
	const granted = new Set(filterMcpScopes(scopes));
	return allPrivacyItems
		.filter((item) => item.scopes.every((scope) => granted.has(scope)))
		.map((item) => item.id);
}

export function privacyLevelLabel(level: PrivacyLevel): string {
	const preset = consumerPrivacyLevelPresets.find(
		(option) => option.id === level,
	);
	return preset?.label ?? "Custom";
}

export function domainSummaryLabels(
	scopes: readonly string[],
): readonly string[] {
	const granted = new Set(filterMcpScopes(scopes));
	const labels: string[] = [];
	const seen = new Set<string>();

	for (const item of allPrivacyItems) {
		if (!item.scopes.every((scope) => granted.has(scope))) continue;
		if (seen.has(item.label)) continue;
		seen.add(item.label);
		labels.push(item.label);
	}

	return labels;
}

export function domainSummaryLabel(scopes: readonly string[]): string {
	const labels = domainSummaryLabels(scopes);
	if (labels.length === 0) return "No data access";
	return labels.join(", ");
}
