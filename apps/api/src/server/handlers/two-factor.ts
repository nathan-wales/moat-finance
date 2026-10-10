import bcryptjs from "bcryptjs";
import { z } from "zod";
import {
	generateBackupCodes,
	generateQRCode,
	generateTOTPSecret,
	hashBackupCode,
	verifyBackupCode,
	verifyTOTPToken,
} from "~/server/auth/two-factor-utils";
import { decrypt, encrypt } from "~/server/lib/encryption";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";

const enableInput = z.object({
	token: z.string().length(6),
	secret: z.string().min(1),
});

const disableInput = z.object({
	password: z.string().min(1),
});

const verifyInput = z.object({
	token: z.string().min(1),
	isBackupCode: z.boolean().default(false),
});

export const twoFactor = {
	getStatus: withAuth(async (ctx: AuthenticatedContext) => {
		const userId = ctx.actorUserId;
		const user = await ctx.db.user.findUnique({
			where: { id: userId },
			select: {
				twoFactorEnabled: true,
				twoFactorVerified: true,
			},
		});
		return user;
	}),

	generateSecret: withAuth(async (ctx: AuthenticatedContext) => {
		const userId = ctx.actorUserId;
		const user = await ctx.db.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});
		if (!user?.email) throw new Error("BAD_REQUEST");

		const secret = generateTOTPSecret();
		const qrCode = await generateQRCode(secret, user.email);
		return { secret, qrCode };
	}),

	enable: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const userId = ctx.actorUserId;
		const input = enableInput.parse(body);
		const isValid = verifyTOTPToken(input.token, input.secret);
		if (!isValid) {
			throw new Error("Invalid verification code. Please try again.");
		}

		const backupCodes = generateBackupCodes();
		const hashedCodes = await Promise.all(backupCodes.map(hashBackupCode));

		await ctx.db.user.update({
			where: { id: userId },
			data: {
				twoFactorEnabled: true,
				twoFactorVerified: true,
				twoFactorSecret: encrypt(input.secret),
				twoFactorBackupCodes: JSON.stringify(hashedCodes),
			},
		});

		return { backupCodes };
	}),

	disable: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const userId = ctx.actorUserId;
		const input = disableInput.parse(body);
		const user = await ctx.db.user.findUnique({
			where: { id: userId },
			select: { password: true },
		});

		if (!user?.password) {
			throw new Error("Cannot disable 2FA for accounts without a password.");
		}

		const valid = await bcryptjs.compare(input.password, user.password);
		if (!valid) {
			throw new Error("Incorrect password.");
		}

		await ctx.db.user.update({
			where: { id: userId },
			data: {
				twoFactorEnabled: false,
				twoFactorSecret: null,
				twoFactorBackupCodes: null,
				twoFactorVerified: false,
			},
		});

		// Clean up any stored tokens
		await ctx.db.twoFactorToken.deleteMany({
			where: { userId },
		});
		return { success: true };
	}),

	// "twoFactor.verify" is in the TWO_FACTOR_ALLOWLIST — permitted when 2FA is pending
	verify: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const userId = ctx.actorUserId;
		const input = verifyInput.parse(body);
		const user = await ctx.db.user.findUnique({
			where: { id: userId },
			select: {
				twoFactorSecret: true,
				twoFactorBackupCodes: true,
			},
		});

		if (!user?.twoFactorSecret) {
			throw new Error("BAD_REQUEST");
		}

		// Clean up expired tokens
		await ctx.db.twoFactorToken.deleteMany({
			where: { expires: { lt: new Date() } },
		});

		let isValid = false;

		if (input.isBackupCode) {
			const rawCodes = user.twoFactorBackupCodes;
			if (!rawCodes) {
				throw new Error("BAD_REQUEST");
			}

			const hashedCodes = JSON.parse(rawCodes) as string[];
			let matchIndex = -1;

			for (let i = 0; i < hashedCodes.length; i++) {
				const hash = hashedCodes[i];
				if (hash && (await verifyBackupCode(input.token, hash))) {
					matchIndex = i;
					isValid = true;
					break;
				}
			}

			if (isValid && matchIndex >= 0) {
				// Consume the backup code
				hashedCodes.splice(matchIndex, 1);
				await ctx.db.user.update({
					where: { id: userId },
					data: { twoFactorBackupCodes: JSON.stringify(hashedCodes) },
				});
			}
		} else {
			// Check for replay attack
			const usedToken = await ctx.db.twoFactorToken.findUnique({
				where: { token: `${userId}:${input.token}` },
			});
			if (usedToken) {
				throw new Error("Code already used. Please wait for a new code.");
			}

			const secret = decrypt(user.twoFactorSecret);
			isValid = verifyTOTPToken(input.token, secret);

			if (isValid) {
				// Record token to prevent replay
				await ctx.db.twoFactorToken.create({
					data: {
						userId,
						token: `${userId}:${input.token}`,
						expires: new Date(Date.now() + 30_000),
					},
				});
			}
		}

		if (!isValid) {
			throw new Error("Invalid code. Please try again.");
		}

		return { success: true };
	}, "twoFactor.verify"),
};
