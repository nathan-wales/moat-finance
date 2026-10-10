import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_LENGTH = 16;

export async function hashVaultPassword(password: string): Promise<{
	hash: string;
	salt: string;
}> {
	const salt = randomBytes(SCRYPT_SALT_LENGTH).toString("hex");
	const derived = (await scryptAsync(
		password,
		salt,
		SCRYPT_KEY_LENGTH,
	)) as Buffer;
	return {
		salt,
		hash: derived.toString("hex"),
	};
}

export async function verifyVaultPassword(
	password: string,
	salt: string,
	expectedHash: string,
): Promise<boolean> {
	const derived = (await scryptAsync(
		password,
		salt,
		SCRYPT_KEY_LENGTH,
	)) as Buffer;
	const expected = Buffer.from(expectedHash, "hex");
	if (expected.length !== derived.length) return false;
	return timingSafeEqual(expected, derived);
}
