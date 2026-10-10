export const COMMUNITY_TIPS_FEATURE_NAME = "Community Tips";
export const COMMUNITY_TIP_SINGULAR = "Community Tip";
export const COMMUNITY_TIPS_NAV_LABEL = "Community Tips";
export const COMMUNITY_TIPS_SUBMIT_ACTION = "Add a tip";
export const COMMUNITY_TIPS_MY_TIPS_LABEL = "My tips";
export const COMMUNITY_TIPS_ADMIN_LABEL = "Community Tips moderation";
export const COMMUNITY_TIP_CARD_HEADING = "Community tip";
export const ANONYMOUS_MEMBER_DISPLAY_NAME = "Anonymous member";

export const COMMUNITY_TIP_SUBMISSION_LIMIT_PER_24H_DEFAULT = 5;

export function getCommunityTipSubmissionLimitPer24h(
	envValue?: string | number | null,
): number {
	const parsed = Number(
		envValue ?? COMMUNITY_TIP_SUBMISSION_LIMIT_PER_24H_DEFAULT,
	);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return COMMUNITY_TIP_SUBMISSION_LIMIT_PER_24H_DEFAULT;
	}
	return parsed;
}

/** Default limit used by clients; servers may override via env. */
export const COMMUNITY_TIP_SUBMISSION_LIMIT_PER_24H =
	COMMUNITY_TIP_SUBMISSION_LIMIT_PER_24H_DEFAULT;

export const COMMUNITY_TIP_SUBMISSION_WINDOW_MS = 24 * 60 * 60 * 1000;

export const COMMUNITY_TIP_TITLE_MIN = 5;
export const COMMUNITY_TIP_TITLE_MAX = 120;
export const COMMUNITY_TIP_BODY_MIN = 20;
export const COMMUNITY_TIP_BODY_MAX = 5_000;
export const COMMUNITY_TIP_KEYWORDS_MAX = 30;
export const COMMUNITY_TIP_KEYWORD_MAX_LENGTH = 64;
export const COMMUNITY_TIP_TAGS_MAX = 10;
export const COMMUNITY_TIP_TAG_MAX_LENGTH = 32;
export const COMMUNITY_TIP_MERCHANTS_MAX = 20;
export const COMMUNITY_TIP_MERCHANT_MAX_LENGTH = 80;
export const COMMUNITY_TIP_CATEGORIES_MAX = 20;
export const COMMUNITY_TIP_REQUIREMENTS_MAX = 10;
export const COMMUNITY_TIP_COUNTRIES_MAX = 30;
export const COMMUNITY_TIP_GENERATED_KEYWORDS_MAX = 20;

export const COMMUNITY_TIP_FEED_LIKE_WEIGHT = 0.65;
export const COMMUNITY_TIP_FEED_RECENCY_WEIGHT = 0.35;
export const COMMUNITY_TIP_FEED_RECENCY_HALF_LIFE_DAYS = 14;

export const COMMUNITY_TIP_MATCH_MERCHANT_WEIGHT = 0.45;
export const COMMUNITY_TIP_MATCH_KEYWORD_WEIGHT = 0.3;
export const COMMUNITY_TIP_MATCH_CATEGORY_WEIGHT = 0.15;
export const COMMUNITY_TIP_MATCH_LIKE_WEIGHT = 0.1;
export const COMMUNITY_TIP_MATCH_MIN_THRESHOLD = 0.25;
export const COMMUNITY_TIP_MATCH_MAX_RESULTS = 3;
export const COMMUNITY_TIP_MATCH_DEFAULT_RESULTS = 1;

export const COMMUNITY_TIP_STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"at",
	"be",
	"for",
	"from",
	"get",
	"in",
	"is",
	"it",
	"of",
	"on",
	"or",
	"the",
	"to",
	"with",
	"you",
	"your",
	"this",
	"that",
	"use",
	"using",
]);
