import { getCsrfToken } from "@moat/client-ts";
import type {
	AcceptHouseholdInviteBody,
	CreateHouseholdInviteInput,
	HouseholdState,
	UpdateHouseholdMemberAccessInput,
} from "~/app/(dashboard)/settings/household-section/types";
import { toApiUrl } from "~/lib/api-url";

type ApiResponse<T> = {
	data?: T;
	error?: {
		message?: string;
	};
};

async function parseApiResponse<T>(res: Response): Promise<T> {
	const payload = (await res.json()) as ApiResponse<T>;
	if (!res.ok || !payload.data) {
		throw new Error(payload.error?.message || "Request failed");
	}
	return payload.data;
}

export async function getHouseholdState(): Promise<HouseholdState> {
	const res = await fetch(toApiUrl("/api/v1/household/get"), {
		method: "GET",
		credentials: "include",
	});
	return parseApiResponse<HouseholdState>(res);
}

export async function createHouseholdInvite(
	input: CreateHouseholdInviteInput,
): Promise<void> {
	const csrfToken = await getCsrfToken();
	const res = await fetch(toApiUrl("/api/v1/household/invites"), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: JSON.stringify(input),
	});
	await parseApiResponse<{ invite: unknown }>(res);
}

export async function updateHouseholdMemberAccess(
	input: UpdateHouseholdMemberAccessInput,
): Promise<void> {
	const csrfToken = await getCsrfToken();
	const res = await fetch(toApiUrl("/api/v1/household/updateMemberAccess"), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: JSON.stringify(input),
	});
	await parseApiResponse<{ membership: unknown }>(res);
}

export async function resendHouseholdInvite(inviteId: string): Promise<void> {
	const csrfToken = await getCsrfToken();
	const res = await fetch(toApiUrl("/api/v1/household/resend"), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: JSON.stringify({ inviteId }),
	});
	await parseApiResponse<{ invite: unknown }>(res);
}

export async function revokeHouseholdInvite(inviteId: string): Promise<void> {
	const csrfToken = await getCsrfToken();
	const res = await fetch(toApiUrl("/api/v1/household/revoke"), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: JSON.stringify({ inviteId }),
	});
	await parseApiResponse<{ success: boolean }>(res);
}

export async function removeHouseholdMember(
	membershipId: string,
): Promise<void> {
	const csrfToken = await getCsrfToken();
	const res = await fetch(toApiUrl("/api/v1/household/removeMember"), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: JSON.stringify({ membershipId }),
	});
	await parseApiResponse<{ success: boolean }>(res);
}

export async function acceptHouseholdInvite(
	input: AcceptHouseholdInviteBody,
): Promise<void> {
	const csrfToken = await getCsrfToken();
	const res = await fetch(toApiUrl("/api/v1/household/accept"), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: JSON.stringify(input),
	});
	await parseApiResponse<{ success: boolean }>(res);
}
