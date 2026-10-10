import { resolveEmailWebOrigin } from "~/lib/web-origin";
import {
	transactionalEmailFooterHtml,
	transactionalEmailFooterText,
} from "./email-footer";
import { sendTransactionalEmail } from "./resend";

interface SendHouseholdInviteEmailInput {
	to: string;
	inviteeName: string;
	ownerName: string;
	inviteUrl: string;
	expiresAt: Date;
}

const NAVY = "#0F2744";
const MUTED = "#64748B";
const BODY = "#334155";
const PAGE_BG = "#EEF0F3";
const CARD_BG = "#FFFFFF";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const APP_ORIGIN = resolveEmailWebOrigin();
const LOGO_URL = "https://moatfinance.ai/public/moat-finance-full-logo.png";
const LOGO_WIDTH = 180;
const LOGO_HEIGHT = 43;

export const HOUSEHOLD_INVITE_SUBJECT =
	"You've been invited to join a household on Moat";

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function formatExpiry(expiresAt: Date): string {
	return expiresAt.toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
	});
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

export function renderHouseholdInviteEmail(input: {
	inviteeName: string;
	ownerName: string;
	inviteUrl: string;
	expiresAt: Date;
}): { subject: string; html: string; text: string } {
	const expiresText = formatExpiry(input.expiresAt);
	const inviteeName = escapeHtml(input.inviteeName);
	const ownerName = escapeHtml(input.ownerName);
	const inviteUrl = escapeHtml(input.inviteUrl);

	const html = wrapHtml(`
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
			<tr>
				<td align="center">
					<a href="${APP_ORIGIN}" style="text-decoration:none;">
						<img src="${LOGO_URL}" alt="Moat Finance" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:${LOGO_WIDTH}px;height:auto;max-width:100%;" />
					</a>
				</td>
			</tr>
		</table>
		<h1 style="margin:0 0 20px 0;font-size:28px;line-height:1.2;color:${NAVY};font-weight:700;text-align:center;">You're invited to Moat Household</h1>
		<p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;color:${BODY};">Hi ${inviteeName},</p>
		<p style="margin:0 0 8px 0;font-size:16px;line-height:1.5;color:${BODY};">${ownerName} invited you to join their household financial dashboard on Moat Finance. In V1, household members have full dashboard access.</p>
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 16px 0;">
			<tr>
				<td align="center">
					<a href="${inviteUrl}" style="display:inline-block;background:${NAVY};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">Accept household invite</a>
				</td>
			</tr>
		</table>
		<p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;color:${MUTED};text-align:center;">This invite expires on ${escapeHtml(expiresText)}.</p>
		<p style="margin:0 0 6px 0;font-size:14px;line-height:1.5;color:${MUTED};">If the button does not work, use this link:</p>
		<p style="margin:0 0 24px 0;font-size:14px;line-height:1.5;word-break:break-all;"><a href="${inviteUrl}" style="color:${NAVY};font-weight:600;text-decoration:none;">${inviteUrl}</a></p>
		<p style="margin:0;font-size:13px;line-height:1.5;color:${MUTED};">If you did not expect this invite, you can safely ignore this email.</p>
		${transactionalEmailFooterHtml()}
	`);

	const text = [
		`Hi ${input.inviteeName},`,
		"",
		`${input.ownerName} invited you to join their household financial dashboard on Moat Finance.`,
		"In V1, household members have full dashboard access.",
		"",
		`Accept invite: ${input.inviteUrl}`,
		`This invite expires on ${expiresText}.`,
		"",
		"If you did not expect this invite, you can safely ignore this email.",
		transactionalEmailFooterText(),
	].join("\n");

	return {
		subject: HOUSEHOLD_INVITE_SUBJECT,
		html,
		text,
	};
}

export async function sendHouseholdInviteEmail(
	input: SendHouseholdInviteEmailInput,
): Promise<void> {
	const content = renderHouseholdInviteEmail(input);
	await sendTransactionalEmail({
		to: input.to,
		subject: content.subject,
		html: content.html,
		text: content.text,
	});
}
