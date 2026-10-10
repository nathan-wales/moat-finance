import {
	BUDGET_ALERT_EMPTY_THRESHOLD,
	buildBudgetAlertCopy,
} from "@moat/domain";
import {
	transactionalEmailFooterHtml,
	transactionalEmailFooterText,
} from "~/lib/email/email-footer";
import { resolveEmailWebOrigin } from "~/lib/web-origin";

export type BudgetAlertPurchase = {
	label: string;
	amount: number;
};

export type BudgetAlertEmailInput = {
	categoryName: string;
	spent: number;
	monthlyGoal: number;
	threshold: number;
	percentOfMonthElapsed?: number;
	purchases?: BudgetAlertPurchase[];
	periodFrom?: string;
	periodTo?: string;
};

const NAVY = "#0F2744";
const BODY = "#334155";
const MUTED = "#64748B";
const PAGE_BG = "#EEF0F3";
const CARD_BG = "#FFFFFF";
const TRACK = "#E5E7EB";
const OVER_BUDGET = "#B91C1C";
const BADGE_BG = "#EEF2FF";
const RULE = "#E5E7EB";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const APP_ROOT = resolveEmailWebOrigin();
const APP_BUDGET = `${APP_ROOT}/budget`;

export function buildBudgetAlertTransactionsUrl(input: {
	categoryName: string;
	from?: string;
	to?: string;
}): string {
	const params = new URLSearchParams({
		category: input.categoryName,
		type: "expense",
		sort: "amount-desc",
	});
	if (input.from) params.set("from", input.from);
	if (input.to) params.set("to", input.to);
	return `${APP_ROOT}/transactions?${params.toString()}`;
}

function money(value: number, fractionDigits = 0): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: fractionDigits,
		minimumFractionDigits: fractionDigits,
	}).format(value);
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function progressBarHtml(percentUsed: number, overBudget: boolean): string {
	const pct = Math.max(0, Math.min(100, Math.round(percentUsed)));
	const fill = overBudget ? OVER_BUDGET : NAVY;
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${TRACK};border-radius:6px;">
		<tr>
			<td style="padding:0;font-size:0;line-height:0;">
				<table role="presentation" width="${pct}%" cellpadding="0" cellspacing="0" style="height:8px;">
					<tr>
						<td style="background:${fill};height:8px;border-radius:6px;font-size:1px;line-height:8px;">&nbsp;</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>`;
}

function badgeHtml(label: string, overBudget: boolean): string {
	const background = overBudget ? "#FEF2F2" : BADGE_BG;
	const color = overBudget ? OVER_BUDGET : NAVY;
	return `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${background};color:${color};font-size:12px;font-weight:700;letter-spacing:0.02em;">${escapeHtml(label)}</span>`;
}

function purchasesHtml(
	purchases: BudgetAlertPurchase[],
	transactionsUrl: string,
): string {
	if (purchases.length === 0) {
		return `<p style="margin:0 0 20px;font-size:14px;color:${MUTED};">No purchases in this category yet this month.</p>`;
	}

	const rows = purchases
		.map((purchase) => {
			return `<tr>
				<td style="padding:10px 0;border-bottom:1px solid #F1F5F9;font-size:14px;color:${BODY};">${escapeHtml(purchase.label)}</td>
				<td style="padding:10px 8px 10px 0;border-bottom:1px solid #F1F5F9;text-align:right;font-size:14px;font-weight:600;color:${NAVY};white-space:nowrap;">${money(purchase.amount, 2)}</td>
				<td style="padding:10px 0;border-bottom:1px solid #F1F5F9;text-align:right;width:28px;">
					<a href="${transactionsUrl}" style="color:${NAVY};text-decoration:none;font-size:16px;line-height:1;" aria-label="See more and recategorize">↗</a>
				</td>
			</tr>`;
		})
		.join("");

	return `
		<p style="margin:0 0 8px;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};font-weight:600;">Top purchases</p>
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
			${rows}
		</table>
		<p style="margin:0 0 24px;font-size:13px;">
			<a href="${transactionsUrl}" style="color:${NAVY};font-weight:600;text-decoration:none;">See these on Transactions ↗</a>
		</p>
	`;
}

function sectionMetrics(input: BudgetAlertEmailInput): {
	copy: ReturnType<typeof buildBudgetAlertCopy>;
	percentUsed: number;
	overBudget: boolean;
	badgeLabel: string;
	transactionsUrl: string;
	purchases: BudgetAlertPurchase[];
} {
	const copy = buildBudgetAlertCopy(input);
	const percentUsed =
		input.monthlyGoal > 0
			? Math.round((input.spent / input.monthlyGoal) * 100)
			: 0;
	const isHundred = input.threshold >= BUDGET_ALERT_EMPTY_THRESHOLD;
	return {
		copy,
		percentUsed,
		overBudget: percentUsed >= 100 || isHundred,
		badgeLabel: `${input.threshold}%`,
		transactionsUrl: buildBudgetAlertTransactionsUrl({
			categoryName: input.categoryName,
			from: input.periodFrom,
			to: input.periodTo,
		}),
		purchases: input.purchases ?? [],
	};
}

function sectionHtml(
	input: BudgetAlertEmailInput,
	options: { includeBadge: boolean },
): string {
	const metrics = sectionMetrics(input);
	const badgeRow = options.includeBadge
		? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
				<tr>
					<td></td>
					<td style="text-align:right;">${badgeHtml(metrics.badgeLabel, metrics.overBudget)}</td>
				</tr>
			</table>`
		: "";
	return `
		${badgeRow}
		<h1 style="margin: 0 0 12px; font-size: 22px; color: ${NAVY};">${escapeHtml(metrics.copy.title)}</h1>
		<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">${escapeHtml(metrics.copy.body)}</p>
		${progressBarHtml(metrics.percentUsed, metrics.overBudget)}
		<p style="margin:8px 0 20px;font-size:14px;color:${MUTED};">
			${escapeHtml(money(input.spent))} of ${escapeHtml(money(input.monthlyGoal))} · ${metrics.percentUsed}% used
		</p>
		${purchasesHtml(metrics.purchases, metrics.transactionsUrl)}
	`;
}

function sectionSeparatorHtml(): string {
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
		<tr>
			<td style="border-top:1px solid ${RULE};font-size:0;line-height:0;height:1px;">&nbsp;</td>
		</tr>
	</table>`;
}

function sectionText(input: BudgetAlertEmailInput): string[] {
	const metrics = sectionMetrics(input);
	const textPurchases =
		metrics.purchases.length === 0
			? ["No purchases in this category yet this month."]
			: [
					"Top purchases",
					...metrics.purchases.map(
						(purchase) => `${purchase.label}: ${money(purchase.amount, 2)}`,
					),
					`See these on Transactions: ${metrics.transactionsUrl}`,
				];
	return [
		metrics.copy.title,
		metrics.copy.body,
		`Used: ${metrics.percentUsed}%`,
		`Spent: ${money(input.spent)} of ${money(input.monthlyGoal)}`,
		...textPurchases,
	];
}

export function renderBudgetAlertsDigestEmail(input: {
	sections: BudgetAlertEmailInput[];
}): {
	subject: string;
	html: string;
	text: string;
} {
	const sections = input.sections;
	const first = sections[0];
	const isDigest = sections.length > 1;
	const firstMetrics = first ? sectionMetrics(first) : null;
	const subject = isDigest
		? `${sections.length} budget alerts`
		: (firstMetrics?.copy.title ?? "Budget alerts");
	const headerLabel = isDigest ? "Budget alerts" : "Budget alert";
	const headerBadge =
		!isDigest && firstMetrics
			? badgeHtml(firstMetrics.badgeLabel, firstMetrics.overBudget)
			: "";

	const sectionsHtml = sections
		.map((section, index) => {
			const body = sectionHtml(section, { includeBadge: isDigest });
			if (index === 0) return body;
			return `${sectionSeparatorHtml()}${body}`;
		})
		.join("");

	const html = `
		<div style="font-family: ${FONT}; background: ${PAGE_BG}; padding: 24px; color: ${BODY};">
			<div style="max-width: 560px; margin: 0 auto; background: ${CARD_BG}; border-radius: 12px; padding: 28px;">
				<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
					<tr>
						<td style="color:${MUTED};font-size:12px;letter-spacing:0.04em;text-transform:uppercase;">${headerLabel}</td>
						<td style="text-align:right;">${headerBadge}</td>
					</tr>
				</table>
				${sectionsHtml}
				<p style="margin: 0 0 24px;">
					<a href="${APP_BUDGET}" style="display: inline-block; background: ${NAVY}; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-size: 14px;">
						Review budget
					</a>
				</p>
				<p style="margin:0 0 4px;font-size:14px;color:${BODY};">Don't want this alert?</p>
				<p style="margin:0;font-size:13px;line-height:1.5;color:${MUTED};">
					Turn it off or change the 75% and 100% settings on your
					<a href="${APP_BUDGET}" style="color:${NAVY};font-weight:600;text-decoration:none;">budget page</a>.
				</p>
				${transactionalEmailFooterHtml()}
			</div>
		</div>
	`;

	const textSections = sections.flatMap((section, index) => {
		const lines = sectionText(section);
		if (index === 0) return lines;
		return ["---", ...lines];
	});

	const text = [
		...textSections,
		`Review your budget: ${APP_BUDGET}`,
		"Don't want this alert? Turn it off or change the settings on your budget page.",
		transactionalEmailFooterText(),
	].join("\n");

	return { subject, html, text };
}

export function renderBudgetAlertEmail(input: BudgetAlertEmailInput): {
	subject: string;
	html: string;
	text: string;
} {
	return renderBudgetAlertsDigestEmail({ sections: [input] });
}
