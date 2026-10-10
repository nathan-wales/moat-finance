/**
 * TOTP-based two-factor authentication utilities.
 * Server-side only — never import from client code.
 */
import { randomBytes } from "node:crypto";
import bcryptjs from "bcryptjs";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

const APP_NAME = "Moat Finance";

export { generateSecret as generateTOTPSecret };

export async function generateQRCode(
	secret: string,
	email: string,
): Promise<string> {
	const otpAuthUrl = generateURI({
		label: email,
		issuer: APP_NAME,
		secret,
	});
	return QRCode.toDataURL(otpAuthUrl);
}

export function verifyTOTPToken(token: string, secret: string): boolean {
	try {
		const result = verifySync({ token, secret });
		return result.valid;
	} catch {
		return false;
	}
}

export function generateBackupCodes(): string[] {
	return Array.from({ length: 10 }, () =>
		randomBytes(4).toString("hex").toUpperCase(),
	);
}

export async function hashBackupCode(code: string): Promise<string> {
	return bcryptjs.hash(code, 10);
}

export async function verifyBackupCode(
	code: string,
	hash: string,
): Promise<boolean> {
	return bcryptjs.compare(code.toUpperCase(), hash);
}
