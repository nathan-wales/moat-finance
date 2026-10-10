export type GenerateNotificationAiPromptInput = {
	goal: string;
	extraContext?: string;
};

export type GenerateNotificationAiPromptResult = {
	prompt: string;
};

export function generateNotificationAiPrompt(
	input: GenerateNotificationAiPromptInput,
): GenerateNotificationAiPromptResult {
	const goal = input.goal.trim();
	const extra = input.extraContext?.trim();

	const lines = [
		"Help me create a Moat notification / monitoring rule using the Moat MCP notification tools.",
		"",
		"Before you create anything, follow this exact sequence:",
		"",
		"1. Feasibility check — Decide whether my request can be expressed with Moat's structured monitoring config (watchQuery: source → filter → window → measure → predicate → report → delivery, or a legacy signalType). Moat is robust (counts/sums, day-of-month windows, keyword/amount/category filters, budget %, expected-vs-actual reports, schedules). If it is not possible with typed config alone (no custom SQL or arbitrary code), say so clearly and suggest the closest supported alternative. Do not create a rule you cannot honestly express.",
		"",
		'2. Confirm with me first — Restate in simple, everyday language what alert you think I want (what to watch, when it matters, how often I get notified, and where). End with: "Does that sound right? If so, I\'ll make it." Wait for my explicit yes before calling moat.createNotificationRule. Do not create the rule in the same turn as the restatement.',
		"",
		"3. Only after I confirm — Create the rule with moat.createNotificationRule:",
		"- Prefer watchQuery for counts, sums, day-of-month windows, status/expected-vs-actual reports, and budget percent watches.",
		"- Prefer a clear name and plainLanguageSummary so I can recognize it in Moat Notifications.",
		"- Require confirmed: true for high-frequency rules, external recipients, or sensitive tax/insurance/debt/investment domains.",
		"- After creation, remind me that the rule appears under Notifications in Moat and stays editable/pausable there.",
		"",
		"Moat evaluates rules about once per day, so prefer daily digests or monthly_on_day schedules over assuming real-time delivery.",
		"",
		`What I want to be notified about: ${goal}`,
	];

	if (extra) {
		lines.push(`Additional context: ${extra}`);
	}

	lines.push(
		"",
		"You may use moat.listNotificationRules to avoid duplicates or inspect my existing alerts.",
	);

	return { prompt: lines.join("\n") };
}
