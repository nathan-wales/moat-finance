import Foundation

enum InsuranceCloudBlockReasonCode: String, Equatable {
    case policyLocalPrivate = "policy_local_private"
    case policyHighLocalOnly = "policy_high_local_only"
    case policyForbidden = "policy_forbidden"
    case healthFamilyPolicy = "health_family_policy"
    case healthFamilyDocument = "health_family_document"
    case healthFamilyUploadExtracted = "health_family_upload_extracted"
    case cloudDocumentLocalOnly = "cloud_document_local_only"
    case cloudDocumentBlocked = "cloud_document_blocked"
    case cloudDocumentRetainedOriginal = "cloud_document_retained_original"
    case cloudDocumentSensitiveType = "cloud_document_sensitive_type"
    case sensitiveFreeText = "sensitive_free_text"
}

struct InsuranceCloudBlockReason: Equatable {
    let policyId: String
    let code: InsuranceCloudBlockReasonCode
    let path: String?
}

private let healthFamilyInsuranceTypes: Set<InsurancePolicyType> = [
    .health,
    .dental,
    .vision,
    .disability,
    .longTermCare,
]

private let alwaysSensitiveCloudDocumentTypes: Set<String> = [
    "eob",
    "claim",
    "medicalRecord",
]

private let forbiddenFreeTextPattern = try! NSRegularExpression(
    pattern: "\\b(diagnosis|diagnosed|prescription|medication|medical record|provider visit|doctor|physician|hospital|clinic|procedure code|cpt|icd|eob|claim number|claim #|member id|group id|ssn|social security|date of birth|dob|lab result|treatment)\\b",
    options: [.caseInsensitive]
)

func isHealthFamilyInsuranceType(_ type: InsurancePolicyType) -> Bool {
    healthFamilyInsuranceTypes.contains(type)
}

func getInsuranceBlockedCloudReasons(policy: InsurancePolicy) -> [InsuranceCloudBlockReason] {
    let normalizedPolicy = normalizeInsurancePolicy(policy)
    var reasons: [InsuranceCloudBlockReason] = []

    if normalizedPolicy.storageScope == .localPrivate {
        reasons.append(reason(normalizedPolicy, .policyLocalPrivate, path: "storageScope"))
    }

    if normalizedPolicy.sensitivityTier == .highLocalOnly {
        reasons.append(reason(normalizedPolicy, .policyHighLocalOnly, path: "sensitivityTier"))
    }

    if normalizedPolicy.sensitivityTier == .forbidden {
        reasons.append(reason(normalizedPolicy, .policyForbidden, path: "sensitivityTier"))
    }

    if isHealthFamilyInsuranceType(normalizedPolicy.type) {
        reasons.append(reason(normalizedPolicy, .healthFamilyPolicy, path: "type"))
    }

    if isHealthFamilyInsuranceType(normalizedPolicy.type), normalizedPolicy.source == "uploadExtracted" {
        reasons.append(reason(normalizedPolicy, .healthFamilyUploadExtracted, path: "source"))
    }

    for (index, coverage) in normalizedPolicy.coverages.enumerated() {
        if coverage.sensitivityTier == .highLocalOnly {
            reasons.append(
                reason(
                    normalizedPolicy,
                    .policyHighLocalOnly,
                    path: "coverages.\(index).sensitivityTier"
                )
            )
        }

        if coverage.sensitivityTier == .forbidden {
            reasons.append(
                reason(
                    normalizedPolicy,
                    .policyForbidden,
                    path: "coverages.\(index).sensitivityTier"
                )
            )
        }

        collectSensitiveTextReason(
            &reasons,
            policy: normalizedPolicy,
            value: coverage.notes,
            path: "coverages.\(index).notes"
        )
        collectSensitiveTextReason(
            &reasons,
            policy: normalizedPolicy,
            value: coverage.appliesTo,
            path: "coverages.\(index).appliesTo"
        )
    }

    for (index, party) in normalizedPolicy.parties.enumerated() {
        if party.sensitivityTier == InsuranceSensitivityTier.highLocalOnly.rawValue {
            reasons.append(
                reason(
                    normalizedPolicy,
                    .policyHighLocalOnly,
                    path: "parties.\(index).sensitivityTier"
                )
            )
        }
    }

    for (index, document) in (normalizedPolicy.documents ?? []).enumerated() {
        let path = "documents.\(index)"

        if isHealthFamilyInsuranceType(normalizedPolicy.type) {
            reasons.append(reason(normalizedPolicy, .healthFamilyDocument, path: path))
        }

        if document.storageScope == .localPrivate || document.localOnly {
            reasons.append(reason(normalizedPolicy, .cloudDocumentLocalOnly, path: path))
        }

        if document.redactionStatus == "blocked" {
            reasons.append(reason(normalizedPolicy, .cloudDocumentBlocked, path: path))
        }

        if document.retainedOriginal {
            reasons.append(reason(normalizedPolicy, .cloudDocumentRetainedOriginal, path: path))
        }

        if alwaysSensitiveCloudDocumentTypes.contains(document.documentType) {
            reasons.append(reason(normalizedPolicy, .cloudDocumentSensitiveType, path: path))
        }

        collectSensitiveTextReason(
            &reasons,
            policy: normalizedPolicy,
            value: document.documentName,
            path: "\(path).documentName"
        )
    }

    collectSensitiveDetailReasons(&reasons, policy: normalizedPolicy)

    return dedupeReasons(reasons)
}

func insuranceCloudBlockReasonMessage(for code: InsuranceCloudBlockReasonCode) -> String {
    switch code {
    case .policyLocalPrivate:
        return "This policy is marked for local-private storage only."
    case .policyHighLocalOnly, .healthFamilyPolicy, .healthFamilyUploadExtracted:
        return "Health and disability policies can only be stored in Moat Private Desktop."
    case .policyForbidden:
        return "This policy contains forbidden sensitive details."
    case .healthFamilyDocument:
        return "Health-related documents cannot be stored in Moat Cloud."
    case .cloudDocumentLocalOnly:
        return "One or more documents are marked local-only."
    case .cloudDocumentBlocked:
        return "A document failed redaction and cannot sync to Moat Cloud."
    case .cloudDocumentRetainedOriginal:
        return "Original sensitive documents cannot be retained in Moat Cloud."
    case .cloudDocumentSensitiveType:
        return "Claims, EOBs, and medical records cannot be stored in Moat Cloud."
    case .sensitiveFreeText:
        return "Remove medical IDs, diagnoses, prescriptions, or other sensitive free text before saving to Moat Cloud."
    }
}

extension InsuranceCloudBlockReason {
    var userFacingMessage: String {
        insuranceCloudBlockReasonMessage(for: code)
    }
}

private func reason(
    _ policy: InsurancePolicyV2,
    _ code: InsuranceCloudBlockReasonCode,
    path: String? = nil
) -> InsuranceCloudBlockReason {
    InsuranceCloudBlockReason(policyId: policy.id, code: code, path: path)
}

private func collectSensitiveTextReason(
    _ reasons: inout [InsuranceCloudBlockReason],
    policy: InsurancePolicyV2,
    value: String?,
    path: String
) {
    guard let value, !value.isEmpty else { return }
    let range = NSRange(value.startIndex..<value.endIndex, in: value)
    guard forbiddenFreeTextPattern.firstMatch(in: value, options: [], range: range) != nil else {
        return
    }
    reasons.append(reason(policy, .sensitiveFreeText, path: path))
}

private func collectSensitiveDetailReasons(
    _ reasons: inout [InsuranceCloudBlockReason],
    policy: InsurancePolicyV2
) {
    let mirror = Mirror(reflecting: policy.details)
    for child in mirror.children {
        guard let key = child.label, key != "type", let value = child.value as? String else {
            continue
        }
        collectSensitiveTextReason(&reasons, policy: policy, value: value, path: "details.\(key)")
    }
}

private func dedupeReasons(_ reasons: [InsuranceCloudBlockReason]) -> [InsuranceCloudBlockReason] {
    var seen = Set<String>()
    return reasons.filter { item in
        let key = "\(item.policyId):\(item.code.rawValue):\(item.path ?? "")"
        if seen.contains(key) {
            return false
        }
        seen.insert(key)
        return true
    }
}

private func normalizeInsurancePolicy(_ policy: InsurancePolicy) -> InsurancePolicyV2 {
    switch policy {
    case .v2(let value):
        return value
    case .legacy(let legacy):
        return legacyInsurancePolicyToV2(legacy)
    }
}

private func legacyInsurancePolicyToV2(_ policy: LegacyInsurancePolicy) -> InsurancePolicyV2 {
    let type = legacyInsuranceTypeToV2(policy.type)
    let coverages: [InsuranceCoverage] = if let coverageAmount = policy.coverageAmount {
        [
            InsuranceCoverage(
                id: "\(policy.id)-primary-coverage",
                coverageType: "primary",
                label: "Primary coverage",
                limitAmount: coverageAmount,
                sensitivityTier: .low
            ),
        ]
    } else {
        []
    }
    let assets: [InsuranceCoveredAsset] = if let linkedAsset = policy.linkedAsset {
        [
            InsuranceCoveredAsset(
                id: "\(policy.id)-linked-asset",
                label: linkedAsset,
                assetType: type == .auto ? "vehicle" : type == .boat ? "boat" : "other",
                sensitivityTier: "low"
            ),
        ]
    } else {
        []
    }

    return InsurancePolicyV2(
        schemaVersion: 2,
        id: policy.id,
        type: type,
        providerName: policy.provider,
        policyName: policy.name,
        status: "unknown",
        renewalDate: policy.renewalDate,
        premiumAmount: policy.premium,
        premiumCadence: legacyPremiumCadenceToV2(policy.frequency),
        source: "manual",
        storageScope: .cloud,
        sensitivityTier: .low,
        coverages: coverages,
        parties: [],
        assets: assets,
        details: InsuranceTypedDetails(type: type.rawValue),
        review: InsuranceReviewState(
            completeness: coverages.isEmpty ? "basic" : "partial",
            missingFields: []
        )
    )
}

private func legacyInsuranceTypeToV2(_ type: String) -> InsurancePolicyType {
    switch type {
    case "Auto": .auto
    case "Boat": .boat
    case "Dental": .dental
    case "Disability": .disability
    case "Health": .health
    case "Home": .homeowners
    case "Life": .life
    case "Other": .other
    case "Renters": .renters
    case "Umbrella": .umbrella
    case "Vision": .vision
    default: .other
    }
}

private func legacyPremiumCadenceToV2(_ frequency: String) -> String {
    switch frequency {
    case "Annual": "annual"
    case "Monthly": "monthly"
    case "Quarterly": "quarterly"
    case "Semiannual": "semiannual"
    default: "unknown"
    }
}
