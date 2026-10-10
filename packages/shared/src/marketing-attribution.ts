import { z } from "zod";

export const MARKETING_CHANNEL_IDS = ["ai", "local", "self_employed"] as const;

export type MarketingChannelId = (typeof MARKETING_CHANNEL_IDS)[number];

export const MARKETING_UTM_KEYS = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
] as const;

export type MarketingUtmKey = (typeof MARKETING_UTM_KEYS)[number];

export const MARKETING_ATTRIBUTION_COOKIE = "moat_mkt";
export const MARKETING_ATTRIBUTION_STORAGE_KEY = "moat_mkt";

const CHANNEL_PATHS: Record<MarketingChannelId, string> = {
	ai: "/for/ai-agents",
	local: "/for/local",
	self_employed: "/for/self-employed",
};

const MAX_UTM_LENGTH = 128;
const MAX_TOUCHED_AT_LENGTH = 40;
const MAX_COOKIE_LENGTH = 1800;

const channelSchema = z.enum(MARKETING_CHANNEL_IDS);

const utmSchema = z
	.object({
		utm_source: z.string().max(MAX_UTM_LENGTH).optional(),
		utm_medium: z.string().max(MAX_UTM_LENGTH).optional(),
		utm_campaign: z.string().max(MAX_UTM_LENGTH).optional(),
		utm_term: z.string().max(MAX_UTM_LENGTH).optional(),
		utm_content: z.string().max(MAX_UTM_LENGTH).optional(),
	})
	.strict();

export const marketingTouchSchema = z
	.object({
		channel: channelSchema,
		path: z.string().max(64),
		touchedAt: z.string().min(1).max(MAX_TOUCHED_AT_LENGTH),
		utm: utmSchema,
	})
	.strict()
	.superRefine((touch, ctx) => {
		const legacyPath =
			touch.channel === "ai" && touch.path === "/for/ai";
		if (touch.path !== CHANNEL_PATHS[touch.channel] && !legacyPath) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Path does not match channel",
				path: ["path"],
			});
		}
	});

export const marketingAttributionSchema = z
	.object({
		first: marketingTouchSchema,
		latest: marketingTouchSchema,
	})
	.strict();

export type MarketingTouch = z.infer<typeof marketingTouchSchema>;
export type MarketingAttribution = z.infer<typeof marketingAttributionSchema>;

const QUERY_KEYS = {
	firstChannel: "moat_channel",
	firstPath: "moat_path",
	firstTouchedAt: "moat_t",
	latestChannel: "moat_latest_channel",
	latestPath: "moat_latest_path",
	latestTouchedAt: "moat_latest_t",
} as const;

const REDIRECT_PARAM_KEYS = new Set([
	"callbackurl",
	"redirect",
	"redirect_uri",
	"next",
	"return",
	"returnto",
	"url",
	"dest",
	"destination",
]);

export function channelForPath(pathname: string): MarketingChannelId | null {
	const path = pathname.replace(/\/+$/, "") || "/";
	for (const [channel, channelPath] of Object.entries(CHANNEL_PATHS)) {
		if (path === channelPath || path.endsWith(`${channelPath}.html`)) {
			return channel as MarketingChannelId;
		}
	}
	if (
		path.endsWith("/for/ai-agents") ||
		path.endsWith("/for-ai-agents.html") ||
		path.endsWith("/for-ai-agents") ||
		path.endsWith("/for/ai") ||
		path.endsWith("/for-ai.html") ||
		path.endsWith("/for-ai")
	) {
		return "ai";
	}
	if (path.endsWith("/for-local.html") || path.endsWith("/for-local")) {
		return "local";
	}
	if (
		path.endsWith("/for-self-employed.html") ||
		path.endsWith("/for-self-employed")
	) {
		return "self_employed";
	}
	return null;
}

function cleanUtmValue(value: string | null): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (!trimmed || trimmed.length > MAX_UTM_LENGTH) return undefined;
	return trimmed;
}

export function readUtm(
	params: URLSearchParams,
	prefix = "",
): MarketingTouch["utm"] {
	const utm: MarketingTouch["utm"] = {};
	for (const key of MARKETING_UTM_KEYS) {
		const value = cleanUtmValue(params.get(`${prefix}${key}`));
		if (value) utm[key] = value;
	}
	return utm;
}

export function touchFromVisit(input: {
	pathname: string;
	search: string;
	touchedAt: string;
}): MarketingTouch | null {
	const channel = channelForPath(input.pathname);
	if (!channel) return null;
	if (input.touchedAt.length > MAX_TOUCHED_AT_LENGTH) return null;
	const params = new URLSearchParams(
		input.search.startsWith("?") ? input.search.slice(1) : input.search,
	);
	const parsed = marketingTouchSchema.safeParse({
		channel,
		path: CHANNEL_PATHS[channel],
		touchedAt: input.touchedAt,
		utm: readUtm(params),
	});
	return parsed.success ? parsed.data : null;
}

export function applyVisit(
	current: MarketingAttribution | null,
	visit: MarketingTouch,
): MarketingAttribution {
	if (!current) {
		return { first: visit, latest: visit };
	}
	return { first: current.first, latest: visit };
}

function appendTouchParams(
	params: URLSearchParams,
	touch: MarketingTouch,
	prefix: "first" | "latest",
): void {
	const channelKey =
		prefix === "first" ? QUERY_KEYS.firstChannel : QUERY_KEYS.latestChannel;
	const pathKey =
		prefix === "first" ? QUERY_KEYS.firstPath : QUERY_KEYS.latestPath;
	const timeKey =
		prefix === "first" ? QUERY_KEYS.firstTouchedAt : QUERY_KEYS.latestTouchedAt;
	const utmPrefix = prefix === "first" ? "" : "moat_latest_";
	params.set(channelKey, touch.channel);
	params.set(pathKey, touch.path);
	params.set(timeKey, touch.touchedAt);
	for (const key of MARKETING_UTM_KEYS) {
		const value = touch.utm[key];
		if (value) params.set(`${utmPrefix}${key}`, value);
	}
}

export function attributionQueryString(
	attribution: MarketingAttribution,
): string {
	const params = new URLSearchParams();
	appendTouchParams(params, attribution.first, "first");
	const latestDiffers =
		attribution.latest.channel !== attribution.first.channel ||
		attribution.latest.touchedAt !== attribution.first.touchedAt ||
		JSON.stringify(attribution.latest.utm) !==
			JSON.stringify(attribution.first.utm);
	if (latestDiffers) {
		appendTouchParams(params, attribution.latest, "latest");
	}
	return params.toString();
}

function touchFromQuery(
	params: URLSearchParams,
	prefix: "first" | "latest",
): MarketingTouch | null {
	const channelKey =
		prefix === "first" ? QUERY_KEYS.firstChannel : QUERY_KEYS.latestChannel;
	const pathKey =
		prefix === "first" ? QUERY_KEYS.firstPath : QUERY_KEYS.latestPath;
	const timeKey =
		prefix === "first" ? QUERY_KEYS.firstTouchedAt : QUERY_KEYS.latestTouchedAt;
	const channel = params.get(channelKey);
	const path = params.get(pathKey);
	const touchedAt = params.get(timeKey);
	if (!channel || !path || !touchedAt) return null;
	const utmPrefix = prefix === "first" ? "" : "moat_latest_";
	const parsed = marketingTouchSchema.safeParse({
		channel,
		path,
		touchedAt,
		utm: readUtm(params, utmPrefix),
	});
	return parsed.success ? parsed.data : null;
}

export function attributionFromSearch(
	search: string,
): MarketingAttribution | null {
	const params = new URLSearchParams(
		search.startsWith("?") ? search.slice(1) : search,
	);
	const first = touchFromQuery(params, "first");
	if (!first) return null;
	const latest = touchFromQuery(params, "latest") ?? first;
	const parsed = marketingAttributionSchema.safeParse({ first, latest });
	return parsed.success ? parsed.data : null;
}

export function serializeAttributionCookie(
	attribution: MarketingAttribution,
): string | null {
	const value = attributionQueryString(attribution);
	if (!value || value.length > MAX_COOKIE_LENGTH) return null;
	return value;
}

export function attributionFromCookie(
	cookieValue: string | undefined | null,
): MarketingAttribution | null {
	if (!cookieValue || cookieValue.length > MAX_COOKIE_LENGTH) return null;
	return attributionFromSearch(cookieValue);
}

export function decorateAppUrl(
	href: string,
	attribution: MarketingAttribution | null,
): string {
	if (!attribution) return href;
	let url: URL;
	try {
		url = new URL(href);
	} catch {
		return href;
	}
	if (url.hostname !== "app.moatfinance.ai") return href;
	const extra = attributionQueryString(attribution);
	const incoming = new URLSearchParams(extra);
	for (const [key, value] of incoming.entries()) {
		if (REDIRECT_PARAM_KEYS.has(key.toLowerCase())) continue;
		if (!url.searchParams.has(key)) url.searchParams.set(key, value);
	}
	return url.toString();
}

export function mergeIncomingAttribution(
	stored: MarketingAttribution | null,
	incoming: MarketingAttribution | null,
): MarketingAttribution | null {
	if (!incoming) return stored;
	if (!stored) return incoming;
	return { first: stored.first, latest: incoming.latest };
}
