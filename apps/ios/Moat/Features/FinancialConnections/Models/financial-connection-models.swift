import Foundation

enum FinancialDataProvider: String, Codable, CaseIterable {
    case plaid = "PLAID"
    case mx = "MX"
    case finicity = "FINICITY"

    var displayName: String {
        switch self {
        case .plaid: "Plaid"
        case .mx: "MX"
        case .finicity: "Finicity"
        }
    }
}

struct InstitutionSearchResult: Decodable, Identifiable, Equatable {
    let canonicalInstitutionId: String
    let displayName: String
    let legalName: String?
    let aliases: [String]
    let logoUrl: String?
    let website: String?
    let recommendedProvider: FinancialDataProvider
    let availableProviders: [FinancialDataProvider]
    let recommendationReason: String?
    let confidence: String

    var id: String { canonicalInstitutionId }

    var logoDomain: String? {
        guard let website, !website.isEmpty else { return nil }
        return InstitutionLogoURL.normalizeDomain(website)
    }
}

struct FinancialConnectionRouting: Decodable, Equatable {
    let provider: FinancialDataProvider
    let reason: String
    let confidence: String
    let availableProviders: [FinancialDataProvider]
}

enum FinancialConnectionLinkSession: Equatable {
    case plaid(linkToken: String, expiration: String?, routing: FinancialConnectionRouting)
    case mx(connectWidgetUrl: URL, memberGuid: String?, routing: FinancialConnectionRouting)
    case finicity(connectUrl: URL, customerId: String?, routing: FinancialConnectionRouting)

    var provider: FinancialDataProvider {
        switch self {
        case .plaid: .plaid
        case .mx: .mx
        case .finicity: .finicity
        }
    }

    var routing: FinancialConnectionRouting {
        switch self {
        case .plaid(_, _, let routing),
             .mx(_, _, let routing),
             .finicity(_, _, let routing):
            routing
        }
    }
}

extension FinancialConnectionLinkSession: Decodable {
    private enum CodingKeys: String, CodingKey {
        case provider
        case linkToken
        case expiration
        case connectWidgetUrl
        case connectUrl
        case memberGuid
        case customerId
        case routing
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let provider = try container.decode(FinancialDataProvider.self, forKey: .provider)
        let routing = try container.decode(FinancialConnectionRouting.self, forKey: .routing)

        switch provider {
        case .plaid:
            let linkToken = try container.decode(String.self, forKey: .linkToken)
            let expiration = try container.decodeIfPresent(String.self, forKey: .expiration)
            self = .plaid(linkToken: linkToken, expiration: expiration, routing: routing)
        case .mx:
            let urlString = try container.decode(String.self, forKey: .connectWidgetUrl)
            guard let url = URL(string: urlString) else {
                throw DecodingError.dataCorruptedError(
                    forKey: .connectWidgetUrl,
                    in: container,
                    debugDescription: "Invalid MX connect widget URL"
                )
            }
            let memberGuid = try container.decodeIfPresent(String.self, forKey: .memberGuid)
            self = .mx(connectWidgetUrl: url, memberGuid: memberGuid, routing: routing)
        case .finicity:
            let urlString = try container.decode(String.self, forKey: .connectUrl)
            guard let url = URL(string: urlString) else {
                throw DecodingError.dataCorruptedError(
                    forKey: .connectUrl,
                    in: container,
                    debugDescription: "Invalid Finicity connect URL"
                )
            }
            let customerId = try container.decodeIfPresent(String.self, forKey: .customerId)
            self = .finicity(connectUrl: url, customerId: customerId, routing: routing)
        }
    }
}

struct CreateLinkSessionRequest: Encodable {
    let canonicalInstitutionId: String
    let products: [String]
    let provider: FinancialDataProvider?

    init(
        canonicalInstitutionId: String,
        products: [String] = ["transactions"],
        provider: FinancialDataProvider? = nil
    ) {
        self.canonicalInstitutionId = canonicalInstitutionId
        self.products = products
        self.provider = provider
    }
}

enum ProviderLaunchOutcome: Equatable {
    case plaidConnected(institutionName: String, accountCount: Int, plaidItemDbId: String)
    case externalConnectOpened(provider: FinancialDataProvider, url: URL)
}
