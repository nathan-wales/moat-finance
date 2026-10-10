import {
	transactionalEmailFooterHtml,
	transactionalEmailFooterText,
} from "./email-footer";
import { sendTransactionalEmail } from "./resend";

interface SendVaultRecoveryCodeEmailInput {
	to: string;
	code: string;
}

const NAVY = "#0F2744";
const MUTED = "#64748B";
const BODY = "#334155";
const PAGE_BG = "#EEF0F3";
const CARD_BG = "#FFFFFF";
const KPI_BG = "#F7F8FA";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const VAULT_RECOVERY_SUBJECT = "Your Moat Finance recovery code";

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
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

export function renderVaultRecoveryCodeEmail(input: { code: string }): {
	subject: string;
	html: string;
	text: string;
} {
	const html = wrapHtml(`
		<p style="margin:0 0 16px 0;font-size:12px;letter-spacing:0.16em;font-weight:600;color:${MUTED};">MOAT</p>
		<h1 style="margin:0 0 8px 0;font-size:28px;line-height:1.2;color:${NAVY};font-weight:700;">Recovery code</h1>
		<p style="margin:0 0 20px 0;font-size:16px;line-height:1.5;color:${BODY};">Use this code to recover access to your local Moat Finance vault on your desktop device.</p>
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;background:${KPI_BG};border-radius:10px;">
			<tr>
				<td style="padding:20px 14px;text-align:center;">
					<p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};font-weight:600;">Your code</p>
					<p style="margin:0;font-size:32px;line-height:1.2;font-weight:700;letter-spacing:0.25em;color:${NAVY};">${escapeHtml(input.code)}</p>
				</td>
			</tr>
		</table>
		<p style="margin:0 0 24px 0;font-size:14px;line-height:1.4;color:${MUTED};">This code expires in 10 minutes.</p>
		<p style="margin:0;font-size:13px;line-height:1.5;color:${MUTED};">If you did not request this code, you can safely ignore this email.</p>
		${transactionalEmailFooterHtml()}
	`);

	const text = [
		"Recovery code",
		"",
		"Use this code to recover access to your local Moat Finance vault on your desktop device.",
		"",
		`Recovery code: ${input.code}`,
		"",
		"This code expires in 10 minutes.",
		"",
		"If you did not request this code, you can safely ignore this email.",
		transactionalEmailFooterText(),
	].join("\n");

	return {
		subject: VAULT_RECOVERY_SUBJECT,
		html,
		text,
	};
}

export async function sendVaultRecoveryCodeEmail(
	input: SendVaultRecoveryCodeEmailInput,
): Promise<void> {
	const content = renderVaultRecoveryCodeEmail({ code: input.code });
	await sendTransactionalEmail({
		to: input.to,
		subject: content.subject,
		html: content.html,
		text: content.text,
	});
}
