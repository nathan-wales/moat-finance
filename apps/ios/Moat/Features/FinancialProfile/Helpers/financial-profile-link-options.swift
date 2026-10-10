import Foundation

private let autoTerms = ["auto", "car", "truck", "suv", "van", "vehicle"]
private let boatTerms = ["boat", "marine", "watercraft"]
private let homeTerms = ["home", "house", "mortgage", "property", "real estate"]

func filterLiabilitiesForAssetType(
    _ liabilities: [ProfileLiability],
    assetType: String
) -> [ProfileLiability] {
    liabilities.filter { liability in
        matchesAssetDomain(
            assetType: assetType,
            candidateText: searchableText(liability.name, liability.type)
        )
    }
}

func filterPoliciesForAssetType(
    _ policies: [InsurancePolicy],
    assetType: String
) -> [InsurancePolicy] {
    policies.filter { policy in
        matchesAssetDomain(
            assetType: assetType,
            candidateText: searchableText(policy.displayName, policy.typeLabel)
        )
    }
}

func filterAssetsForLiabilityType(
    _ assets: [ProfileAsset],
    liabilityType: String
) -> [ProfileAsset] {
    assets.filter { asset in
        matchesAssetDomain(assetType: asset.type, candidateText: searchableText(liabilityType))
    }
}

func filterAssetsForInsuranceType(
    _ assets: [ProfileAsset],
    insuranceType: String
) -> [ProfileAsset] {
    assets.filter { asset in
        matchesAssetDomain(
            assetType: asset.type,
            candidateText: searchableText(insuranceType, asset.name)
        )
    }
}

private func matchesAssetDomain(assetType: String, candidateText: String) -> Bool {
    if assetType == "Real estate" {
        return containsAny(candidateText, homeTerms)
    }
    if assetType == "Boat" {
        return containsAny(candidateText, boatTerms)
    }
    if assetType == "Vehicle" {
        return containsAny(candidateText, autoTerms) && !containsAny(candidateText, boatTerms)
    }
    if assetType == "Business" {
        return candidateText.contains("business")
    }
    if assetType == "Personal property" {
        return candidateText.contains("personal") || candidateText.contains("property")
    }
    return false
}

private func containsAny(_ value: String, _ terms: [String]) -> Bool {
    terms.contains { value.contains($0) }
}

func suggestedLiabilityType(forAssetType assetType: String) -> String {
    switch assetType {
    case "Real estate": "Mortgage"
    case "Vehicle": "Auto loan"
    case "Boat": "Other"
    default: "Other"
    }
}

func suggestedInsurancePolicyType(forAssetType assetType: String) -> InsurancePolicyType {
    switch assetType {
    case "Real estate": .homeowners
    case "Vehicle": .auto
    case "Boat": .boat
    default: .other
    }
}

private func searchableText(_ parts: String?...) -> String {
    parts
        .compactMap { part in
            guard let part, !part.isEmpty else { return nil }
            return part
        }
        .joined(separator: " ")
        .lowercased()
}
