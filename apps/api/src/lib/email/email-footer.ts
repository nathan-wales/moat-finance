const SUPPORT_EMAIL = "support@moatfinance.ai";

export function transactionalEmailFooterHtml(): string {
	return `<p style="font-size: 13px; color: #64748b; margin-top: 24px;">Questions? Reply to this email or contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>`;
}

export function transactionalEmailFooterText(): string {
	return `\n\nQuestions? Reply to this email or contact ${SUPPORT_EMAIL}.`;
}

export function getSupportReplyToEmail(): string {
	return SUPPORT_EMAIL;
}
