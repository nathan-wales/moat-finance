import { createHash, timingSafeEqual } from "node:crypto";
import {
	DESKTOP_TUNNEL_CONNECT_TTL_SECONDS,
	type DesktopTunnelJwtClaims,
	PUBLIC_TUNNEL_ID_PATTERN,
	signDesktopTunnelJwt,
} from "@moat/contracts";
import { logger } from "~/lib/logger";

export class DesktopMcpTunnelError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "DesktopMcpTunnelError";
		this.status = status;
	}
}

export type DesktopMcpTunnelRecord = {
	id: string;
	userId: string;
	deviceId: string;
	publicTunnelId: string;
	label: string | null;
	revokedAt: Date | null;
};

export type DesktopMcpTunnelDirectory = {
	findByPublicId(
		publicTunnelId: string,
	): Promise<DesktopMcpTunnelRecord | null>;
	findByOwner(
		userId: string,
		deviceId: string,
	): Promise<DesktopMcpTunnelRecord | null>;
	insert(input: {
		userId: string;
		deviceId: string;
		publicTunnelId: string;
		label: string | null;
	}): Promise<DesktopMcpTunnelRecord>;
	update(
		id: string,
		input: {
			publicTunnelId: string;
			label: string | null;
			revokedAt: Date | null;
		},
	): Promise<DesktopMcpTunnelRecord>;
};

export type OAuthTunnelTokenRecord = {
	id: string;
	userId: string;
	scopes: string[];
	expiresAt: Date;
	revokedAt: Date | null;
	desktopPublicTunnelId: string | null;
};

export type OAuthTunnelTokenLookup = {
	findByHashes(hashes: string[]): Promise<OAuthTunnelTokenRecord | null>;
};

const DEVICE_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertTunnelRegistrationInput(input: {
	deviceId: string;
	publicTunnelId: string;
	label?: string | null;
}): { deviceId: string; publicTunnelId: string; label: string | null } {
	if (!DEVICE_ID_PATTERN.test(input.deviceId)) {
		throw new DesktopMcpTunnelError("Invalid device id", 400);
	}
	if (!PUBLIC_TUNNEL_ID_PATTERN.test(input.publicTunnelId)) {
		throw new DesktopMcpTunnelError("Invalid public tunnel id", 400);
	}
	const label = input.label?.trim() ?? "";
	if (label.length > 80) {
		throw new DesktopMcpTunnelError("Device label is too long", 400);
	}
	return {
		deviceId: input.deviceId,
		publicTunnelId: input.publicTunnelId,
		label: label.length > 0 ? label : null,
	};
}

export async function registerDesktopMcpTunnel(
	directory: DesktopMcpTunnelDirectory,
	input: {
		userId: string;
		deviceId: string;
		publicTunnelId: string;
		label?: string | null;
	},
): Promise<DesktopMcpTunnelRecord> {
	const registration = assertTunnelRegistrationInput(input);
	const byPublic = await directory.findByPublicId(registration.publicTunnelId);
	const byOwner = await directory.findByOwner(
		input.userId,
		registration.deviceId,
	);

	if (byPublic && byPublic.userId !== input.userId) {
		throw new DesktopMcpTunnelError("Tunnel id is already registered", 409);
	}
	if (byPublic && byPublic.deviceId !== registration.deviceId) {
		throw new DesktopMcpTunnelError("Tunnel id is already registered", 409);
	}
	if (
		byOwner &&
		byOwner.publicTunnelId !== registration.publicTunnelId &&
		byPublic
	) {
		throw new DesktopMcpTunnelError("Tunnel id is already registered", 409);
	}
	if (byOwner) {
		return directory.update(byOwner.id, {
			publicTunnelId: registration.publicTunnelId,
			label: registration.label ?? byOwner.label,
			revokedAt: null,
		});
	}
	if (byPublic) {
		return directory.update(byPublic.id, {
			publicTunnelId: byPublic.publicTunnelId,
			label: registration.label ?? byPublic.label,
			revokedAt: null,
		});
	}
	return directory.insert({
		userId: input.userId,
		deviceId: registration.deviceId,
		publicTunnelId: registration.publicTunnelId,
		label: registration.label,
	});
}

export async function issueDesktopTunnelConnectionToken(input: {
	directory: DesktopMcpTunnelDirectory;
	userId: string;
	publicTunnelId: string;
	privateKeyPkcs8Base64: string;
	now?: Date;
}): Promise<{ token: string; expiresAt: string }> {
	if (!input.privateKeyPkcs8Base64) {
		throw new DesktopMcpTunnelError(
			"Tunnel signing key is not configured",
			503,
		);
	}
	if (!PUBLIC_TUNNEL_ID_PATTERN.test(input.publicTunnelId)) {
		throw new DesktopMcpTunnelError("Invalid public tunnel id", 400);
	}
	const record = await input.directory.findByPublicId(input.publicTunnelId);
	if (!record || record.userId !== input.userId || record.revokedAt) {
		throw new DesktopMcpTunnelError("Unknown tunnel device", 404);
	}
	const now = input.now ?? new Date();
	const issuedAt = Math.floor(now.getTime() / 1000);
	const claims: DesktopTunnelJwtClaims = {
		sub: input.userId,
		publicTunnelId: input.publicTunnelId,
		aud: "tunnel-connect",
		iat: issuedAt,
		exp: issuedAt + DESKTOP_TUNNEL_CONNECT_TTL_SECONDS,
	};
	const token = await signDesktopTunnelJwt({
		privateKeyPkcs8Base64: input.privateKeyPkcs8Base64,
		claims,
	});
	return {
		token,
		expiresAt: new Date(claims.exp * 1000).toISOString(),
	};
}

export function oauthTokenHashCandidates(token: string): string[] {
	const peppers = [
		process.env.MCP_TOKEN_PEPPER,
		process.env.DATABASE_URL,
	].filter((value): value is string => Boolean(value && value.length > 0));
	if (peppers.length === 0) {
		throw new DesktopMcpTunnelError("MCP token pepper is not configured", 503);
	}
	return [
		...new Set(
			peppers.map((pepper) =>
				createHash("sha256").update(token).update(pepper).digest("hex"),
			),
		),
	];
}

export function secretsMatch(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	if (leftBuffer.length !== rightBuffer.length) return false;
	return timingSafeEqual(leftBuffer, rightBuffer);
}

export type TunnelIntrospection =
	| {
			active: false;
	  }
	| {
			active: true;
			userId: string;
			publicTunnelId: string;
			scopes: string[];
			exp: number;
			tokenId: string;
	  };

type TunnelPrisma = {
	desktopMcpTunnel: {
		findUnique(args: {
			where: { publicTunnelId: string };
		}): Promise<DesktopMcpTunnelRecord | null>;
		findFirst(args: {
			where: { userId: string; deviceId: string };
		}): Promise<DesktopMcpTunnelRecord | null>;
		create(args: {
			data: {
				userId: string;
				deviceId: string;
				publicTunnelId: string;
				label: string | null;
			};
		}): Promise<DesktopMcpTunnelRecord>;
		update(args: {
			where: { id: string };
			data: {
				publicTunnelId: string;
				label: string | null;
				revokedAt: Date | null;
			};
		}): Promise<DesktopMcpTunnelRecord>;
	};
	mcpOAuthAccessToken: {
		findFirst(args: {
			where: { tokenHash: { in: string[] } };
		}): Promise<OAuthTunnelTokenRecord | null>;
	};
};

export function prismaTunnelDirectory(
	db: TunnelPrisma,
): DesktopMcpTunnelDirectory {
	return {
		findByPublicId(publicTunnelId) {
			return db.desktopMcpTunnel.findUnique({ where: { publicTunnelId } });
		},
		findByOwner(userId, deviceId) {
			return db.desktopMcpTunnel.findFirst({ where: { userId, deviceId } });
		},
		insert(input) {
			return db.desktopMcpTunnel.create({ data: input });
		},
		update(id, input) {
			return db.desktopMcpTunnel.update({ where: { id }, data: input });
		},
	};
}

export function prismaOAuthTunnelTokenLookup(
	db: TunnelPrisma,
): OAuthTunnelTokenLookup {
	return {
		findByHashes(hashes) {
			return db.mcpOAuthAccessToken.findFirst({
				where: { tokenHash: { in: hashes } },
			});
		},
	};
}

export async function introspectDesktopMcpToken(input: {
	lookup: OAuthTunnelTokenLookup;
	token: string;
	now?: Date;
}): Promise<TunnelIntrospection> {
	const hashes = oauthTokenHashCandidates(input.token);
	const record = await input.lookup.findByHashes(hashes);
	const now = input.now ?? new Date();
	if (!record || record.revokedAt || record.expiresAt <= now) {
		return { active: false };
	}
	if (!record.desktopPublicTunnelId) return { active: false };
	if (!PUBLIC_TUNNEL_ID_PATTERN.test(record.desktopPublicTunnelId)) {
		return { active: false };
	}
	logger.info("Remote MCP token introspected", {
		feature: "remoteMcp",
		operation: "introspect",
		userId: record.userId,
		publicTunnelId: record.desktopPublicTunnelId,
		tokenId: record.id,
	});
	return {
		active: true,
		userId: record.userId,
		publicTunnelId: record.desktopPublicTunnelId,
		scopes: record.scopes,
		exp: Math.floor(record.expiresAt.getTime() / 1000),
		tokenId: record.id,
	};
}
