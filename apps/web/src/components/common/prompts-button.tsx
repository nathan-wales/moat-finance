"use client";

import {
	PromptCardCta as BasePromptCardCta,
	PromptMenu as BasePromptMenu,
	type PromptCardCtaProps,
	type PromptMenuProps,
} from "@moat/features";
import { captureWithCurrentIdentity } from "~/lib/analytics";

/**
 * Web-specific PromptMenu that injects PostHog analytics.
 * Call sites in the web app import from here; the shared logic lives in @moat/features.
 */
export function PromptMenu(props: Omit<PromptMenuProps, "onCapture">) {
	return (
		<BasePromptMenu
			{...props}
			onCapture={(event, captureProps) =>
				captureWithCurrentIdentity(event, captureProps)
			}
		/>
	);
}

/**
 * Web-specific PromptCardCta that injects PostHog analytics.
 */
export function PromptCardCta(props: Omit<PromptCardCtaProps, "onCapture">) {
	return (
		<BasePromptCardCta
			{...props}
			onCapture={(event, captureProps) =>
				captureWithCurrentIdentity(event, captureProps)
			}
		/>
	);
}
