import {
	type FingerprintAccount,
	liveMatchFingerprints,
} from "./account-fingerprints";

export type LiveFingerprintAccount = FingerprintAccount & {
	id: string;
	plaidAccountId: string;
	plaidItemId: string;
};

export type IncomingFingerprintAccount = FingerprintAccount & {
	plaidAccountId: string;
};

export type LiveAccountMatch = {
	incomingPlaidAccountId: string;
	liveAccountId: string;
	livePlaidAccountId: string;
	liveItemId: string;
};

export function matchLiveAccounts(input: {
	live: LiveFingerprintAccount[];
	incoming: IncomingFingerprintAccount[];
}): LiveAccountMatch[] {
	if (input.live.length === 0 || input.incoming.length === 0) return [];

	const byFingerprint = new Map<string, LiveFingerprintAccount[]>();
	for (const account of input.live) {
		for (const key of liveMatchFingerprints(account)) {
			const bucket = byFingerprint.get(key);
			if (bucket) bucket.push(account);
			else byFingerprint.set(key, [account]);
		}
	}

	const claimed = new Set<string>();
	const matches: LiveAccountMatch[] = [];

	for (const incoming of input.incoming) {
		for (const key of liveMatchFingerprints(incoming)) {
			const lookup = lookupUnclaimedCandidate(byFingerprint.get(key), claimed);
			if (lookup.kind === "empty") continue;
			if (lookup.kind === "ambiguous") break;
			claimed.add(lookup.account.id);
			matches.push({
				incomingPlaidAccountId: incoming.plaidAccountId,
				liveAccountId: lookup.account.id,
				livePlaidAccountId: lookup.account.plaidAccountId,
				liveItemId: lookup.account.plaidItemId,
			});
			break;
		}
	}

	return matches;
}

export function classifyIncomingAccounts(input: {
	live: LiveFingerprintAccount[];
	incoming: IncomingFingerprintAccount[];
}): {
	alreadyLinked: LiveAccountMatch[];
	newAccounts: IncomingFingerprintAccount[];
} {
	const alreadyLinked = matchLiveAccounts(input);
	const linkedIncomingIds = new Set(
		alreadyLinked.map((match) => match.incomingPlaidAccountId),
	);
	return {
		alreadyLinked,
		newAccounts: input.incoming.filter(
			(account) => !linkedIncomingIds.has(account.plaidAccountId),
		),
	};
}

type FingerprintLookup =
	| { kind: "empty" }
	| { kind: "ambiguous" }
	| { kind: "unique"; account: LiveFingerprintAccount };

function lookupUnclaimedCandidate(
	bucket: LiveFingerprintAccount[] | undefined,
	claimed: Set<string>,
): FingerprintLookup {
	if (!bucket) return { kind: "empty" };
	const unclaimed = bucket.filter((candidate) => !claimed.has(candidate.id));
	if (unclaimed.length === 0) return { kind: "empty" };
	if (unclaimed.length > 1) return { kind: "ambiguous" };
	const account = unclaimed[0];
	if (!account) return { kind: "empty" };
	return { kind: "unique", account };
}
