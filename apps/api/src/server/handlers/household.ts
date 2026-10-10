import { addDays } from "date-fns";
import { ZodError, z } from "zod";
import { sendHouseholdInviteEmail } from "~/lib/email/send-household-invite-email";
import { logger } from "~/lib/logger";
import type { ApiContext } from "../api-context";
import {
	isDatabaseActorContextEnabled,
	serviceDatabaseActor,
	withDatabaseActor,
} from "../db-actor";
import {
	type AuthenticatedContext,
	withAuth,
	withPublic,
} from "../handler-wrappers";
import {
	generateInviteTokenPair,
	hashInviteToken,
} from "../lib/household-invite-token";
import {
	replaceMembershipProfileAccess,
	toProfileGrantSummaries,
	validateOwnedProfileLinkIds,
} from "../services/household/household-profile-access.service";

type ApiError = Error & { status: number };

const INVITE_EXPIRY_DAYS = 7;
const RESEND_COOLDOWN_MS = 60_000;

function createApiError(message: string, status: number): ApiError {
	const error = new Error(message) as ApiError;
	error.status = status;
	return error;
}

function parseWithBadRequest<T>(schema: z.ZodType<T>, body: unknown): T {
	try {
		return schema.parse(body);
	} catch (error) {
		if (error instanceof ZodError) {
			const message = error.issues[0]?.message ?? "Invalid input";
			throw createApiError(message, 400);
		}
		throw error;
	}
}

const createInviteInput = z.object({
	name: z.string().trim().min(1, "Name is required").max(100),
	email: z
		.string()
		.trim()
		.min(1, "Email is required")
		.max(320)
		.email("Valid email is required"),
	profileLinkIds: z
		.array(z.string().trim().min(1))
		.min(1, "Select at least one profile"),
});

const acceptInviteInput = z.object({
	token: z.string().trim().min(1, "Invite token is required"),
});

const removeMemberInput = z.object({
	membershipId: z.string().trim().min(1, "Membership id is required"),
});

const updateMemberAccessInput = z.object({
	membershipId: z.string().trim().min(1, "Membership id is required"),
	profileLinkIds: z
		.array(z.string().trim().min(1))
		.min(1, "Select at least one profile"),
});

function assertHouseholdOwner(ctx: AuthenticatedContext) {
	if (ctx.isHouseholdMember) {
		throw createApiError("Only the household owner can manage members", 403);
	}
}

function resolveHouseholdOwnerUserId(ctx: AuthenticatedContext): string {
	// Caller must assertHouseholdOwner first — owners always manage via actor id,
	// including when a Family/Business profile is active.
	return ctx.actorUserId;
}

async function resolveOwnerUserIdForViewer(
	ctx: AuthenticatedContext,
): Promise<string> {
	if (!ctx.isHouseholdMember) {
		return ctx.actorUserId;
	}

	const membership = await ctx.db.householdMembership.findFirst({
		where: {
			memberUserId: ctx.actorUserId,
			status: "ACTIVE",
		},
		select: { ownerUserId: true },
	});

	if (!membership) {
		throw createApiError("Household membership not found", 404);
	}

	return membership.ownerUserId;
}

async function getOwnerSummary(ctx: AuthenticatedContext, userId: string) {
	const owner = await ctx.db.user.findUnique({
		where: { id: userId },
		select: { id: true, name: true, email: true },
	});

	if (!owner) {
		throw createApiError("Owner not found", 404);
	}

	if (!owner.email) {
		throw createApiError("Owner email is required", 403);
	}

	return owner;
}

async function expireStalePendingInvites(
	ctx: AuthenticatedContext,
	ownerUserId: string,
) {
	await ctx.db.householdInvite.updateMany({
		where: {
			ownerUserId,
			status: "PENDING",
			expiresAt: { lte: new Date() },
		},
		data: {
			status: "EXPIRED",
		},
	});
}

function getInviteBaseUrl(): string {
	const baseUrl = process.env.APP_BASE_URL?.trim();
	if (!baseUrl) {
		throw createApiError("APP_BASE_URL is not configured", 500);
	}
	return baseUrl.replace(/\/$/, "");
}

function toMembershipSummary(
	membership: {
		id: string;
		status: "ACTIVE" | "REMOVED";
		createdAt: Date;
		updatedAt: Date;
		memberUser: {
			id: string;
			name: string | null;
			email: string | null;
		};
		profileAccess: Array<{
			profileLink: {
				id: string;
				displayName: string;
				kind: "PERSONAL" | "FAMILY" | "BUSINESS";
				archivedAt: Date | null;
			};
		}>;
	} | null,
) {
	if (!membership) return null;
	const profiles = toProfileGrantSummaries(membership.profileAccess);
	return {
		id: membership.id,
		status: membership.status,
		createdAt: membership.createdAt,
		updatedAt: membership.updatedAt,
		profileLinkIds: profiles.map((profile) => profile.profileLinkId),
		profiles,
		member: {
			id: membership.memberUser.id,
			name: membership.memberUser.name,
			email: membership.memberUser.email,
			access: "FULL_ACCESS" as const,
		},
	};
}

function toInviteSummary(
	invite: {
		id: string;
		inviteeName: string;
		inviteeEmail: string;
		status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
		createdAt: Date;
		expiresAt: Date;
		sentAt: Date | null;
		profileAccess?: Array<{
			profileLink: {
				id: string;
				displayName: string;
				kind: "PERSONAL" | "FAMILY" | "BUSINESS";
				archivedAt: Date | null;
			};
		}>;
	} | null,
) {
	if (!invite) return null;
	const profiles = toProfileGrantSummaries(invite.profileAccess ?? []);
	return {
		id: invite.id,
		inviteeName: invite.inviteeName,
		inviteeEmail: invite.inviteeEmail,
		status: invite.status,
		createdAt: invite.createdAt,
		expiresAt: invite.expiresAt,
		sentAt: invite.sentAt,
		profileLinkIds: profiles.map((profile) => profile.profileLinkId),
		profiles,
	};
}

const membershipSelect = {
	id: true,
	status: true,
	createdAt: true,
	updatedAt: true,
	memberUser: {
		select: {
			id: true,
			name: true,
			email: true,
		},
	},
	profileAccess: {
		select: {
			profileLink: {
				select: {
					id: true,
					displayName: true,
					kind: true,
					archivedAt: true,
				},
			},
		},
	},
} as const;

const inviteSelect = {
	id: true,
	inviteeName: true,
	inviteeEmail: true,
	status: true,
	createdAt: true,
	expiresAt: true,
	sentAt: true,
	profileAccess: {
		select: {
			profileLink: {
				select: {
					id: true,
					displayName: true,
					kind: true,
					archivedAt: true,
				},
			},
		},
	},
} as const;

export const household = {
	/**
	 * GET /api/v1/household/preview?token=...
	 * Public — returns inviter name + invitee email for a pending invite.
	 */
	preview: withPublic(async (ctx: ApiContext) => {
		const token = ctx.req.query.token;
		if (typeof token !== "string" || !token) {
			throw createApiError("Missing invite token", 400);
		}

		const tokenHash = hashInviteToken(token);
		const now = new Date();

		const invite = await ctx.db.householdInvite.findUnique({
			where: { tokenHash },
			select: {
				inviteeName: true,
				inviteeEmail: true,
				status: true,
				expiresAt: true,
				ownerUserId: true,
			},
		});

		if (!invite || invite.status !== "PENDING" || invite.expiresAt <= now) {
			throw createApiError("Invite not found or no longer active", 404);
		}

		const owner = await ctx.db.user.findUnique({
			where: { id: invite.ownerUserId },
			select: { name: true },
		});

		return {
			inviterName: owner?.name ?? "Someone",
			inviteeEmail: invite.inviteeEmail,
		};
	}),

	/**
	 * GET /api/v1/household/get
	 */
	get: withAuth(async (ctx: AuthenticatedContext) => {
		const ownerUserId = await resolveOwnerUserIdForViewer(ctx);
		await expireStalePendingInvites(ctx, ownerUserId);

		const [owner, memberships, pendingInvite] = await Promise.all([
			getOwnerSummary(ctx, ownerUserId),
			ctx.db.householdMembership.findMany({
				where: {
					ownerUserId,
					status: "ACTIVE",
				},
				select: membershipSelect,
				orderBy: { createdAt: "asc" },
			}),
			ctx.db.householdInvite.findFirst({
				where: {
					ownerUserId,
					status: "PENDING",
					expiresAt: { gt: new Date() },
				},
				select: inviteSelect,
				orderBy: { createdAt: "desc" },
			}),
		]);

		const membershipSummaries = memberships.map((membership) =>
			toMembershipSummary(membership),
		);

		return {
			canManage: !ctx.isHouseholdMember,
			owner,
			membership: membershipSummaries[0] ?? null,
			memberships: membershipSummaries,
			pendingInvite: toInviteSummary(pendingInvite),
		};
	}),

	/**
	 * POST /api/v1/household/invites
	 */
	invites: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		assertHouseholdOwner(ctx);
		const ownerUserId = resolveHouseholdOwnerUserId(ctx);
		const input = parseWithBadRequest(createInviteInput, body);
		const normalizedEmail = input.email.trim().toLowerCase();
		const owner = await getOwnerSummary(ctx, ownerUserId);
		const profileLinkIds = await validateOwnedProfileLinkIds(
			ctx.db,
			ownerUserId,
			input.profileLinkIds,
		);

		if (!owner.email) {
			throw createApiError("Owner email is required to send invites", 403);
		}

		if (normalizedEmail === owner.email.toLowerCase()) {
			throw createApiError("You cannot invite your own email", 403);
		}

		await expireStalePendingInvites(ctx, ownerUserId);

		const existingPendingInvite = await ctx.db.householdInvite.findFirst({
			where: {
				ownerUserId,
				status: "PENDING",
				expiresAt: { gt: new Date() },
			},
			select: { id: true },
		});

		if (existingPendingInvite) {
			throw createApiError("A pending household invite already exists.", 409);
		}

		const existingMember = await ctx.db.user.findFirst({
			where: {
				email: normalizedEmail,
				householdMembershipsAsMember: {
					some: {
						ownerUserId,
						status: "ACTIVE",
					},
				},
			},
			select: { id: true },
		});

		if (existingMember) {
			throw createApiError(
				"This person is already an active household member",
				409,
			);
		}

		const { rawToken, tokenHash } = generateInviteTokenPair();
		const expiresAt = addDays(new Date(), INVITE_EXPIRY_DAYS);
		const inviteUrl = `${getInviteBaseUrl()}/household/accept?token=${encodeURIComponent(rawToken)}`;

		try {
			await sendHouseholdInviteEmail({
				to: normalizedEmail,
				inviteeName: input.name,
				ownerName: owner.name ?? owner.email,
				inviteUrl,
				expiresAt,
			});
		} catch (error) {
			logger.logError("Failed to send household invite email", error, {
				feature: "household",
				operation: "createInvite",
				userId: ownerUserId,
			});
			throw createApiError("Failed to send invite email", 500);
		}

		const createdInvite = await ctx.db.householdInvite.create({
			data: {
				ownerUserId,
				inviteeName: input.name,
				inviteeEmail: normalizedEmail,
				tokenHash,
				status: "PENDING",
				expiresAt,
				sentAt: new Date(),
				profileAccess: {
					create: profileLinkIds.map((profileLinkId) => ({
						profileLinkId,
					})),
				},
			},
			select: inviteSelect,
		});

		return {
			invite: toInviteSummary(createdInvite),
		};
	}),

	/**
	 * POST /api/v1/household/invites/:inviteId/resend
	 */
	resend: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		assertHouseholdOwner(ctx);
		const ownerUserId = resolveHouseholdOwnerUserId(ctx);
		const input = parseWithBadRequest(
			z.object({ inviteId: z.string().trim().min(1, "Invite id is required") }),
			body,
		);

		const owner = await getOwnerSummary(ctx, ownerUserId);

		if (!owner.email) {
			throw createApiError("Owner email is required to resend invites", 403);
		}

		const invite = await ctx.db.householdInvite.findFirst({
			where: {
				id: input.inviteId,
				ownerUserId,
			},
			select: {
				id: true,
				inviteeName: true,
				inviteeEmail: true,
				status: true,
				createdAt: true,
				expiresAt: true,
				sentAt: true,
			},
		});

		if (!invite) {
			throw createApiError("Invite not found", 404);
		}

		if (invite.status !== "PENDING") {
			throw createApiError("Only pending invites can be resent", 409);
		}

		if (invite.expiresAt <= new Date()) {
			await ctx.db.householdInvite.update({
				where: { id: invite.id },
				data: { status: "EXPIRED" },
			});
			throw createApiError("Invite has expired", 409);
		}

		if (
			invite.sentAt &&
			Date.now() - invite.sentAt.getTime() < RESEND_COOLDOWN_MS
		) {
			throw createApiError("Please wait before resending this invite", 429);
		}

		const { rawToken, tokenHash } = generateInviteTokenPair();
		const expiresAt = addDays(new Date(), INVITE_EXPIRY_DAYS);
		const inviteUrl = `${getInviteBaseUrl()}/household/accept?token=${encodeURIComponent(rawToken)}`;

		try {
			await sendHouseholdInviteEmail({
				to: invite.inviteeEmail,
				inviteeName: invite.inviteeName,
				ownerName: owner.name ?? owner.email,
				inviteUrl,
				expiresAt,
			});
		} catch (error) {
			logger.logError("Failed to resend household invite email", error, {
				feature: "household",
				operation: "resendInvite",
				userId: ownerUserId,
				inviteId: invite.id,
			});
			throw createApiError("Failed to send invite email", 500);
		}

		await ctx.db.householdInvite.update({
			where: { id: invite.id },
			data: {
				tokenHash,
				expiresAt,
				sentAt: new Date(),
			},
		});

		const updatedInvite = await ctx.db.householdInvite.findUnique({
			where: { id: invite.id },
			select: inviteSelect,
		});

		return {
			invite: toInviteSummary(updatedInvite),
		};
	}),

	/**
	 * POST /api/v1/household/invites/:inviteId/revoke
	 */
	revoke: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		assertHouseholdOwner(ctx);
		const ownerUserId = resolveHouseholdOwnerUserId(ctx);
		const input = parseWithBadRequest(
			z.object({ inviteId: z.string().trim().min(1, "Invite id is required") }),
			body,
		);

		const invite = await ctx.db.householdInvite.findFirst({
			where: {
				id: input.inviteId,
				ownerUserId,
			},
			select: {
				id: true,
				status: true,
				expiresAt: true,
			},
		});

		if (!invite) {
			throw createApiError("Invite not found", 404);
		}

		if (invite.status !== "PENDING") {
			throw createApiError("Only pending invites can be revoked", 409);
		}

		const now = new Date();
		if (invite.expiresAt <= now) {
			await ctx.db.householdInvite.update({
				where: { id: invite.id },
				data: { status: "EXPIRED" },
			});
			throw createApiError("Invite has expired", 409);
		}

		await ctx.db.householdInvite.update({
			where: { id: invite.id },
			data: {
				status: "REVOKED",
				revokedAt: now,
			},
		});

		return {
			success: true,
		};
	}),

	/**
	 * POST /api/v1/household/invites/accept
	 */
	accept: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = parseWithBadRequest(acceptInviteInput, body);
		const memberUserId = ctx.actorUserId;
		const tokenHash = hashInviteToken(input.token);
		const now = new Date();

		const [invite, member] = await Promise.all([
			ctx.db.householdInvite.findUnique({
				where: { tokenHash },
				select: {
					id: true,
					ownerUserId: true,
					inviteeEmail: true,
					status: true,
					expiresAt: true,
				},
			}),
			ctx.db.user.findUnique({
				where: { id: memberUserId },
				select: { email: true },
			}),
		]);

		if (!invite) {
			throw createApiError("Invite not found", 404);
		}

		if (!member?.email) {
			throw createApiError(
				"An account email is required to accept this invite",
				403,
			);
		}

		if (member.email.toLowerCase() !== invite.inviteeEmail.toLowerCase()) {
			throw createApiError(
				"This invitation was sent to a different email address than the one you are currently logged in with. Please sign out and sign in with the correct email address to accept this invitation.",
				403,
			);
		}

		if (invite.ownerUserId === memberUserId) {
			throw createApiError("You cannot accept your own invite", 403);
		}

		if (invite.status === "ACCEPTED") {
			const membership = await ctx.db.householdMembership.findFirst({
				where: {
					ownerUserId: invite.ownerUserId,
					memberUserId,
					status: "ACTIVE",
				},
				select: { id: true },
			});

			if (membership) {
				return { success: true };
			}
		}

		if (invite.status !== "PENDING") {
			throw createApiError("Invite is no longer active", 409);
		}

		if (invite.expiresAt <= now) {
			await ctx.db.householdInvite.update({
				where: { id: invite.id },
				data: { status: "EXPIRED" },
			});
			throw createApiError("Invite has expired", 409);
		}

		const acceptInvite = async (db: AuthenticatedContext["db"]) => {
			await db.$transaction(async (tx) => {
				const existingMembershipForMember =
					await tx.householdMembership.findFirst({
						where: {
							memberUserId,
							status: "ACTIVE",
							ownerUserId: { not: invite.ownerUserId },
						},
						select: { id: true },
					});

				if (existingMembershipForMember) {
					throw createApiError(
						"This account is already a member of another household",
						409,
					);
				}

				const membership = await tx.householdMembership.upsert({
					where: {
						ownerUserId_memberUserId: {
							ownerUserId: invite.ownerUserId,
							memberUserId,
						},
					},
					create: {
						ownerUserId: invite.ownerUserId,
						memberUserId,
						status: "ACTIVE",
					},
					update: {
						status: "ACTIVE",
						removedAt: null,
					},
					select: { id: true },
				});

				await tx.householdProfileAccess.deleteMany({
					where: { membershipId: membership.id },
				});

				const inviteGrants = await tx.householdInviteProfileAccess.findMany({
					where: { inviteId: invite.id },
					select: { profileLinkId: true },
				});

				if (inviteGrants.length === 0) {
					throw createApiError(
						"This invite has no profile access grants configured",
						409,
					);
				}

				await tx.householdProfileAccess.createMany({
					data: inviteGrants.map((grant) => ({
						membershipId: membership.id,
						profileLinkId: grant.profileLinkId,
					})),
				});

				await tx.householdInvite.update({
					where: { id: invite.id },
					data: {
						status: "ACCEPTED",
						acceptedAt: now,
					},
				});
			});
		};

		if (isDatabaseActorContextEnabled()) {
			await withDatabaseActor(serviceDatabaseActor(), async (serviceDb) =>
				acceptInvite(serviceDb),
			);
		} else {
			await acceptInvite(ctx.db);
		}

		return {
			success: true,
		};
	}),

	/**
	 * POST /api/v1/household/removeMember
	 */
	removeMember: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		assertHouseholdOwner(ctx);
		const input = parseWithBadRequest(removeMemberInput, body);
		const ownerUserId = resolveHouseholdOwnerUserId(ctx);
		const now = new Date();

		const result = await ctx.db.householdMembership.updateMany({
			where: {
				id: input.membershipId,
				ownerUserId,
				status: "ACTIVE",
			},
			data: {
				status: "REMOVED",
				removedAt: now,
			},
		});

		if (result.count === 0) {
			throw createApiError("Household member not found", 404);
		}

		return { success: true };
	}),

	/**
	 * POST /api/v1/household/updateMemberAccess
	 */
	updateMemberAccess: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			assertHouseholdOwner(ctx);
			const ownerUserId = resolveHouseholdOwnerUserId(ctx);
			const input = parseWithBadRequest(updateMemberAccessInput, body);
			const profileLinkIds = await validateOwnedProfileLinkIds(
				ctx.db,
				ownerUserId,
				input.profileLinkIds,
			);

			const membership = await ctx.db.householdMembership.findFirst({
				where: {
					id: input.membershipId,
					ownerUserId,
					status: "ACTIVE",
				},
				select: { id: true },
			});

			if (!membership) {
				throw createApiError("Household member not found", 404);
			}

			await replaceMembershipProfileAccess(
				ctx.db,
				membership.id,
				profileLinkIds,
			);

			const updated = await ctx.db.householdMembership.findUnique({
				where: { id: membership.id },
				select: membershipSelect,
			});

			return {
				membership: toMembershipSummary(updated),
			};
		},
	),
};
