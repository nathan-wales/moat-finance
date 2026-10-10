import { Resend } from "resend";
import { getSupportReplyToEmail } from "./email-footer";

interface SendTransactionalEmailInput {
	to: string;
	subject: string;
	html: string;
	text: string;
}

let resendClient: Resend | null = null;

function getResendClient(): Resend {
	if (resendClient) {
		return resendClient;
	}

	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) {
		throw new Error("RESEND_API_KEY is not configured");
	}

	resendClient = new Resend(apiKey);
	return resendClient;
}

function getEmailFrom(): string {
	const from = process.env.EMAIL_FROM;
	if (!from) {
		throw new Error("EMAIL_FROM is not configured");
	}
	return from;
}

export async function sendTransactionalEmail(
	input: SendTransactionalEmailInput,
): Promise<void> {
	const client = getResendClient();
	const from = getEmailFrom();

	const result = await client.emails.send({
		from,
		to: input.to,
		replyTo: getSupportReplyToEmail(),
		subject: input.subject,
		html: input.html,
		text: input.text,
	});

	if (result.error) {
		throw new Error(result.error.message || "Failed to send email");
	}
}
