import {
	advertisedMcpScopes,
	detectPrivacyItemIds,
	domainSummaryLabels,
	type McpScope,
	type PrivacyItemId,
	type PrivacyLevel,
	privacyDomainsForAvailableScopes,
	scopesForPrivacyLevel,
} from "@moat/mcp-contracts";
import { useCallback, useEffect, useMemo, useState } from "react";

const defaultAdvertisedMcpScopes = advertisedMcpScopes();

function readOnlyScopes(scopes: readonly McpScope[]): McpScope[] {
	return scopes.filter(
		(scope) => scope === "mcp:read" || scope.endsWith(":read"),
	);
}

export function usePrivacyAccessSelection(
	availableScopes: readonly McpScope[] = defaultAdvertisedMcpScopes,
	options?: { defaultReadOnly?: boolean },
) {
	const defaultReadOnly = options?.defaultReadOnly === true;
	const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>(
		defaultReadOnly ? "custom" : "full",
	);
	const [selectedItemIds, setSelectedItemIds] = useState<PrivacyItemId[]>([]);
	const [appliedReadOnlyDefaults, setAppliedReadOnlyDefaults] = useState(false);

	const availableDomains = useMemo(
		() => privacyDomainsForAvailableScopes(availableScopes),
		[availableScopes],
	);

	const grantedScopes = useMemo(
		() =>
			scopesForPrivacyLevel(privacyLevel, {
				availableScopes,
				selectedItemIds,
			}),
		[availableScopes, privacyLevel, selectedItemIds],
	);

	const accessLabels = useMemo(
		() => domainSummaryLabels(grantedScopes),
		[grantedScopes],
	);

	useEffect(() => {
		if (!defaultReadOnly || appliedReadOnlyDefaults) return;
		if (availableScopes.length === 0) return;
		setPrivacyLevel("custom");
		setSelectedItemIds(detectPrivacyItemIds(readOnlyScopes(availableScopes)));
		setAppliedReadOnlyDefaults(true);
	}, [appliedReadOnlyDefaults, availableScopes, defaultReadOnly]);

	const reset = useCallback(() => {
		if (defaultReadOnly) {
			setPrivacyLevel("custom");
			setSelectedItemIds(detectPrivacyItemIds(readOnlyScopes(availableScopes)));
			setAppliedReadOnlyDefaults(true);
			return;
		}
		setPrivacyLevel("full");
		setSelectedItemIds([]);
	}, [availableScopes, defaultReadOnly]);

	const handlePrivacyLevelChange = useCallback(
		(level: PrivacyLevel) => {
			setPrivacyLevel(level);
			if (level === "custom" && selectedItemIds.length === 0) {
				setSelectedItemIds(detectPrivacyItemIds(availableScopes));
			}
		},
		[availableScopes, selectedItemIds.length],
	);

	const handleToggleItem = useCallback(
		(itemId: PrivacyItemId, checked: boolean) => {
			setPrivacyLevel("custom");
			setSelectedItemIds((current) =>
				checked
					? [...new Set([...current, itemId])]
					: current.filter((item) => item !== itemId),
			);
		},
		[],
	);

	return {
		privacyLevel,
		selectedItemIds,
		availableDomains,
		grantedScopes,
		accessLabels,
		handlePrivacyLevelChange,
		handleToggleItem,
		reset,
	};
}
