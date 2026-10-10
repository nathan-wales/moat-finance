import { TAXES_PRODUCT_ENABLED } from "@moat/contracts/feature-flags";

export const mcpScopes = [
	"mcp:read",
	"mcp:accounts:read",
	"mcp:transactions:read",
	"mcp:rules:read",
	"mcp:budget:read",
	"mcp:forecast:read",
	"mcp:retirement:read",
	"mcp:memories:read",
	"mcp:insurance:read",
	"mcp:assets:read",
	"mcp:profile:read",
	"mcp:tax:read",
	"mcp:tax:write",
	"mcp:memories:write",
	"mcp:reports:write",
	"mcp:feedback:write",
	"mcp:rules:write",
	"mcp:transactions:write",
	"mcp:budget:write",
	"mcp:community-tips:read",
	"mcp:community-tips:write",
	"mcp:notifications:read",
	"mcp:notifications:write",
	"mcp:retirement:write",
] as const;

export type McpScope = (typeof mcpScopes)[number];

export const taxMcpScopes = [
	"mcp:tax:read",
	"mcp:tax:write",
] as const satisfies readonly McpScope[];

const taxMcpScopeSet = new Set<string>(taxMcpScopes);

export function isTaxMcpScope(scope: string): boolean {
	return taxMcpScopeSet.has(scope);
}

export function advertisedMcpScopes(
	scopes: readonly McpScope[] = mcpScopes,
): McpScope[] {
	if (TAXES_PRODUCT_ENABLED) return [...scopes];
	return scopes.filter((scope) => !taxMcpScopeSet.has(scope));
}

export const desktopMcpScopes = mcpScopes.filter(
	(scope) =>
		scope !== "mcp:community-tips:read" && scope !== "mcp:community-tips:write",
);

export const defaultMcpScopes = [
	"mcp:read",
	"mcp:accounts:read",
	"mcp:transactions:read",
	"mcp:budget:read",
	"mcp:forecast:read",
	"mcp:retirement:read",
	"mcp:feedback:write",
] as const satisfies readonly McpScope[];

export const mcpScopeLabels: Record<McpScope, string> = {
	"mcp:read": "Basic app access",
	"mcp:accounts:read": "View accounts",
	"mcp:transactions:read": "View transactions",
	"mcp:budget:read": "View budgets",
	"mcp:forecast:read": "View forecasts",
	"mcp:retirement:read": "View retirement plans",
	"mcp:rules:read": "View rules",
	"mcp:memories:read": "Read memories",
	"mcp:insurance:read": "View insurance policies",
	"mcp:assets:read": "View assets & liabilities",
	"mcp:profile:read": "View profile",
	"mcp:tax:read": "View taxes",
	"mcp:tax:write": "Upload tax documents and confirm tax facts",
	"mcp:memories:write": "Save memories",
	"mcp:reports:write": "Create reports",
	"mcp:feedback:write": "Send feedback",
	"mcp:rules:write": "Create, manage, and apply rules",
	"mcp:transactions:write": "Edit, hide, and import transactions",
	"mcp:budget:write": "Adjust and delete budgets",
	"mcp:community-tips:read": "View community tips",
	"mcp:community-tips:write": "Create and update community tips",
	"mcp:notifications:read": "View notification rules and history",
	"mcp:notifications:write": "Create and manage notification rules",
	"mcp:retirement:write": "Create and manage retirement scenarios",
};

export const readScopes = [
	"mcp:read",
	"mcp:accounts:read",
	"mcp:transactions:read",
	"mcp:budget:read",
	"mcp:forecast:read",
	"mcp:rules:read",
	"mcp:memories:read",
	"mcp:insurance:read",
	"mcp:assets:read",
	"mcp:profile:read",
	"mcp:tax:read",
	"mcp:community-tips:read",
	"mcp:notifications:read",
	"mcp:retirement:read",
] as const satisfies readonly McpScope[];

export const writeScopes = [
	"mcp:memories:write",
	"mcp:reports:write",
	"mcp:feedback:write",
	"mcp:rules:write",
	"mcp:transactions:write",
	"mcp:budget:write",
	"mcp:community-tips:write",
	"mcp:notifications:write",
	"mcp:retirement:write",
	"mcp:tax:write",
] as const satisfies readonly McpScope[];

export const financialWriteScopes = [
	"mcp:rules:write",
	"mcp:transactions:write",
	"mcp:budget:write",
	"mcp:notifications:write",
	"mcp:retirement:write",
	"mcp:tax:write",
] as const satisfies readonly McpScope[];

export const financialAssistantMcpScopes = [
	...readScopes,
	...financialWriteScopes,
	"mcp:feedback:write",
] as const satisfies readonly McpScope[];

export type McpScopePreset =
	| "recommended"
	| "read-only-full"
	| "financial-assistant"
	| "custom";

export const mcpScopePresetOptions: {
	id: McpScopePreset;
	label: string;
	description: string;
}[] = [
	{
		id: "recommended",
		label: "Recommended",
		description:
			"Best for local AI tools. Can view your accounts, transactions, budgets, forecasts, and retirement plan, and send feedback when something is missing or an MCP tool fails.",
	},
	{
		id: "read-only-full",
		label: "Read-only full access",
		description:
			"Can view all financial context, including rules and memories.",
	},
	{
		id: "financial-assistant",
		label: "Financial assistant",
		description:
			"Can view financial context and make changes: create rules, edit transactions, adjust budgets, and manage retirement scenarios. Also send feedback.",
	},
	{
		id: "custom",
		label: "Custom",
		description: "Choose exactly what this token can access.",
	},
];

export function mcpScopeLabel(scope: McpScope): string {
	return mcpScopeLabels[scope];
}

function scopesMatch(
	granted: readonly string[],
	expected: readonly McpScope[],
): boolean {
	if (granted.length !== expected.length) return false;
	const grantedSet = new Set(granted);
	return expected.every((scope) => grantedSet.has(scope));
}

export function filterScopesForAvailability(
	scopes: readonly McpScope[],
	availableScopes: readonly McpScope[],
): McpScope[] {
	const available = new Set(availableScopes);
	return scopes.filter((scope) => available.has(scope));
}

export function scopesForMcpPreset(
	preset: Exclude<McpScopePreset, "custom">,
	availableScopes: readonly McpScope[] = mcpScopes,
): McpScope[] {
	const source =
		preset === "recommended"
			? defaultMcpScopes
			: preset === "read-only-full"
				? readScopes
				: financialAssistantMcpScopes;
	return filterScopesForAvailability(source, availableScopes);
}

export function detectMcpScopePreset(
	scopes: readonly McpScope[],
	availableScopes: readonly McpScope[] = mcpScopes,
): McpScopePreset {
	if (scopesMatch(scopes, scopesForMcpPreset("recommended", availableScopes))) {
		return "recommended";
	}
	if (
		scopesMatch(scopes, scopesForMcpPreset("read-only-full", availableScopes))
	) {
		return "read-only-full";
	}
	if (
		scopesMatch(
			scopes,
			scopesForMcpPreset("financial-assistant", availableScopes),
		)
	) {
		return "financial-assistant";
	}
	return "custom";
}

export function isMcpScope(scope: string): scope is McpScope {
	return (mcpScopes as readonly string[]).includes(scope);
}

export function filterMcpScopes(scopes: readonly string[]): McpScope[] {
	return scopes.filter(isMcpScope);
}

export function hasRequiredScopes(
	grantedScopes: readonly string[],
	requiredScopes: readonly McpScope[],
): boolean {
	const granted = new Set(grantedScopes);
	return requiredScopes.every((scope) => {
		if (granted.has(scope)) return true;
		if (scope.endsWith(":read") && granted.has("mcp:read")) return true;
		return false;
	});
}
