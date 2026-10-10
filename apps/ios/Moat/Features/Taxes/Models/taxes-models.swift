import Foundation

enum TaxesTab: String, CaseIterable, Identifiable {
    case overview
    case documents
    case details

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview: return "Overview"
        case .documents: return "Documents"
        case .details: return "Tax Details"
        }
    }
}

struct TaxYearsResponse: Decodable, Equatable {
    let defaultYear: Int
    let years: [TaxYearSummary]
}

struct TaxYearSummary: Decodable, Equatable, Identifiable {
    var id: Int { taxYear }
    let taxYear: Int
    let hasDocuments: Bool
    let hasFacts: Bool
    let documentCount: Int
    let factCount: Int
}

struct TaxEstimate: Decodable, Equatable {
    let direction: String
    let amount: Double?
    let label: String
    let confidence: String
}

struct TaxReadiness: Decodable, Equatable {
    let taxYear: Int
    let score: Double
    let formula: String
    let categories: [TaxReadinessCategory]
    let missingItems: [TaxReadinessItem]
    let unresolvedItems: [TaxReadinessItem]
    let reviewItems: [TaxReadinessItem]
}

struct TaxReadinessCategory: Decodable, Equatable, Identifiable {
    let id: String
    let label: String
    let relevant: Bool
    let complete: Bool
    let relevanceReason: String
    let withheldReason: String?
}

struct TaxReadinessItem: Decodable, Equatable, Identifiable {
    let id: String
    let categoryId: String
    let severity: String
    let title: String
    let detail: String
    let reason: String
}

struct TaxAttentionItem: Decodable, Equatable, Identifiable {
    let id: String
    let title: String
    let detail: String
    let severity: String
}

struct TaxDocument: Decodable, Equatable, Identifiable {
    let id: String
    let taxYear: Int
    let documentCategory: String
    let formType: String?
    let issuer: String?
    let processingState: String
    let reviewStatus: String
    let factCount: Int
    let uploadedAt: String
    let failureReason: String?
}

struct TaxFact: Decodable, Equatable, Identifiable {
    let id: String
    let taxYear: Int
    let category: String
    let type: String
    let key: String
    let status: String
    let userConfirmed: Bool
    let sourceType: String
    let sourceForm: String?
    let sourceBox: String?
    let sourceDocumentId: String?
    let currency: String?
    let value: TaxFactValue
}

enum TaxFactValue: Decodable, Equatable {
    case number(Double)
    case string(String)
    case unknown

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let number = try? container.decode(Double.self) {
            self = .number(number)
            return
        }
        if let string = try? container.decode(String.self) {
            self = .string(string)
            return
        }
        self = .unknown
    }

    var money: Double? {
        if case .number(let value) = self { return value }
        return nil
    }

    var display: String {
        switch self {
        case .number(let value):
            return CurrencyFormatter.formatCompact(value)
        case .string(let value):
            return value
        case .unknown:
            return "—"
        }
    }
}

struct TaxOverview: Decodable, Equatable {
    let taxYear: Int
    let lastUpdated: String?
    let readiness: TaxReadiness
    let documentsPresent: Int
    let documentsExpected: Int
    let incomeIdentified: Double
    let taxesWithheld: Double
    let potentialDeductions: Double
    let confirmedDeductions: Double
    let capitalGains: Double
    let estimate: TaxEstimate
    let attention: [TaxAttentionItem]
    let recentDocuments: [TaxDocument]
    let hasAnyFacts: Bool
    let hasAnyDocuments: Bool
}

struct TaxDocumentDetail: Decodable, Equatable, Identifiable {
    let id: String
    let taxYear: Int
    let documentCategory: String
    let formType: String?
    let issuer: String?
    let processingState: String
    let reviewStatus: String
    let factCount: Int
    let uploadedAt: String
    let failureReason: String?
    let facts: [TaxFact]
}

struct TaxYearInput: Encodable {
    let taxYear: Int
}

struct TaxIdInput: Encodable {
    let id: String
}

struct TaxConfirmFactInput: Encodable {
    let id: String
    let confirmed: Bool
}
