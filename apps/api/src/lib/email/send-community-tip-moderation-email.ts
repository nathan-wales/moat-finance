import { logger } from "~/lib/logger";
import { resolveWebOrigin } from "~/lib/web-origin";
import { getAdminEmails } from "~/server/lib/admin-access";
import { sendTransactionalEmail } from "./resend";

type SendCommunityTipModerationEmailParams = {
	tipId: string;
	title: string;
	status: string;
};

function getModerationUrl(tipId: string): string {
	const params = new URLSearchParams({
		tab: "tips",
		tipId,
	});
	return `${resolveWebOrigin()}/admin?${params.toString()}`;
}

export async function sendCommunityTipModerationEmail(
	params: SendCommunityTipModerationEmailParams,
): Promise<void> {
	const { tipId, title, status } = params;
	const moderationUrl = getModerationUrl(tipId);

	const html = `
		<h2>New Community Tip awaiting review</h2>
		<p><strong>Title:</strong> ${escapeHtml(title)}</p>
		<p><strong>Status:</strong> ${escapeHtml(status)}</p>
		<p><strong>Tip ID:</strong> ${escapeHtml(tipId)}</p>
		<p><a href="${moderationUrl}">Review this tip</a></p>
	`.trim();

	const text = [
		"New Community Tip awaiting review",
		`Title: ${title}`,
		`Status: ${status}`,
		`Tip ID: ${tipId}`,
		`Review: ${moderationUrl}`,
	].join("\n");

	const recipients = getAdminEmails();
	if (recipients.length === 0) {
		logger.warn("Skipping moderation email; ADMIN_EMAILS is not configured", {
			feature: "community_tip_moderation",
		});
		return;
	}

	await Promise.all(
		recipients.map((to) =>
			sendTransactionalEmail({
				to,
				subject: `[Moat] Community Tip pending review: ${title}`,
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
