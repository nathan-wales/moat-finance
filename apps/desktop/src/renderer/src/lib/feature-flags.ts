import {
	DESKTOP_REMOTE_MCP_FEATURE_FLAG,
	isClientFeatureFlagVisible,
} from "@moat/contracts";
import { useActiveFeatureFlags } from "posthog-js/react";
import { useMemo } from "react";

export function useEnabledFeatureFlags(): ReadonlySet<string> {
	const activeFlags = useActiveFeatureFlags();
	return useMemo(() => new Set(activeFlags), [activeFlags]);
}

export function useDesktopRemoteMcpEnabled(): boolean {
	const enabledFlags = useEnabledFeatureFlags();
	if (import.meta.env.VITE_MOAT_DESKTOP_REMOTE_MCP === "1") return true;
	return enabledFlags.has(DESKTOP_REMOTE_MCP_FEATURE_FLAG);
}

export function visibleWhenFlagEnabled<T extends { featureFlag?: string }>(
	items: readonly T[],
	enabledFlags: ReadonlySet<string>,
): T[] {
	return items.filter((item) =>
		isClientFeatureFlagVisible(item.featureFlag, enabledFlags),
	);
}
