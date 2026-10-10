import { ANONYMOUS_MEMBER_DISPLAY_NAME } from "./constants";
import type {
	CommunityTipAttribution,
	CommunityTipPublicAuthor,
} from "./types";

export function publicAuthorFromAttribution(input: {
	attribution: CommunityTipAttribution;
	name: string | null;
	username: string | null;
	image: string | null;
}): CommunityTipPublicAuthor {
	if (input.attribution === "ANONYMOUS") {
		return {
			displayName: ANONYMOUS_MEMBER_DISPLAY_NAME,
			imageUrl: null,
		};
	}

	const name = input.name?.trim();
	if (name) {
		const first = name.split(/\s+/)[0];
		return {
			displayName: first || name,
			imageUrl: input.image,
		};
	}

	if (input.username?.trim()) {
		return {
			displayName: input.username.trim(),
			imageUrl: input.image,
		};
	}

	return {
		displayName: "Moat member",
		imageUrl: input.image,
	};
}

export function adminAuthorDisplayName(input: {
	name: string | null;
	username: string | null;
	email: string | null;
}): string {
	if (input.name?.trim()) return input.name.trim();
	if (input.username?.trim()) return input.username.trim();
	if (input.email?.trim()) return input.email.trim();
	return "Unknown user";
}
