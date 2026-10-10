import Foundation

enum AiPromptTag: String, CaseIterable, Codable, Hashable, Identifiable {
    case tax
    case investing
    case budgeting
    case cashFlow = "cash-flow"
    case debt
    case realEstate = "real-estate"
    case insurance
    case goals
    case netWorth = "net-worth"
    case rules
    case hsa

    var id: String { rawValue }

    var displayTitle: String {
        switch self {
        case .cashFlow:
            return "Cash Flow"
        case .realEstate:
            return "Real Estate"
        case .netWorth:
            return "Net Worth"
        default:
            return rawValue.capitalized
        }
    }
}

enum AiPromptSurface: String, Codable, Hashable {
    case investmentsHsa = "investments.hsa"
    case cashFlowChart = "cash-flow.chart"
    case budgetingOverview = "budgeting.overview"
    case transactionsEmpty = "transactions.empty"
    case netWorthSummary = "net-worth.summary"
    case debtAccounts = "debt.accounts"
    case goalsEmpty = "goals.empty"
    case promptLibrary = "prompt-library"
}

struct AiPrompt: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let prompt: String
    let tags: [AiPromptTag]
    let surfaces: [AiPromptSurface]?
}

struct AiPromptContext {
    var currentDate: String?
    var accountCount: Int?
}

enum PromptTagFilter: Hashable, Equatable {
    case all
    case tag(AiPromptTag)
}

struct PromptActionMessage: Identifiable {
    let id = UUID()
    let title: String
    let message: String
}

enum PromptLibraryTab: String, CaseIterable, Identifiable {
    case curated
    case mine
    case community

    var id: String { rawValue }

    var title: String {
        switch self {
        case .curated: return "Curated by Moat"
        case .mine: return "My library"
        case .community: return "Community"
        }
    }

    var pinSource: PromptLibrarySource {
        switch self {
        case .curated: return .curated
        case .mine: return .mine
        case .community: return .community
        }
    }
}

enum PromptLibrarySource: String, Codable, Hashable {
    case curated = "CURATED"
    case mine = "MINE"
    case community = "COMMUNITY"
}

struct PromptPinSummary: Codable, Hashable, Identifiable {
    var id: String { "\(source.rawValue):\(promptId)" }
    let source: PromptLibrarySource
    let promptId: String
    let pinnedAt: String
}

struct TogglePromptPinRequest: Encodable {
    let source: PromptLibrarySource
    let promptId: String
}

struct TogglePromptPinResponse: Decodable {
    let pinned: Bool
}

struct PromptLaunchCountSummary: Codable, Hashable, Identifiable {
    var id: String { "\(source.rawValue):\(promptId)" }
    let source: PromptLibrarySource
    let promptId: String
    let launchCount: Int
}

struct RecordPromptLaunchRequest: Encodable {
    let source: PromptLibrarySource
    let promptId: String
}

struct RecordPromptLaunchResponse: Decodable {
    let launchCount: Int
    let counted: Bool
}

enum PromptVisibility: String, Codable {
    case `private` = "PRIVATE"
    case `public` = "PUBLIC"
}

enum PromptReviewStatus: String, Codable {
    case notSubmitted = "NOT_SUBMITTED"
    case pending = "PENDING"
    case changesRequested = "CHANGES_REQUESTED"
    case approved = "APPROVED"
    case rejected = "REJECTED"
}

struct PromptCategory: Codable, Identifiable, Hashable {
    let id: String
    let slug: String
    let label: String
    let sortOrder: Int
}

struct UserPromptSummary: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let description: String?
    let categorySlug: String?
    let categoryLabel: String?
    let tags: [String]
    let visibility: PromptVisibility
    let reviewStatus: PromptReviewStatus
    let createdAt: String
    let updatedAt: String
    let publishedAt: String?
    let hasDraftRevision: Bool
    var launchCount: Int
}

struct UserPromptDetail: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let description: String?
    let categorySlug: String?
    let categoryLabel: String?
    let tags: [String]
    let visibility: PromptVisibility
    let reviewStatus: PromptReviewStatus
    let createdAt: String
    let updatedAt: String
    let publishedAt: String?
    let hasDraftRevision: Bool
    let body: String
    let moderationFeedback: String?
    let rejectionReason: String?
    let submittedAt: String?
    let requiredConnections: [String]
    let requiredDataScopes: [String]
    let sourcePromptId: String?
    let sourceCommunityPromptId: String?
    var launchCount: Int
}

struct CommunityPromptSummary: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let description: String?
    let categorySlug: String?
    let categoryLabel: String?
    let tags: [String]
    let creatorDisplayName: String
    let publishedAt: String
    let updatedAt: String
    let requiredConnections: [String]
    let requiredDataScopes: [String]
    var launchCount: Int
}

struct CommunityPromptDetail: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let description: String?
    let categorySlug: String?
    let categoryLabel: String?
    let tags: [String]
    let creatorDisplayName: String
    let publishedAt: String
    let updatedAt: String
    let requiredConnections: [String]
    let requiredDataScopes: [String]
    let body: String
    var launchCount: Int
}

struct CreateUserPromptRequest: Encodable {
    let title: String
    let description: String?
    let body: String
    let categorySlug: String
    let tags: [String]
    let submitForReview: Bool?
}

struct UpdateUserPromptRequest: Encodable {
    let promptId: String
    let title: String
    let description: String?
    let body: String
    let categorySlug: String
    let tags: [String]
    let confirmWithdrawFromReview: Bool?
}

struct GeneratePromptDraftRequest: Encodable {
    let goal: String
    let financialData: String?
    let responseInclude: String?
}

struct GeneratePromptDraftResponse: Decodable {
    let title: String
    let description: String
    let body: String
    let suggestedCategorySlug: String
    let suggestedTags: [String]
}

struct PromptIdRequest: Encodable {
    let promptId: String
}

struct AiConnectionStatus: Decodable {
    let connected: Bool
}

extension PromptReviewStatus {
    var badgeLabel: String {
        switch self {
        case .pending: return "In review"
        case .changesRequested: return "Changes requested"
        case .rejected: return "Rejected"
        case .approved: return "Published"
        case .notSubmitted: return "Private"
        }
    }
}
