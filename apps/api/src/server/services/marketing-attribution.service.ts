import type { MarketingAttribution } from "@moat/shared";
import { marketingAttributionSchema } from "@moat/shared";

type AttributionRow = {
	userId: string;
	firstChannel: string;
	latestChannel: string;
};

type AttributionCreateData = {
	userId: string;
	firstChannel: string;
	firstPath: string;
	firstTouchedAt: Date;
	firstUtmSource: string | null;
	firstUtmMedium: string | null;
	firstUtmCampaign: string | null;
	firstUtmTerm: string | null;
	firstUtmContent: string | null;
	latestChannel: string;
	latestPath: string;
	latestTouchedAt: Date;
	latestUtmSource: string | null;
	latestUtmMedium: string | null;
	latestUtmCampaign: string | null;
	latestUtmTerm: string | null;
	latestUtmContent: string | null;
};

type AttributionStore = {
	findUnique: (args: {
		where: { userId: string };
	}) => Promise<AttributionRow | null>;
	create: (args: { data: AttributionCreateData }) => Promise<AttributionRow>;
};

function utmColumn(
	utm: MarketingAttribution["first"]["utm"],
	key: keyof MarketingAttribution["first"]["utm"],
): string | null {
	return utm[key] ?? null;
}

function touchFields(touch: MarketingAttribution["first"]) {
	return {
		channel: touch.channel,
		path: touch.path,
		touchedAt: new Date(touch.touchedAt),
		utmSource: utmColumn(touch.utm, "utm_source"),
		utmMedium: utmColumn(touch.utm, "utm_medium"),
		utmCampaign: utmColumn(touch.utm, "utm_campaign"),
		utmTerm: utmColumn(touch.utm, "utm_term"),
		utmContent: utmColumn(touch.utm, "utm_content"),
	};
}

export async function persistSignupAttribution(
	store: AttributionStore,
	input: {
		userId: string;
		isNewUser: boolean;
		attribution: unknown;
	},
): Promise<"created" | "skipped"> {
	if (!input.isNewUser) return "skipped";
	const parsed = marketingAttributionSchema.safeParse(input.attribution);
	if (!parsed.success) return "skipped";
	const touchedAt = new Date(parsed.data.first.touchedAt);
	const latestTouchedAt = new Date(parsed.data.latest.touchedAt);
	if (
		Number.isNaN(touchedAt.getTime()) ||
		Number.isNaN(latestTouchedAt.getTime())
	) {
		return "skipped";
	}

	const existing = await store.findUnique({ where: { userId: input.userId } });
	if (existing) return "skipped";

	const first = touchFields(parsed.data.first);
	const latest = touchFields(parsed.data.latest);
	await store.create({
		data: {
			userId: input.userId,
			firstChannel: first.channel,
			firstPath: first.path,
			firstTouchedAt: first.touchedAt,
			firstUtmSource: first.utmSource,
			firstUtmMedium: first.utmMedium,
			firstUtmCampaign: first.utmCampaign,
			firstUtmTerm: first.utmTerm,
			firstUtmContent: first.utmContent,
			latestChannel: latest.channel,
			latestPath: latest.path,
			latestTouchedAt: latest.touchedAt,
			latestUtmSource: latest.utmSource,
			latestUtmMedium: latest.utmMedium,
			latestUtmCampaign: latest.utmCampaign,
			latestUtmTerm: latest.utmTerm,
			latestUtmContent: latest.utmContent,
		},
	});
	return "created";
}
