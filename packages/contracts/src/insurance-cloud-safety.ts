import type {
	InsuranceDocumentReference,
	InsurancePolicy,
	InsurancePolicyType,
	InsurancePolicyV2,
} from "./financial-profile-data";
import { normalizeInsurancePolicy } from "./financial-profile-data";

export type InsuranceCloudBlockReasonCode =
	| "policy_local_private"
	| "policy_high_local_only"
	| "policy_forbidden"
	| "health_family_policy"
	| "health_family_document"
	| "health_family_upload_extracted"
	| "cloud_document_local_only"
	| "cloud_document_blocked"
	| "cloud_document_retained_original"
	| "cloud_document_sensitive_type"
	| "sensitive_free_text";

export type InsuranceStorageClassification =
	| "cloudAllowed"
	| "localPrivateOnly"
	| "forbidden";

export interface InsuranceCloudBlockReason {
	policyId: string;
	code: InsuranceCloudBlockReasonCode;
	path?: string;
}

export interface InsuranceCloudValidationResult {
	ok: boolean;
	classification: InsuranceStorageClassification;
	reasons: InsuranceCloudBlockReason[];
}

const healthFamilyInsuranceTypes = new Set<InsurancePolicyType>([
	"health",
	"dental",
	"vision",
	"disability",
	"longTermCare",
]);

const alwaysSensitiveCloudDocumentTypes = new Set<
	InsuranceDocumentReference["documentType"]
>(["eob", "claim", "medicalRecord"]);

const forbiddenFreeTextPattern =
	/\b(diagnosis|diagnosed|prescription|medication|medical record|provider visit|doctor|physician|hospital|clinic|procedure code|cpt|icd|eob|claim number|claim #|member id|group id|ssn|social security|date of birth|dob|lab result|treatment)\b/i;

export function isHealthFamilyInsuranceType(
	type: InsurancePolicyType,
): boolean {
	return healthFamilyInsuranceTypes.has(type);
}

export function getInsuranceBlockedCloudReasons(
	policy: InsurancePolicy,
): InsuranceCloudBlockReason[] {
	const normalizedPolicy = normalizeInsurancePolicy(policy);
	const reasons: InsuranceCloudBlockReason[] = [];

	if (normalizedPolicy.storageScope === "localPrivate") {
		reasons.push(
			reason(normalizedPolicy, "policy_local_private", "storageScope"),
		);
	}

	if (normalizedPolicy.sensitivityTier === "highLocalOnly") {
		reasons.push(
			reason(normalizedPolicy, "policy_high_local_only", "sensitivityTier"),
		);
	}

	if (normalizedPolicy.sensitivityTier === "forbidden") {
		reasons.push(
			reason(normalizedPolicy, "policy_forbidden", "sensitivityTier"),
		);
	}

	if (isHealthFamilyInsuranceType(normalizedPolicy.type)) {
		reasons.push(reason(normalizedPolicy, "health_family_policy", "type"));
	}

	if (
		isHealthFamilyInsuranceType(normalizedPolicy.type) &&
		normalizedPolicy.source === "uploadExtracted"
	) {
		reasons.push(
			reason(normalizedPolicy, "health_family_upload_extracted", "source"),
		);
	}

	for (const [index, coverage] of normalizedPolicy.coverages.entries()) {
		if (coverage.sensitivityTier === "highLocalOnly") {
			reasons.push(
				reason(
					normalizedPolicy,
					"policy_high_local_only",
					`coverages.${index}.sensitivityTier`,
				),
			);
		}

		if (coverage.sensitivityTier === "forbidden") {
			reasons.push(
				reason(
					normalizedPolicy,
					"policy_forbidden",
					`coverages.${index}.sensitivityTier`,
				),
			);
		}

		collectSensitiveTextReason(
			reasons,
			normalizedPolicy,
			coverage.notes,
			`coverages.${index}.notes`,
		);
		collectSensitiveTextReason(
			reasons,
			normalizedPolicy,
			coverage.appliesTo,
			`coverages.${index}.appliesTo`,
		);
	}

	for (const [index, party] of normalizedPolicy.parties.entries()) {
		if (party.sensitivityTier === "highLocalOnly") {
			reasons.push(
				reason(
					normalizedPolicy,
					"policy_high_local_only",
					`parties.${index}.sensitivityTier`,
				),
			);
		}
	}

	for (const [index, document] of (
		normalizedPolicy.documents ?? []
	).entries()) {
		const path = `documents.${index}`;

		if (isHealthFamilyInsuranceType(normalizedPolicy.type)) {
			reasons.push(reason(normalizedPolicy, "health_family_document", path));
		}

		if (document.storageScope === "localPrivate" || document.localOnly) {
			reasons.push(reason(normalizedPolicy, "cloud_document_local_only", path));
		}

		if (document.redactionStatus === "blocked") {
			reasons.push(reason(normalizedPolicy, "cloud_document_blocked", path));
		}

		if (document.retainedOriginal) {
			reasons.push(
				reason(normalizedPolicy, "cloud_document_retained_original", path),
			);
		}

		if (alwaysSensitiveCloudDocumentTypes.has(document.documentType)) {
			reasons.push(
				reason(normalizedPolicy, "cloud_document_sensitive_type", path),
			);
		}

		collectSensitiveTextReason(
			reasons,
			normalizedPolicy,
			document.documentName,
			`${path}.documentName`,
		);
	}

	collectSensitiveDetailReasons(reasons, normalizedPolicy);

	return dedupeReasons(reasons);
}

export function validateInsurancePolicyForCloud(
	policy: InsurancePolicy,
): InsuranceCloudValidationResult {
	const reasons = getInsuranceBlockedCloudReasons(policy);
	return {
		ok: reasons.length === 0,
		classification: classifyInsurancePolicyForStorage(policy),
		reasons,
	};
}

export function classifyInsurancePolicyForStorage(
	policy: InsurancePolicy,
): InsuranceStorageClassification {
	const reasons = getInsuranceBlockedCloudReasons(policy);
	if (reasons.length === 0) return "cloudAllowed";

	const hasForbiddenReason = reasons.some((item) =>
		[
			"policy_forbidden",
			"cloud_document_blocked",
			"cloud_document_sensitive_type",
			"sensitive_free_text",
		].includes(item.code),
	);

	return hasForbiddenReason ? "forbidden" : "localPrivateOnly";
}

export function sanitizeInsurancePolicyForCloud(
	policy: InsurancePolicy,
): InsurancePolicyV2 | undefined {
	const normalizedPolicy = normalizeInsurancePolicy(policy);
	return getInsuranceBlockedCloudReasons(normalizedPolicy).length === 0
		? normalizedPolicy
		: undefined;
}

function reason(
	policy: InsurancePolicyV2,
	code: InsuranceCloudBlockReasonCode,
	path?: string,
): InsuranceCloudBlockReason {
	return { policyId: policy.id, code, path };
}

function collectSensitiveTextReason(
	reasons: InsuranceCloudBlockReason[],
	policy: InsurancePolicyV2,
	value: string | undefined,
	path: string,
) {
	if (!value || !forbiddenFreeTextPattern.test(value)) return;
	reasons.push(reason(policy, "sensitive_free_text", path));
}

function collectSensitiveDetailReasons(
	reasons: InsuranceCloudBlockReason[],
	policy: InsurancePolicyV2,
) {
	for (const [key, value] of Object.entries(policy.details)) {
		if (key === "type" || typeof value !== "string") continue;
		collectSensitiveTextReason(reasons, policy, value, `details.${key}`);
	}
}

function dedupeReasons(
	reasons: InsuranceCloudBlockReason[],
): InsuranceCloudBlockReason[] {
	const seen = new Set<string>();
	return reasons.filter((item) => {
		const key = `${item.policyId}:${item.code}:${item.path ?? ""}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
