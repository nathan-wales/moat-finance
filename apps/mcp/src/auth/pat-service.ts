import { filterMcpScopes, type McpScope } from "@moat/mcp-contracts";
import { db } from "~/lib/db";
import { createOpaqueToken, hashTokenCandidates } from "./token-hash";

export type CreatedPat = {
	id: string;
	token: string;
	tokenPrefix: string;
	scopes: McpScope[];
	expiresAt: Date | null;
};

export async function createPersonalAccessToken(input: {
	userId: string;
	name: string;
	scopes: readonly string[];
	clientName?: string;
	expiresAt?: Date | null;
}): Promise<CreatedPat> {
	const tokenMaterial = createOpaqueToken("moat_dev");
	const scopes = filterMcpScopes(input.scopes);
	const token = await db.mcpPersonalAccessToken.create({
		data: {
			userId: input.userId,
			name: input.name,
			tokenPrefix: tokenMaterial.tokenPrefix,
			tokenHash: tokenMaterial.tokenHash,
			scopes,
			clientName: input.clientName,
			expiresAt: input.expiresAt ?? null,
		},
		select: {
			id: true,
			tokenPrefix: true,
			scopes: true,
			expiresAt: true,
		},
	});

	return {
		id: token.id,
		token: tokenMaterial.token,
		tokenPrefix: token.tokenPrefix,
		scopes: filterMcpScopes(token.scopes),
		expiresAt: token.expiresAt,
	};
}

export async function revokePersonalAccessToken(input: {
	userId: string;
	tokenId: string;
}): Promise<void> {
	await db.mcpPersonalAccessToken.updateMany({
		where: { id: input.tokenId, userId: input.userId, revokedAt: null },
		data: { revokedAt: new Date() },
	});
}

export async function validatePersonalAccessToken(token: string) {
	const tokenHashes = hashTokenCandidates(token);
	const record = await db.mcpPersonalAccessToken.findFirst({
		where: { tokenHash: { in: tokenHashes } },
		select: {
			id: true,
			userId: true,
			name: true,
			clientName: true,
			scopes: true,
			expiresAt: true,
			revokedAt: true,
		},
	});

	if (!record) return null;
	if (record.revokedAt) return null;
	if (record.expiresAt && record.expiresAt <= new Date()) return null;

	await db.mcpPersonalAccessToken.update({
		where: { id: record.id },
		data: { lastUsedAt: new Date() },
	});

	return {
		id: record.id,
		userId: record.userId,
		name: record.name,
		clientName: record.clientName,
		scopes: filterMcpScopes(record.scopes),
	};
}
