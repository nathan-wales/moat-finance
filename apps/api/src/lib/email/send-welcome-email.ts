import { logger } from "~/lib/logger";
import { sendTransactionalEmail } from "./resend";
import { renderWelcomeEmail, type WelcomeEmailVariant } from "./welcome-email";

export async function sendWelcomeEmailForNewUser(input: {
	userId: string;
	email: string | null | undefined;
	name: string | null | undefined;
	variant?: WelcomeEmailVariant;
}): Promise<void> {
	if (!input.email) return;

	if (!process.env.RESEND_API_KEY) {
		logger.warn("Skipping welcome email; RESEND_API_KEY is not configured", {
			feature: "auth",
			operation: "welcome_email.send",
			userId: input.userId,
		});
		return;
	}

	try {
		const content = renderWelcomeEmail({
			name: input.name,
			variant: input.variant ?? "cloud",
		});
		await sendTransactionalEmail({
			to: input.email,
			subject: content.subject,
			html: content.html,
			text: content.text,
		});
	} catch (error) {
		logger.logError("Failed to send welcome email", error, {
			feature: "auth",
			operation: "welcome_email.send",
			userId: input.userId,
		});
	}
}
