import { resolveEmailWebOrigin } from "~/lib/web-origin";

const NAVY = "#0F2744";
const MUTED = "#64748B";
const BODY = "#334155";
const PAGE_BG = "#EEF0F3";
const CARD_BG = "#FFFFFF";
const KPI_BG = "#F7F8FA";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const APP_ORIGIN = resolveEmailWebOrigin();
const LOCAL_PRODUCT_URL = "https://moatfinance.ai/download";
const LOGO_URL = "https://moatfinance.ai/public/moat-finance-full-logo.png";
const LOGO_WIDTH = 180;
const LOGO_HEIGHT = 43;

export const WELCOME_EMAIL_SUBJECT = "Welcome to Moat Finance 👋";

export type WelcomeEmailVariant = "cloud" | "desktop";

export type WelcomeEmailContent = {
	subject: string;
	html: string;
	text: string;
};

type Capability = {
	title: string;
	body: string;
};

type WelcomeCopy = {
	thanks: string;
	intro: string;
	aiBody: string;
	aiCloser: string;
	privacyTitle: string;
	privacyHtml: string;
	privacyText: string[];
	getStarted: string;
	getStartedHtml: string;
	ctaLabel: string | null;
	ctaHref: string;
};

function copyForVariant(variant: WelcomeEmailVariant): WelcomeCopy {
	if (variant === "desktop") {
		return {
			thanks: "Thanks for creating a Moat Finance Local account.",
			intro:
				"You now have one place to understand your complete financial life — from everyday spending to investments, retirement, insurance, taxes, and long-term planning — with your data staying on this computer.",
			aiBody:
				"Give supported AI assistants permissioned access through the local MCP gateway on this computer so you can ask questions like:",
			aiCloser:
				"Instead of generic answers, your assistant can reason from the financial information you choose to share — and that data never leaves this machine unless you allow it.",
			privacyTitle: "Your data already stays on this computer.",
			privacyHtml:
				"Moat Finance Local keeps your financial database entirely on your own computer. No one at Moat can see that data. The only other programs that can read it are AI assistants you explicitly grant permissioned access to locally on this machine.",
			privacyText: [
				"Your data already stays on this computer.",
				"Moat Finance Local keeps your financial database entirely on your own computer. No one at Moat can see that data. The only other programs that can read it are AI assistants you explicitly grant permissioned access to locally on this machine.",
			],
			getStarted:
				"The easiest way to get started is to connect your accounts and build your financial profile in Moat Finance Local.",
			getStartedHtml: `The easiest way to get started is to <strong style="color:${NAVY};">connect your accounts and build your financial profile</strong> in Moat Finance Local.`,
			ctaLabel: null,
			ctaHref: APP_ORIGIN,
		};
	}

	return {
		thanks: "Thanks for creating a Moat Finance account.",
		intro:
			"You now have one place to understand your complete financial life — from everyday spending to investments, retirement, insurance, taxes, and long-term planning.",
		aiBody:
			"Connect Moat Finance to supported AI assistants through MCP so you can ask questions like:",
		aiCloser:
			"Instead of generic answers, your assistant can reason from the financial information you choose to make available.",
		privacyTitle: "And your data stays under your control.",
		privacyHtml: `Financial connections are read-only, Moat never receives your bank password, and cloud data is protected in transit and at rest. If you want even more control, <a href="${LOCAL_PRODUCT_URL}" style="color:${NAVY};font-weight:600;text-decoration:none;">Moat Finance Local</a> lets you keep your financial database entirely on your own computer.`,
		privacyText: [
			"And your data stays under your control.",
			"Financial connections are read-only, Moat never receives your bank password, and cloud data is protected in transit and at rest.",
			`If you want even more control, Moat Finance Local lets you keep your financial database entirely on your own computer: ${LOCAL_PRODUCT_URL}`,
		],
		getStarted:
			"The easiest way to get started is to connect your accounts and build your financial profile.",
		getStartedHtml: `The easiest way to get started is to <strong style="color:${NAVY};">connect your accounts and build your financial profile.</strong>`,
		ctaLabel: "Open Moat Finance →",
		ctaHref: APP_ORIGIN,
	};
}

const CAPABILITIES: Capability[] = [
	{
		title: "Connect your financial accounts",
		body: "Bring your checking, savings, credit cards, and investment accounts together so balances and transactions stay up to date automatically.",
	},
	{
		title: "Understand your spending and cash flow",
		body: "See where your money is going, track income and expenses, and create budgets around the categories that matter to you.",
	},
	{
		title: "Track your complete net worth",
		body: "See your cash, investments, real estate, debts, and other assets together in one financial picture.",
	},
	{
		title: "Plan for retirement",
		body: "Build retirement projections from your actual finances — 401(k), IRA, Roth accounts, contributions, spending, and future assumptions.",
	},
	{
		title: "Organize taxes and insurance",
		body: "Tag deductible expenses as they happen, and keep health insurance, HSA, life insurance, and policy details in one place.",
	},
	{
		title: "Give your AI assistant real financial context",
		body: "",
	},
];

const EXAMPLE_QUESTIONS = [
	"Can I afford to buy a house next year?",
	"Am I saving enough for retirement?",
	"What happens if I increase my 401(k) contribution?",
];

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function extractWelcomeFirstName(
	name: string | null | undefined,
): string | null {
	if (!name?.trim()) return null;
	const first = name.trim().split(/\s+/)[0];
	return first || null;
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

function headingHtml(text: string): string {
	return `<h2 style="margin:32px 0 24px 0;font-size:18px;line-height:1.3;color:${NAVY};font-weight:700;">${escapeHtml(text)}</h2>`;
}

function capabilityHtml(capability: Capability, extraHtml = ""): string {
	const bodyMargin = extraHtml ? "12px" : "0";
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
		<tr><td>
			<p style="margin:0 0 6px 0;font-size:16px;line-height:1.4;font-weight:600;color:${NAVY};">${escapeHtml(capability.title)}</p>
			<p style="margin:0 0 ${bodyMargin};font-size:16px;line-height:1.5;color:${BODY};">${escapeHtml(capability.body)}</p>
			${extraHtml}
		</td></tr>
	</table>`;
}

function exampleQuestionsHtml(closer: string): string {
	const rows = EXAMPLE_QUESTIONS.map(
		(question) =>
			`<p style="margin:0 0 8px 0;padding-left:12px;border-left:2px solid #E5E7EB;font-size:16px;line-height:1.5;color:${BODY};">“${escapeHtml(question)}”</p>`,
	).join("");
	return `${rows}
		<p style="margin:12px 0 0 0;font-size:16px;line-height:1.5;color:${BODY};">${escapeHtml(closer)}</p>`;
}

function capabilitiesForVariant(copy: WelcomeCopy): Capability[] {
	return CAPABILITIES.map((capability, index) =>
		index === CAPABILITIES.length - 1
			? { ...capability, body: copy.aiBody }
			: capability,
	);
}

export function renderWelcomeEmail(input: {
	name?: string | null;
	variant?: WelcomeEmailVariant;
}): WelcomeEmailContent {
	const copy = copyForVariant(input.variant ?? "cloud");
	const capabilities = capabilitiesForVariant(copy);
	const firstName = extractWelcomeFirstName(input.name);
	const greeting = firstName ? `Hi ${firstName},` : "Hi,";
	const greetingHtml = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,";
	const ctaHtml = copy.ctaLabel
		? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 16px 0;">
			<tr>
				<td align="center">
					<a href="${copy.ctaHref}" style="display:inline-block;background:${NAVY};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">${escapeHtml(copy.ctaLabel)}</a>
				</td>
			</tr>
		</table>`
		: "";

	const htmlParts = [
		`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
			<tr>
				<td align="center">
					<a href="${APP_ORIGIN}" style="text-decoration:none;">
						<img src="${LOGO_URL}" alt="Moat Finance" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:${LOGO_WIDTH}px;height:auto;max-width:100%;" />
					</a>
				</td>
			</tr>
		</table>`,
		`<h1 style="margin:0 0 20px 0;font-size:28px;line-height:1.2;color:${NAVY};font-weight:700;text-align:center;">Welcome to Moat Finance</h1>`,
		`<p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;color:${BODY};">${greetingHtml}</p>`,
		`<p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;color:${BODY};">${escapeHtml(copy.thanks)}</p>`,
		`<p style="margin:0 0 8px 0;font-size:16px;line-height:1.5;color:${BODY};">${escapeHtml(copy.intro)}</p>`,
		headingHtml("Here's what you can do with Moat Finance"),
		...capabilities.map((capability, index) =>
			capabilityHtml(
				capability,
				index === capabilities.length - 1
					? exampleQuestionsHtml(copy.aiCloser)
					: "",
			),
		),
		`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 0 0;background:${KPI_BG};border-radius:10px;">
			<tr>
				<td style="padding:16px 18px;">
					<p style="margin:0 0 6px 0;font-size:16px;line-height:1.4;font-weight:600;color:${NAVY};">${escapeHtml(copy.privacyTitle)}</p>
					<p style="margin:0;font-size:16px;line-height:1.5;color:${BODY};">${copy.privacyHtml}</p>
				</td>
			</tr>
		</table>`,
		`<p style="margin:28px 0 0 0;font-size:16px;line-height:1.5;color:${BODY};">${copy.getStartedHtml}</p>`,
		ctaHtml,
		`<p style="margin:24px 0 24px 0;font-size:16px;line-height:1.5;color:${BODY};">Your first 30 days are free. After that, you only pay for the accounts you choose to automatically sync — manually added accounts are free.</p>`,
		`<p style="margin:0 0 24px 0;font-size:16px;line-height:1.5;color:${BODY};">If you ever have a question or feature request, just reply to this email. I read them.</p>`,
		`<p style="margin:0 0 4px 0;font-size:16px;line-height:1.5;color:${BODY};">Thanks for giving Moat Finance a try,</p>`,
		`<p style="margin:16px 0 0 0;font-size:16px;line-height:1.4;font-weight:700;color:${NAVY};">Tyler</p>`,
		`<p style="margin:0;font-size:14px;line-height:1.4;color:${MUTED};">Founder, Moat Finance</p>`,
	];

	const textParts = [
		greeting,
		"",
		copy.thanks,
		"",
		copy.intro,
		"",
		"Here's what you can do with Moat Finance:",
		"",
		...capabilities.flatMap((capability) => [
			capability.title,
			capability.body,
			"",
		]),
		...EXAMPLE_QUESTIONS.map((question) => `• "${question}"`),
		"",
		copy.aiCloser,
		"",
		...copy.privacyText,
		"",
		copy.getStarted,
		...(copy.ctaLabel
			? [`${copy.ctaLabel.replace(" →", "")}: ${copy.ctaHref}`]
			: []),
		"",
		"Your first 30 days are free. After that, you only pay for the accounts you choose to automatically sync — manually added accounts are free.",
		"",
		"If you ever have a question or feature request, just reply to this email. I read them.",
		"",
		"Thanks for giving Moat Finance a try,",
		"Tyler",
		"Founder, Moat Finance",
	];

	return {
		subject: WELCOME_EMAIL_SUBJECT,
		html: wrapHtml(htmlParts.join("\n")),
		text: textParts.join("\n").trim(),
	};
}
