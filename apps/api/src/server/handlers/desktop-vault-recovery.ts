import { z } from "zod";
import type { ApiContext } from "../api-context";
import { withPublic } from "../handler-wrappers";
import { getClientIpAddress } from "../lib/request-client";
import {
	consumeDesktopVaultRecoveryToken,
	registerDesktopVaultRecoveryEmail,
	sendDesktopVaultRecoveryCode,
	unregisterDesktopVaultRecovery,
	verifyDesktopVaultRecoveryCode,
} from "../services/desktop-vault-recovery.service";

const recoveryDeviceIdSchema = z.string().min(1).max(128);
const emailSchema = z.string().email();
const codeSchema = z.string().length(6);

const sendCodeInput = z.object({
	recoveryDeviceId: recoveryDeviceIdSchema,
	email: emailSchema,
});

const verifyCodeInput = z.object({
	recoveryDeviceId: recoveryDeviceIdSchema,
	email: emailSchema,
	code: codeSchema,
});

const registerInput = z.object({
	recoveryDeviceId: recoveryDeviceIdSchema,
	email: emailSchema,
	code: codeSchema,
});

const unregisterInput = z.object({
	recoveryDeviceId: recoveryDeviceIdSchema,
});

const consumeTokenInput = z.object({
	recoveryDeviceId: recoveryDeviceIdSchema,
	recoveryToken: z.string().min(1),
});

function getIp(ctx: ApiContext): string | undefined {
	return getClientIpAddress(ctx.req);
}

export const desktopVaultRecovery = {
	sendCode: withPublic(async (ctx: ApiContext, body: unknown) => {
		const input = sendCodeInput.parse(body);
		return sendDesktopVaultRecoveryCode({
			db: ctx.db,
			recoveryDeviceId: input.recoveryDeviceId,
			email: input.email,
			ipAddress: getIp(ctx),
		});
	}),

	verifyCode: withPublic(async (ctx: ApiContext, body: unknown) => {
		const input = verifyCodeInput.parse(body);
		return verifyDesktopVaultRecoveryCode({
			db: ctx.db,
			recoveryDeviceId: input.recoveryDeviceId,
			email: input.email,
			code: input.code,
			ipAddress: getIp(ctx),
		});
	}),

	register: withPublic(async (ctx: ApiContext, body: unknown) => {
		const input = registerInput.parse(body);
		return registerDesktopVaultRecoveryEmail({
			db: ctx.db,
			recoveryDeviceId: input.recoveryDeviceId,
			email: input.email,
			code: input.code,
			ipAddress: getIp(ctx),
		});
	}),

	unregister: withPublic(async (ctx: ApiContext, body: unknown) => {
		const input = unregisterInput.parse(body);
		return unregisterDesktopVaultRecovery({
			db: ctx.db,
			recoveryDeviceId: input.recoveryDeviceId,
		});
	}),

	consumeToken: withPublic(async (ctx: ApiContext, body: unknown) => {
		const input = consumeTokenInput.parse(body);
		await consumeDesktopVaultRecoveryToken({
			db: ctx.db,
			recoveryDeviceId: input.recoveryDeviceId,
			recoveryToken: input.recoveryToken,
		});
		return { ok: true };
	}),
};

export type DesktopVaultRecoveryHandlers = typeof desktopVaultRecovery;
