export const SESSION_RESOLVE_HEADER = "x-moat-session-resolve";

export type SessionCandidateIdKind = "cuid" | "google_subject" | "other";

export type SessionTokenIdentity = {
	id?: unknown;
	sub?: unknown;
	email?: unknown;
};

export type SessionJwtCandidateDescription = {
	candidateIdKind: SessionCandidateIdKind;
	idPresent: boolean;
	subPresent: boolean;
	idEqualsSub: boolean;
};

export type SessionUserRepairResult =
	| { status: "skipped" }
	| {
			status: "repaired";
			candidateIdKind: SessionCandidateIdKind;
			resolvedUserId: string;
	  }
	| { status: "unresolved"; candidateIdKind: SessionCandidateIdKind };

const CUID_PATTERN = /^c[a-z0-9]{24}$/;
const GOOGLE_SUBJECT_PATTERN = /^\d{15,}$/;

function nonEmptyString(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function classifySessionCandidateId(
	value: string | null | undefined,
): SessionCandidateIdKind {
	if (!value) return "other";
	if (CUID_PATTERN.test(value)) return "cuid";
	if (GOOGLE_SUBJECT_PATTERN.test(value)) return "google_subject";
	return "other";
}

export function describeSessionJwtCandidate(
	decoded: { id?: unknown; sub?: unknown } | null | undefined,
): SessionJwtCandidateDescription {
	const id = nonEmptyString(decoded?.id);
	const sub = nonEmptyString(decoded?.sub);
	const candidateId = id ?? sub;
	return {
		candidateIdKind: classifySessionCandidateId(candidateId),
		idPresent: id !== null,
		subPresent: sub !== null,
		idEqualsSub: id !== null && id === sub,
	};
}

function signaturesMatch(expected: string, actual: string): boolean {
	if (expected.length !== actual.length) return false;
	let mismatch = 0;
	for (let index = 0; index < expected.length; index++) {
		mismatch |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
	}
	return mismatch === 0;
}

export async function signSessionResolveEmail(
	email: string,
	secret: string,
): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const mac = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(email.trim().toLowerCase()),
	);
	return [...new Uint8Array(mac)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export async function verifySessionResolveEmail(
	email: string,
	signature: string,
	secret: string,
): Promise<boolean> {
	if (!/^[0-9a-f]{64}$/.test(signature)) return false;
	const expected = await signSessionResolveEmail(email, secret);
	return signaturesMatch(expected, signature);
}

export async function repairSessionTokenUserId(
	token: SessionTokenIdentity,
	resolveUserIdByEmail: (email: string) => Promise<string | null>,
): Promise<SessionUserRepairResult> {
	const id = nonEmptyString(token.id);
	const sub = nonEmptyString(token.sub);
	const candidateId = id ?? sub;
	if (!candidateId) return { status: "skipped" };

	const candidateIdKind = classifySessionCandidateId(candidateId);
	if (candidateIdKind === "cuid") return { status: "skipped" };

	const email = nonEmptyString(token.email);
	if (!email) return { status: "unresolved", candidateIdKind };

	const resolvedUserId = await resolveUserIdByEmail(email);
	if (!resolvedUserId) return { status: "unresolved", candidateIdKind };

	token.id = resolvedUserId;
	token.sub = resolvedUserId;
	return { status: "repaired", candidateIdKind, resolvedUserId };
}
