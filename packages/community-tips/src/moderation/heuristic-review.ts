import {
	extractKeywordsFromText,
	normalizeKeywordList,
} from "../keywords/normalize";
import type { CommunityTipLlmReviewResult } from "../types";

const GUARANTEED_PATTERN =
	/\b(guaranteed|100%\s+back|risk[- ]free|will definitely)\b/i;
const REFERRAL_PATTERN =
	/\b(referral\s*code|promo\s*code|use\s+my\s+code|affiliate|mlm|multi[- ]level)\b/i;
const SOLICITATION_PATTERN =
	/\b(dm\s+me|follow\s+me|subscribe\s+to\s+my|buy\s+my\s+course|join\s+my\s+team)\b/i;
const SENSITIVE_PATTERN =
	/\b(ssn|social\s+security|routing\s+number|account\s+number|password|pin\s+code)\b/i;
const ILLEGAL_PATTERN =
	/\b(tax\s+fraud|money\s+laundering|fake\s+identity|steal|hack\s+into)\b/i;
const UNSAFE_PATTERN =
	/\b(ignore\s+your\s+bank|lie\s+to\s+creditors|synthetic\s+identity)\b/i;

export function heuristicCommunityTipReview(input: {
	title: string;
	body: string;
	externalUrl?: string | null;
	keywords?: string[];
	merchantNames?: string[];
	tags?: string[];
	categories?: string[];
	tipType?: string | null;
	potentialBenefit?: string | null;
}): CommunityTipLlmReviewResult {
	const text = `${input.title}\n${input.body}`;
	const reasons: string[] = [];
	let riskScore = 0;

	const containsGuaranteedClaims = GUARANTEED_PATTERN.test(text);
	const containsReferralCode = REFERRAL_PATTERN.test(text);
	const containsSolicitation = SOLICITATION_PATTERN.test(text);
	const containsSensitiveInformation = SENSITIVE_PATTERN.test(text);
	const containsIllegalAdvice = ILLEGAL_PATTERN.test(text);
	const containsUnsafeAdvice = UNSAFE_PATTERN.test(text);
	const containsSelfPromotion =
		/\b(my\s+course|my\s+newsletter|check\s+out\s+my)\b/i.test(text);
	const containsFinancialMisinformation =
		/\b(never\s+pay\s+taxes|debt\s+elimination\s+scam)\b/i.test(text);

	let suspiciousExternalLink = false;
	if (input.externalUrl) {
		try {
			const url = new URL(input.externalUrl);
			suspiciousExternalLink =
				url.protocol !== "http:" && url.protocol !== "https:";
			if (
				/\b(bit\.ly|tinyurl|t\.co)\b/i.test(url.hostname) ||
				url.username ||
				url.password
			) {
				suspiciousExternalLink = true;
			}
		} catch {
			suspiciousExternalLink = true;
		}
	}

	if (containsGuaranteedClaims) {
		reasons.push("Contains guaranteed earnings or savings claims");
		riskScore += 0.35;
	}
	if (containsReferralCode) {
		reasons.push("Contains referral, affiliate, or recruiting language");
		riskScore += 0.45;
	}
	if (containsSolicitation) {
		reasons.push("Contains solicitation or self-promotion");
		riskScore += 0.35;
	}
	if (containsSelfPromotion) {
		reasons.push("Contains self-promotion");
		riskScore += 0.25;
	}
	if (containsSensitiveInformation) {
		reasons.push("May request or expose sensitive information");
		riskScore += 0.5;
	}
	if (containsIllegalAdvice) {
		reasons.push("May contain illegal advice");
		riskScore += 0.7;
	}
	if (containsUnsafeAdvice) {
		reasons.push("May contain unsafe financial advice");
		riskScore += 0.45;
	}
	if (containsFinancialMisinformation) {
		reasons.push("May contain financial misinformation");
		riskScore += 0.4;
	}
	if (suspiciousExternalLink) {
		reasons.push("External link looks suspicious");
		riskScore += 0.3;
	}
	if (input.body.trim().length < 40) {
		reasons.push("Submission is short and may need more detail");
		riskScore += 0.15;
	}

	riskScore = Math.min(1, riskScore);

	let decision: CommunityTipLlmReviewResult["decision"] = "PASS_TO_ADMIN";
	if (
		containsIllegalAdvice ||
		containsSensitiveInformation ||
		riskScore >= 0.75
	) {
		decision = "REJECT";
	} else if (riskScore >= 0.35) {
		decision = "CHANGES_REQUIRED";
	}

	const suggestedKeywords = normalizeKeywordList([
		...(input.keywords ?? []),
		...extractKeywordsFromText(`${input.title} ${input.body}`),
		...(input.merchantNames ?? []),
	]);

	return {
		decision,
		summary:
			decision === "PASS_TO_ADMIN"
				? "Looks suitable for admin review"
				: decision === "CHANGES_REQUIRED"
					? "Needs changes before approval"
					: "Not suitable for publication",
		reasons,
		riskScore,
		containsSolicitation,
		containsReferralCode,
		containsSelfPromotion,
		containsUnsafeAdvice,
		containsIllegalAdvice,
		containsFinancialMisinformation,
		containsGuaranteedClaims,
		containsSensitiveInformation,
		suspiciousExternalLink,
		suggestedKeywords,
		suggestedMerchants: normalizeKeywordList(input.merchantNames ?? []),
		suggestedCategories: normalizeKeywordList(input.categories ?? []),
		suggestedTags: normalizeKeywordList(input.tags ?? [], 10),
		suggestedTipType: input.tipType ?? undefined,
		suggestedPotentialBenefit: input.potentialBenefit ?? undefined,
	};
}
