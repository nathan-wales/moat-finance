import { sendTransactionalEmail } from "./resend";

function getFeedbackRecipient(): string {
	return process.env.FEEDBACK_RECIPIENT ?? "support@moatfinance.ai";
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function getFeedbackEmailSubject(source: string, platform?: string): string {
	const normalizedPlatform = platform?.toLowerCase();
	if (normalizedPlatform === "ios") {
		return "Customer feedback from the iOS app";
	}

	switch (source) {
		case "WEB_APP":
			return "Customer feedback from the Web app";
		case "DESKTOP_APP":
			return "Customer feedback from the Desktop app";
		case "MCP":
			return "Customer feedback from MCP";
		default:
			return "Customer feedback";
	}
}

type SendFeedbackNotificationEmailParams = {
	message: string;
	source: string;
	type: string;
	screenshotUrl?: string;
	route?: string;
	platform?: string;
	feedbackId: string;
	userName?: string;
	userEmail?: string;
};

export async function sendFeedbackNotificationEmail(
	params: SendFeedbackNotificationEmailParams,
): Promise<void> {
	const {
		message,
		source,
		type,
		screenshotUrl,
		route,
		platform,
		feedbackId,
		userName,
		userEmail,
	} = params;

	const screenshotHtml = screenshotUrl
		? `<p><strong>Screenshot:</strong> <a href="${escapeHtml(screenshotUrl)}">${escapeHtml(screenshotUrl)}</a></p>`
		: "";

	const screenshotText = screenshotUrl ? `Screenshot: ${screenshotUrl}\n` : "";

	const html = `
		<h2>New Feedback Received</h2>
		<p><strong>ID:</strong> ${escapeHtml(feedbackId)}</p>
		${userName ? `<p><strong>Name:</strong> ${escapeHtml(userName)}</p>` : ""}
		${userEmail ? `<p><strong>Email:</strong> ${escapeHtml(userEmail)}</p>` : ""}
		<p><strong>Source:</strong> ${escapeHtml(source)}</p>
		<p><strong>Type:</strong> ${escapeHtml(type)}</p>
		${route ? `<p><strong>Route:</strong> ${escapeHtml(route)}</p>` : ""}
		${platform ? `<p><strong>Platform:</strong> ${escapeHtml(platform)}</p>` : ""}
		<hr />
		<p><strong>Message:</strong></p>
		<blockquote style="border-left: 3px solid #ccc; margin: 0; padding: 0 1em; color: #555;">${escapeHtml(message).replace(/\n/g, "<br />")}</blockquote>
		${screenshotHtml}
	`.trim();

	const text = [
		"New Feedback Received",
		`ID: ${feedbackId}`,
		userName ? `Name: ${userName}` : null,
		userEmail ? `Email: ${userEmail}` : null,
		`Source: ${source}`,
		`Type: ${type}`,
		route ? `Route: ${route}` : null,
		platform ? `Platform: ${platform}` : null,
		"",
		"Message:",
		message,
		screenshotText,
	]
		.filter((line) => line !== null)
		.join("\n");

	await sendTransactionalEmail({
		to: getFeedbackRecipient(),
		subject: getFeedbackEmailSubject(source, platform),
		html,
		text,
	});
}
