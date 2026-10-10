import { logger } from "~/lib/logger";
import { resolveWebOrigin } from "~/lib/web-origin";
import { getAdminEmails } from "~/server/lib/admin-access";
import { sendTransactionalEmail } from "./resend";

type SendPromptModerationEmailParams = {
	promptId: string;
	title: string;
	reviewStatus: string;
};

function getModerationUrl(promptId: string): string {
	const params = new URLSearchParams({
		tab: "prompts",
		promptId,
	});
	return `${resolveWebOrigin()}/admin?${params.toString()}`;
}

export async function sendPromptModerationEmail(
	params: SendPromptModerationEmailParams,
): Promise<void> {
	const { promptId, title, reviewStatus } = params;
	const moderationUrl = getModerationUrl(promptId);

	const html = `
		<h2>New Prompt awaiting review</h2>
		<p><strong>Title:</strong> ${escapeHtml(title)}</p>
		<p><strong>Status:</strong> ${escapeHtml(reviewStatus)}</p>
		<p><strong>Prompt ID:</strong> ${escapeHtml(promptId)}</p>
		<p><a href="${moderationUrl}">Review this prompt</a></p>
	`.trim();

	const text = [
		"New Prompt awaiting review",
		`Title: ${title}`,
		`Status: ${reviewStatus}`,
		`Prompt ID: ${promptId}`,
		`Review: ${moderationUrl}`,
	].join("\n");

	const recipients = getAdminEmails();
	if (recipients.length === 0) {
		logger.warn("Skipping moderation email; ADMIN_EMAILS is not configured", {
			feature: "prompt_moderation",
		});
		return;
	}

	await Promise.all(
		recipients.map((to) =>
			sendTransactionalEmail({
				to,
				subject: `[Moat] Prompt pending review: ${title}`,
				html,
				text,
			}),
		),
	);
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}
