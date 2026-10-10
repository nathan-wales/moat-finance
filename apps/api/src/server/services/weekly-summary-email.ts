import type { FinancialSnapshot } from "@moat/monitoring-rules";
import {
	transactionalEmailFooterHtml,
	transactionalEmailFooterText,
} from "~/lib/email/email-footer";
import { resolveEmailWebOrigin } from "~/lib/web-origin";

export type WeeklySummaryContent = {
	subject: string;
	html: string;
	text: string;
};

const SECTION_IDS = [
	"glance",
	"what_changed",
	"budget_progress",
	"needs_attention",
	"looking_ahead",
	"actions",
] as const;

type SectionId = (typeof SECTION_IDS)[number];

const NAVY = "#0F2744";
const MUTED = "#64748B";
const BODY = "#334155";
const PAGE_BG = "#EEF0F3";
const CARD_BG = "#FFFFFF";
const KPI_BG = "#F7F8FA";
const TRACK = "#E5E7EB";
const POSITIVE = "#047857";
const NEGATIVE = "#B91C1C";
const ATTENTION_BG = "#FFF7ED";
const ATTENTION_BORDER = "#FDBA74";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const APP_ROOT = resolveEmailWebOrigin();
const APP_TRANSACTIONS = `${APP_ROOT}/transactions`;
const APP_SPENDING = `${APP_ROOT}/spending`;
const APP_SETTINGS = `${APP_ROOT}/settings`;
const APP_NOTIFICATIONS = `${APP_ROOT}/notifications`;

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

const NUMBER_WORDS = [
	"zero",
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"seven",
	"eight",
	"nine",
	"ten",
] as const;

function money(value: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(value);
}

function shouldRenderSection(
	sections: string[] | undefined,
	id: SectionId,
): boolean {
	if (!sections || sections.length === 0) return true;
	return sections.includes(id);
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function titleCaseLabel(label: string): string {
	if (!label) return label;
	return label.charAt(0).toUpperCase() + label.slice(1);
}

function prettyPeriodLabel(periodLabel: string): string {
	const match = periodLabel.match(
		/(\d{4})-(\d{2})-(\d{2})\s*[–—-]\s*(\d{4})-(\d{2})-(\d{2})/,
	);
	if (!match) return periodLabel;
	const startMonth = Number(match[2]);
	const startDay = Number(match[3]);
	const endMonth = Number(match[5]);
	const endDay = Number(match[6]);
	const startName = MONTHS[startMonth - 1];
	const endName = MONTHS[endMonth - 1];
	if (!startName || !endName) return periodLabel;
	if (startMonth === endMonth && match[1] === match[4]) {
		return `${startName} ${startDay}–${endDay}`;
	}
	return `${startName} ${startDay}–${endName} ${endDay}`;
}

function oxfordList(items: string[]): string {
	if (items.length === 0) return "";
	if (items.length === 1) return items[0] ?? "";
	if (items.length === 2) return `${items[0]} and ${items[1]}`;
	return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function formatNameList(labels: string[]): string {
	const titled = labels.map(titleCaseLabel);
	if (titled.length <= 5) return oxfordList(titled);
	const shown = titled.slice(0, 5).join(", ");
	const rest = titled.length - 5;
	return `${shown}, and ${rest} other${rest === 1 ? "" : "s"}`;
}

function numberWord(n: number): string {
	return NUMBER_WORDS[n] ?? String(n);
}

function signedColor(value: number): string {
	if (value > 0) return POSITIVE;
	if (value < 0) return NEGATIVE;
	return NAVY;
}

type Insight = {
	icon?: string;
	title: string;
	body: string;
	linkText?: string;
	linkHref?: string;
};

type AttentionBlock = {
	title: string;
	body?: string;
	linkText?: string;
	linkHref?: string;
};

function spendingInsight(snapshot: FinancialSnapshot): Insight | null {
	const average = snapshot.recentAverageWeeklyMoneyOut;
	if (
		average === null ||
		average === undefined ||
		average <= 0 ||
		snapshot.moneyOut <= 0
	) {
		return null;
	}
	const deltaPct = Math.round(((snapshot.moneyOut - average) / average) * 100);
	if (deltaPct === 0) return null;
	const abs = Math.abs(deltaPct);
	if (deltaPct > 0) {
		return {
			icon: "↑",
			title: "Spending jumped this week",
			body: `You spent ${abs}% more than your recent weekly average.`,
			linkText: "Review spending",
			linkHref: APP_SPENDING,
		};
	}
	return {
		icon: "↓",
		title: "Spending was quieter this week",
		body: `You spent ${abs}% less than your recent weekly average.`,
		linkText: "Review spending",
		linkHref: APP_SPENDING,
	};
}

function recurringChangedLabels(snapshot: FinancialSnapshot): string[] {
	const labels: string[] = [];
	for (const item of snapshot.recurring) {
		if (
			item.previousAmount !== null &&
			item.previousAmount !== undefined &&
			item.previousAmount > 0 &&
			Math.abs(item.amount - item.previousAmount) / item.previousAmount >= 0.1
		) {
			labels.push(item.label);
		}
	}
	return labels;
}

function recurringInsight(snapshot: FinancialSnapshot): Insight | null {
	const labels = recurringChangedLabels(snapshot);
	if (labels.length === 0) return null;
	const n = labels.length;
	const list = formatNameList(labels);
	const title =
		n === 1 ? "1 recurring payment changed" : `${n} recurring payments changed`;
	const verb = n === 1 ? "had a different amount" : "had different amounts";
	return {
		icon: "↻",
		title,
		body: `${list} ${verb} than usual.`,
		linkText: "Review recurring payments",
		linkHref: APP_TRANSACTIONS,
	};
}

function highBudgetInsights(snapshot: FinancialSnapshot): Insight[] {
	const cards: Insight[] = [];
	for (const budget of snapshot.budgets) {
		if (budget.monthlyGoal <= 0) continue;
		const paceGap = budget.percentUsed - budget.percentOfMonthElapsed;
		if (paceGap <= 20) continue;
		cards.push({
			icon: "↑",
			title: `${budget.categoryName} spending is unusually high`,
			body: "This category is ahead of pace versus the month so far.",
			linkText: "Review spending",
			linkHref: APP_SPENDING,
		});
		if (cards.length >= 2) break;
	}
	return cards;
}

function collectWhatChanged(snapshot: FinancialSnapshot): Insight[] {
	const cards: Insight[] = [];
	const spending = spendingInsight(snapshot);
	if (spending) cards.push(spending);
	const recurring = recurringInsight(snapshot);
	if (recurring) cards.push(recurring);
	cards.push(...highBudgetInsights(snapshot));
	return cards;
}

function staleConnections(snapshot: FinancialSnapshot) {
	return snapshot.connections.filter(
		(connection) => !connection.lastSuccessfulSyncAtIso,
	);
}

function lowCheckingAccount(snapshot: FinancialSnapshot) {
	return snapshot.accounts.find(
		(account) =>
			/check|spend|everyday/i.test(account.name) &&
			account.currentBalance !== null &&
			account.currentBalance < 1500,
	);
}

function collectAttention(snapshot: FinancialSnapshot): AttentionBlock[] {
	const blocks: AttentionBlock[] = [];
	const stale = staleConnections(snapshot);
	if (stale.length > 0) {
		const n = stale.length;
		const title =
			n === 1 ? "1 account needs attention" : `${n} accounts need attention`;
		const countPhrase = `${numberWord(n)} ${n === 1 ? "account hasn't" : "accounts haven't"}`;
		blocks.push({
			title,
			body: `Some of your financial data may be out of date because ${countPhrase} synced recently.`,
			linkText: "Reconnect accounts",
			linkHref: APP_SETTINGS,
		});
	}
	if (snapshot.uncategorizedCount > 0) {
		const n = snapshot.uncategorizedCount;
		blocks.push({
			title: `${n} transactions still need a category`,
			linkText: "Review transactions",
			linkHref: APP_TRANSACTIONS,
		});
	}
	if (lowCheckingAccount(snapshot)) {
		blocks.push({
			title: "Your checking balance is on the low side.",
		});
	}
	return blocks;
}

function upcomingRecurring(snapshot: FinancialSnapshot): {
	label: string;
	amount: number;
}[] {
	const horizonMs = 14 * 24 * 60 * 60 * 1000;
	const now = Date.now();
	const items: { label: string; amount: number }[] = [];
	for (const item of snapshot.recurring) {
		if (!item.nextExpectedDateIso) continue;
		const next = new Date(item.nextExpectedDateIso);
		if (Number.isNaN(next.getTime())) continue;
		const delta = next.getTime() - now;
		if (delta < 0 || delta > horizonMs) continue;
		items.push({ label: item.label, amount: item.amount });
		if (items.length >= 5) break;
	}
	return items;
}

function configuredBudgets(snapshot: FinancialSnapshot) {
	return snapshot.budgets
		.filter((budget) => budget.monthlyGoal > 0)
		.slice(0, 3);
}

function headingHtml(text: string, icon?: string): string {
	const iconHtml = icon
		? `<span style="display:inline-block;margin-right:8px;color:${NAVY};">${escapeHtml(icon)}</span>`
		: "";
	return `<h2 style="margin:32px 0 24px 0;font-size:18px;line-height:1.3;color:${NAVY};font-weight:700;">${iconHtml}${escapeHtml(text)}</h2>`;
}

function mutedHtml(text: string): string {
	return `<p style="margin:0;font-size:16px;line-height:1.5;color:${MUTED};">${escapeHtml(text)}</p>`;
}

function insightCardHtml(insight: Insight): string {
	const iconHtml = insight.icon
		? `<span style="display:inline-block;width:22px;color:${NAVY};">${escapeHtml(insight.icon)}</span>`
		: "";
	const indent = insight.icon ? "padding-left:22px;" : "";
	const title = `<p style="margin:0 0 6px 0;font-size:16px;line-height:1.4;font-weight:600;color:${NAVY};">${iconHtml}${escapeHtml(insight.title)}</p>`;
	const body = `<p style="margin:0 0 ${insight.linkHref ? "8px" : "0"};${indent}font-size:16px;line-height:1.5;color:${BODY};">${escapeHtml(insight.body)}</p>`;
	const link = insight.linkHref
		? `<p style="margin:0;${indent}font-size:14px;line-height:1.4;"><a href="${insight.linkHref}" style="color:${NAVY};font-weight:600;text-decoration:none;">${escapeHtml(insight.linkText ?? "Learn more")} →</a></p>`
		: "";
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
		<tr><td>${title}${body}${link}</td></tr>
	</table>`;
}

function attentionBlockHtml(block: AttentionBlock): string {
	const title = `<p style="margin:0 0 ${block.body || block.linkHref ? "4px" : "0"};font-size:16px;line-height:1.4;font-weight:600;color:${NAVY};">${escapeHtml(block.title)}</p>`;
	const body = block.body
		? `<p style="margin:0 0 ${block.linkHref ? "8px" : "0"};font-size:16px;line-height:1.5;color:${BODY};">${escapeHtml(block.body)}</p>`
		: "";
	const link = block.linkHref
		? `<p style="margin:0;font-size:14px;line-height:1.4;"><a href="${block.linkHref}" style="color:${NAVY};font-weight:600;text-decoration:none;">${escapeHtml(block.linkText ?? "Open")} →</a></p>`
		: "";
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px 0;">
		<tr><td>${title}${body}${link}</td></tr>
	</table>`;
}

function kpiCell(label: string, value: string, color: string): string {
	return `<td width="50%" valign="top" style="padding:6px;">
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${KPI_BG};border-radius:10px;">
			<tr>
				<td style="padding:16px 14px;">
					<p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};font-weight:600;">${escapeHtml(label)}</p>
					<p style="margin:0;font-size:24px;line-height:1.2;font-weight:700;color:${color};">${escapeHtml(value)}</p>
				</td>
			</tr>
		</table>
	</td>`;
}

function progressBarHtml(percentUsed: number): string {
	const pct = Math.max(0, Math.min(100, Math.round(percentUsed)));
	const width = `${pct}%`;
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${TRACK};border-radius:6px;">
		<tr>
			<td style="padding:0;font-size:0;line-height:0;">
				<table role="presentation" width="${width}" cellpadding="0" cellspacing="0" style="height:8px;">
					<tr>
						<td style="background:${NAVY};height:8px;border-radius:6px;font-size:1px;line-height:8px;">&nbsp;</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>`;
}

function wrapHtml(inner: string): string {
	return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0;padding:0;background:${PAGE_BG};font-family:${FONT};">
	<tr>
		<td align="center" style="padding:24px 12px;background:${PAGE_BG};">
			<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px;background:${CARD_BG};border-radius:12px;">
				<tr>
					<td style="padding:32px 28px;font-family:${FONT};font-size:16px;line-height:1.5;color:${BODY};">
						${inner}
					</td>
				</tr>
			</table>
		</td>
	</tr>
</table>`;
}

export function renderWeeklySummaryEmail(input: {
	snapshot: FinancialSnapshot;
	periodLabel: string;
	includeAiObservations?: boolean;
	sections?: string[];
}): WeeklySummaryContent {
	const net = input.snapshot.moneyIn - input.snapshot.moneyOut;
	const netWorth = input.snapshot.netWorth ?? 0;
	const sections = input.sections;
	const changed = collectWhatChanged(input.snapshot);
	const attention = collectAttention(input.snapshot);
	const budgets = configuredBudgets(input.snapshot);
	const upcoming = upcomingRecurring(input.snapshot);
	const projected = input.snapshot.projectedEndOfMonthCash;
	const hasAlertWorthyInsight =
		spendingInsight(input.snapshot) !== null ||
		recurringInsight(input.snapshot) !== null;
	const showTip = Boolean(input.includeAiObservations) && hasAlertWorthyInsight;
	const tipCopy =
		"Tip: create a persistent alert from any insight that should not wait for next Monday.";

	const htmlParts: string[] = [];
	const textParts: string[] = [];

	if (shouldRenderSection(sections, "glance")) {
		const period = prettyPeriodLabel(input.periodLabel);
		htmlParts.push(`
			<p style="margin:0 0 16px 0;font-size:12px;letter-spacing:0.16em;font-weight:600;color:${MUTED};">MOAT</p>
			<h1 style="margin:0 0 8px 0;font-size:28px;line-height:1.2;color:${NAVY};font-weight:700;">Your week in Moat</h1>
			<p style="margin:0 0 8px 0;font-size:14px;line-height:1.4;color:${MUTED};">${escapeHtml(period)}</p>
			<p style="margin:0 0 20px 0;font-size:16px;line-height:1.5;color:${BODY};">Here's what happened with your money this week.</p>
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;">
				<tr>
					${kpiCell("Money in", money(input.snapshot.moneyIn), NAVY)}
					${kpiCell("Money out", money(input.snapshot.moneyOut), NAVY)}
				</tr>
				<tr>
					${kpiCell("Net cash flow", money(net), signedColor(net))}
					${kpiCell("Net worth", money(netWorth), NAVY)}
				</tr>
			</table>
		`);
		textParts.push(
			"Your week in Moat",
			period,
			"Here's what happened with your money this week.",
			`Money in: ${money(input.snapshot.moneyIn)}`,
			`Money out: ${money(input.snapshot.moneyOut)}`,
			`Net cash flow: ${money(net)}`,
			`Net worth: ${money(netWorth)}`,
			"",
		);
	}

	if (shouldRenderSection(sections, "what_changed")) {
		htmlParts.push(headingHtml("What changed", "↗"));
		textParts.push("What changed");
		if (changed.length === 0) {
			htmlParts.push(mutedHtml("No major shifts detected this week."));
			textParts.push("No major shifts detected this week.", "");
		} else {
			htmlParts.push(
				changed.map((insight) => insightCardHtml(insight)).join(""),
			);
			for (const insight of changed) {
				textParts.push(insight.title, insight.body);
				if (insight.linkHref && insight.linkText) {
					textParts.push(`${insight.linkText}: ${insight.linkHref}`);
				}
			}
			textParts.push("");
		}
	}

	if (shouldRenderSection(sections, "needs_attention")) {
		htmlParts.push(headingHtml("Needs your attention"));
		textParts.push("Needs your attention");
		if (attention.length === 0) {
			htmlParts.push(mutedHtml("Nothing urgent right now."));
			textParts.push("Nothing urgent right now.", "");
		} else {
			htmlParts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ATTENTION_BG};border:1px solid ${ATTENTION_BORDER};border-radius:10px;">
				<tr>
					<td style="padding:16px 18px 4px 18px;">
						${attention.map((block) => attentionBlockHtml(block)).join("")}
					</td>
				</tr>
			</table>`);
			for (const block of attention) {
				textParts.push(block.title);
				if (block.body) textParts.push(block.body);
				if (block.linkHref && block.linkText) {
					textParts.push(`${block.linkText}: ${block.linkHref}`);
				}
			}
			textParts.push("");
		}
	}

	if (shouldRenderSection(sections, "budget_progress")) {
		if (budgets.length === 0) {
			htmlParts.push(`
				${headingHtml("Want to keep spending on track?")}
				<p style="margin:0 0 8px 0;font-size:16px;line-height:1.5;color:${BODY};">You haven't set any category budgets yet.</p>
				<p style="margin:0;font-size:14px;line-height:1.4;"><a href="${APP_SPENDING}" style="color:${NAVY};font-weight:600;text-decoration:none;">Create your first budget →</a></p>
			`);
			textParts.push(
				"Want to keep spending on track?",
				"You haven't set any category budgets yet.",
				`Create your first budget: ${APP_SPENDING}`,
				"",
			);
		} else {
			htmlParts.push(headingHtml("Budget progress"));
			textParts.push("Budget progress");
			const rows = budgets.map((budget) => {
				const spent = `${money(budget.spent)} / ${money(budget.monthlyGoal)}`;
				return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px 0;">
					<tr>
						<td>
							<p style="margin:0 0 8px 0;font-size:16px;line-height:1.4;font-weight:600;color:${NAVY};">${escapeHtml(budget.categoryName)}</p>
							${progressBarHtml(budget.percentUsed)}
							<p style="margin:8px 0 0 0;font-size:14px;line-height:1.4;color:${MUTED};">${escapeHtml(spent)}</p>
						</td>
					</tr>
				</table>`;
			});
			htmlParts.push(rows.join(""));
			for (const budget of budgets) {
				textParts.push(
					budget.categoryName,
					`${money(budget.spent)} / ${money(budget.monthlyGoal)}`,
				);
			}
			textParts.push("");
		}
	}

	if (shouldRenderSection(sections, "looking_ahead") && upcoming.length > 0) {
		htmlParts.push(headingHtml("Looking ahead"));
		textParts.push("Looking ahead");
		htmlParts.push(
			`<p style="margin:0 0 8px 0;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${MUTED};font-weight:600;">Coming up</p>`,
		);
		const rows = upcoming
			.map(
				(item) => `<tr>
							<td style="padding:8px 0;font-size:16px;color:${BODY};border-bottom:1px solid #F1F5F9;">${escapeHtml(titleCaseLabel(item.label))}</td>
							<td align="right" style="padding:8px 0;font-size:16px;color:${NAVY};font-weight:600;white-space:nowrap;border-bottom:1px solid #F1F5F9;">${escapeHtml(money(item.amount))}</td>
						</tr>`,
			)
			.join("");
		htmlParts.push(
			`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`,
		);
		textParts.push("Coming up");
		for (const item of upcoming) {
			textParts.push(`${titleCaseLabel(item.label)}: ${money(item.amount)}`);
		}
		if (typeof projected === "number") {
			htmlParts.push(`
					<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0 0;">
						<tr><td style="border-top:1px solid ${TRACK};font-size:1px;line-height:1px;">&nbsp;</td></tr>
					</table>
					<p style="margin:16px 0 6px 0;font-size:14px;line-height:1.4;color:${MUTED};">Projected month-end cash</p>
					<p style="margin:0;font-size:26px;line-height:1.2;font-weight:700;color:${NAVY};">${escapeHtml(money(projected))}</p>
				`);
			textParts.push(`Projected month-end cash: ${money(projected)}`);
		}
		textParts.push("");
	}

	if (shouldRenderSection(sections, "actions")) {
		htmlParts.push(`
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 16px 0;">
				<tr>
					<td align="center">
						<a href="${APP_ROOT}" style="display:inline-block;background:${NAVY};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">Open Moat →</a>
					</td>
				</tr>
			</table>
			<p style="margin:0;text-align:center;font-size:13px;line-height:1.6;color:${MUTED};">
				<a href="${APP_TRANSACTIONS}" style="color:${MUTED};text-decoration:underline;">Review transactions</a>
				&nbsp;·&nbsp;
				<a href="${APP_SPENDING}" style="color:${MUTED};text-decoration:underline;">Manage budgets</a>
				&nbsp;·&nbsp;
				<a href="${APP_NOTIFICATIONS}" style="color:${MUTED};text-decoration:underline;">Notifications</a>
			</p>
		`);
		textParts.push(
			`Open Moat: ${APP_ROOT}`,
			`Review transactions: ${APP_TRANSACTIONS}`,
			`Manage budgets: ${APP_SPENDING}`,
			`Notifications: ${APP_NOTIFICATIONS}`,
			"",
		);
	}

	if (showTip) {
		htmlParts.push(
			`<p style="margin:24px 0 0 0;font-size:13px;line-height:1.5;color:${MUTED};">${escapeHtml(tipCopy)}</p>`,
		);
		textParts.push(tipCopy, "");
	}

	htmlParts.push(transactionalEmailFooterHtml());
	textParts.push(transactionalEmailFooterText());

	return {
		subject: "Your weekly money summary",
		html: wrapHtml(htmlParts.join("\n")),
		text: textParts.join("\n").trim(),
	};
}
