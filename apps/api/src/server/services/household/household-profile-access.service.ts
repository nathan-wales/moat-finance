import type { PrismaClient } from "../../../../generated/prisma";
import { createApiError } from "../../api-context";

export type ProfileGrantSummary = {
	profileLinkId: string;
	displayName: string;
	kind: "PERSONAL" | "FAMILY" | "BUSINESS";
};

export async function validateOwnedProfileLinkIds(
	db: PrismaClient,
	ownerUserId: string,
	profileLinkIds: string[],
): Promise<string[]> {
	const uniqueIds = Array.from(
		new Set(profileLinkIds.map((id) => id.trim()).filter(Boolean)),
	);

	if (uniqueIds.length === 0) {
		throw createApiError("Select at least one profile", 400);
	}

	const links = await db.profileLink.findMany({
		where: {
			id: { in: uniqueIds },
			ownerUserId,
			archivedAt: null,
		},
		select: { id: true },
	});

	if (links.length !== uniqueIds.length) {
		throw createApiError(
			"One or more selected profiles are invalid or unavailable",
			400,
		);
	}

	return uniqueIds;
}

export async function replaceMembershipProfileAccess(
	db: PrismaClient,
	membershipId: string,
	profileLinkIds: string[],
): Promise<void> {
	await db.$transaction(async (tx) => {
		await tx.householdProfileAccess.deleteMany({
			where: { membershipId },
		});
		await tx.householdProfileAccess.createMany({
			data: profileLinkIds.map((profileLinkId) => ({
				membershipId,
				profileLinkId,
			})),
		});
	});
}

export function toProfileGrantSummaries(
	grants: Array<{
		profileLink: {
			id: string;
			displayName: string;
			kind: "PERSONAL" | "FAMILY" | "BUSINESS";
			archivedAt: Date | null;
		};
	}>,
): ProfileGrantSummary[] {
	return grants
		.map((grant) => grant.profileLink)
		.filter((link) => link.archivedAt === null)
		.map((link) => ({
			profileLinkId: link.id,
			displayName: link.displayName,
			kind: link.kind,
		}));
}
