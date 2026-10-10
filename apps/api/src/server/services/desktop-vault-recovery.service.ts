import { sendVaultRecoveryCodeEmail } from "~/lib/email/send-vault-recovery-code-email";
import { logger } from "~/lib/logger";
import type { PrismaClient } from "../../../generated/prisma";
import { createApiError } from "../api-context";
import {
	generateRecoveryCode,
	generateRecoveryToken,
	hashRecoveryCode,
	hashRecoveryEmail,
	hashRecoveryToken,
	normalizeRecoveryEmail,
} from "../lib/vault-recovery-crypto";
import { checkDeviceRateLimit } from "./device-rate-limit.service";
import { checkIpRateLimit } from "./ip-rate-limit.service";

const CODE_TTL_MS = 10 * 60 * 1000;
const RECOVERY_TOKEN_TTL_MS = 5 * 60 * 1000;
const MAX_SENDS_PER_HOUR = 3;
const MAX_INVALID_ATTEMPTS = 5;
const MAX_VERIFY_ATTEMPTS_PER_MINUTE = 20;

function assertRateLimitAllowed(
	result: { allowed: boolean; resetAt: Date },
	message: string,
): void {
	if (!result.allowed) {
		const err = createApiError(message, 429) as ReturnType<
			typeof createApiError
		> & { retryAfterSeconds?: number };
		err.retryAfterSeconds = Math.max(
			1,
			Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
		);
		throw err;
	}
}

async function invalidateActiveCodes(
	db: PrismaClient,
	recoveryDeviceId: string,
): Promise<void> {
	await db.desktopVaultRecoveryCode.updateMany({
		where: {
			recoveryDeviceId,
			consumedAt: null,
			expiresAt: { gt: new Date() },
		},
		data: {
			consumedAt: new Date(),
		},
	});
}

export async function sendDesktopVaultRecoveryCode(input: {
	db: PrismaClient;
	recoveryDeviceId: string;
	email: string;
	ipAddress?: string;
}): Promise<{ ok: true }> {
	const normalizedEmail = normalizeRecoveryEmail(input.email);

	if (input.ipAddress) {
		assertRateLimitAllowed(
			checkIpRateLimit({
				ipAddress: input.ipAddress,
				operation: "desktop-vault-recovery:send-code",
				limit: 10,
				windowMs: 60_000,
			}),
			"Too many recovery code requests. Try again later.",
		);
	}

	assertRateLimitAllowed(
		checkDeviceRateLimit({
			recoveryDeviceId: input.recoveryDeviceId,
			operation: "send-code",
			limit: MAX_SENDS_PER_HOUR,
			windowMs: 3_600_000,
		}),
		"Too many recovery codes sent for this device. Try again later.",
	);

	const code = generateRecoveryCode();
	const codeHash = hashRecoveryCode(code);
	const expiresAt = new Date(Date.now() + CODE_TTL_MS);

	await invalidateActiveCodes(input.db, input.recoveryDeviceId);
	await input.db.desktopVaultRecoveryCode.create({
		data: {
			recoveryDeviceId: input.recoveryDeviceId,
			codeHash,
			expiresAt,
		},
	});

	try {
		await sendVaultRecoveryCodeEmail({
			to: normalizedEmail,
			code,
		});
	} catch (error) {
		logger.error("Failed to send desktop vault recovery code email", {
			feature: "desktop-vault-recovery",
			operation: "send-code",
			error: error instanceof Error ? error.message : "Unknown error",
		});

		if (process.env.NODE_ENV === "development") {
			logger.warn("Desktop vault recovery code (dev — email not sent)", {
				feature: "desktop-vault-recovery",
				operation: "send-code-dev-fallback",
				code,
			});
			return { ok: true };
		}

		throw createApiError("Failed to send recovery code email", 502);
	}

	return { ok: true };
}

async function validateRecoveryCode(input: {
	db: PrismaClient;
	recoveryDeviceId: string;
	email: string;
	code: string;
	ipAddress?: string;
}): Promise<void> {
	if (input.ipAddress) {
		assertRateLimitAllowed(
			checkIpRateLimit({
				ipAddress: input.ipAddress,
				operation: "desktop-vault-recovery:verify-code",
				limit: MAX_VERIFY_ATTEMPTS_PER_MINUTE,
				windowMs: 60_000,
			}),
			"Too many verification attempts. Try again later.",
		);
	}

	const activeCode = await input.db.desktopVaultRecoveryCode.findFirst({
		where: {
			recoveryDeviceId: input.recoveryDeviceId,
			consumedAt: null,
			expiresAt: { gt: new Date() },
		},
		orderBy: { createdAt: "desc" },
	});

	if (!activeCode) {
		throw createApiError("Recovery code expired or not found", 400);
	}

	const codeHash = hashRecoveryCode(input.code);
	if (codeHash !== activeCode.codeHash) {
		const nextAttemptCount = activeCode.attemptCount + 1;
		await input.db.desktopVaultRecoveryCode.update({
			where: { id: activeCode.id },
			data: {
				attemptCount: nextAttemptCount,
				...(nextAttemptCount >= MAX_INVALID_ATTEMPTS
					? { consumedAt: new Date() }
					: {}),
			},
		});
		throw createApiError("Invalid recovery code", 400);
	}

	await input.db.desktopVaultRecoveryCode.update({
		where: { id: activeCode.id },
		data: { consumedAt: new Date() },
	});
}

export async function verifyDesktopVaultRecoveryCode(input: {
	db: PrismaClient;
	recoveryDeviceId: string;
	email: string;
	code: string;
	ipAddress?: string;
}): Promise<{ recoveryToken: string }> {
	await validateRecoveryCode(input);

	const rawToken = generateRecoveryToken();
	const tokenHash = hashRecoveryToken(rawToken);
	const expiresAt = new Date(Date.now() + RECOVERY_TOKEN_TTL_MS);

	await input.db.desktopVaultRecoveryToken.create({
		data: {
			recoveryDeviceId: input.recoveryDeviceId,
			tokenHash,
			expiresAt,
		},
	});

	return { recoveryToken: rawToken };
}

export async function registerDesktopVaultRecoveryEmail(input: {
	db: PrismaClient;
	recoveryDeviceId: string;
	email: string;
	code: string;
	ipAddress?: string;
}): Promise<{ ok: true }> {
	await validateRecoveryCode(input);

	const emailHash = hashRecoveryEmail(input.email);
	await input.db.desktopVaultRecoveryRegistration.upsert({
		where: { recoveryDeviceId: input.recoveryDeviceId },
		create: {
			recoveryDeviceId: input.recoveryDeviceId,
			emailHash,
		},
		update: {
			emailHash,
		},
	});

	return { ok: true };
}

export async function consumeDesktopVaultRecoveryToken(input: {
	db: PrismaClient;
	recoveryDeviceId: string;
	recoveryToken: string;
}): Promise<void> {
	const tokenHash = hashRecoveryToken(input.recoveryToken);
	const record = await input.db.desktopVaultRecoveryToken.findUnique({
		where: { tokenHash },
	});

	if (
		!record ||
		record.recoveryDeviceId !== input.recoveryDeviceId ||
		record.consumedAt != null ||
		record.expiresAt <= new Date()
	) {
		throw createApiError("Invalid or expired recovery token", 401);
	}

	await input.db.desktopVaultRecoveryToken.update({
		where: { id: record.id },
		data: { consumedAt: new Date() },
	});
}

export async function unregisterDesktopVaultRecovery(input: {
	db: PrismaClient;
	recoveryDeviceId: string;
}): Promise<{ ok: true }> {
	await input.db.desktopVaultRecoveryRegistration.deleteMany({
		where: { recoveryDeviceId: input.recoveryDeviceId },
	});
	await input.db.desktopVaultRecoveryCode.deleteMany({
		where: { recoveryDeviceId: input.recoveryDeviceId },
	});
	await input.db.desktopVaultRecoveryToken.deleteMany({
		where: { recoveryDeviceId: input.recoveryDeviceId },
	});

	return { ok: true };
}
