export const HELLO_EMAIL = "hello@moatfinance.ai";
export const SUPPORT_EMAIL = "support@moatfinance.ai";
export const PRIVACY_POLICY_URL = "https://moatfinance.ai/privacy.html";

function mailtoUrl(email: string, subject?: string, body?: string): string {
	const parts: string[] = [];
	if (subject) {
		parts.push(`subject=${encodeURIComponent(subject)}`);
	}
	if (body) {
		parts.push(`body=${encodeURIComponent(body)}`);
	}
	if (parts.length === 0) {
		return `mailto:${email}`;
	}
	return `mailto:${email}?${parts.join("&")}`;
}

export function supportMailtoUrl(subject?: string, body?: string): string {
	return mailtoUrl(SUPPORT_EMAIL, subject, body);
}

export function helloMailtoUrl(subject?: string, body?: string): string {
	return mailtoUrl(HELLO_EMAIL, subject, body);
}
