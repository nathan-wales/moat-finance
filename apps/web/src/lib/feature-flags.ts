"use client";

import {
	AMAZON_RETAIL_SYNC_FEATURE_FLAG,
	isClientFeatureFlagVisible,
} from "@moat/contracts";
import { useActiveFeatureFlags, useFeatureFlagEnabled } from "posthog-js/react";
import { useMemo } from "react";

export function useEnabledFeatureFlags(): ReadonlySet<string> {
	const activeFlags = useActiveFeatureFlags();
	return useMemo(() => new Set(activeFlags), [activeFlags]);
}

export function useAmazonRetailSyncEnabled(): boolean {
	return useFeatureFlagEnabled(AMAZON_RETAIL_SYNC_FEATURE_FLAG) === true;
}

export function visibleWhenFlagEnabled<T extends { featureFlag?: string }>(
	items: readonly T[],
	enabledFlags: ReadonlySet<string>,
): T[] {
	return items.filter((item) =>
		isClientFeatureFlagVisible(item.featureFlag, enabledFlags),
	);
}
