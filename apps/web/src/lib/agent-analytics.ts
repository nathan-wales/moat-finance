"use client";

import { captureWithCurrentIdentity } from "~/lib/analytics";

type MoatAiEvent =
	| "moat_finance_ai_panel_opened"
	| "moat_finance_ai_panel_closed"
	| "moat_finance_ai_message_sent"
	| "moat_finance_ai_run_completed"
	| "moat_finance_ai_run_aborted"
	| "moat_finance_ai_run_failed"
	| "moat_finance_ai_conversation_reset"
	| "moat_finance_ai_acknowledgement_accepted"
	| "moat_finance_ai_suggested_prompt_clicked";

/**
 * Track a Moat AI event.
 * Only pass safe, non-PII properties (counts, booleans, enums).
 */
export function trackMoatAi(
	event: MoatAiEvent,
	properties: Record<string, unknown> = {},
) {
	captureWithCurrentIdentity(event, properties);
}
