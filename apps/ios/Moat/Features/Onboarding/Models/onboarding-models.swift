import Foundation

enum OnboardingStep: Int, CaseIterable, Identifiable {
    case goals = 1
    case profile = 2
    case referral = 3
    case finish = 4

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .goals: "What are you here for?"
        case .profile: "Connect your accounts"
        case .referral: "Where did you hear about us?"
        case .finish: "Ready to start"
        }
    }

    var subtitle: String {
        switch self {
        case .goals: "Select every goal that fits your financial life."
        case .profile: "Import transactions and keep your balances in sync."
        case .referral: "This helps us understand how people find Moat."
        case .finish: "Your setup is saved and your dashboard is ready."
        }
    }
}

struct OnboardingGoalOption: Identifiable, Equatable {
    let id: String
    let label: String
    let systemImage: String

    static let all: [OnboardingGoalOption] = [
        OnboardingGoalOption(id: "budgeting", label: "Budgeting & spending", systemImage: "wallet.pass.fill"),
        OnboardingGoalOption(id: "wealth", label: "Growing wealth", systemImage: "chart.line.uptrend.xyaxis"),
        OnboardingGoalOption(id: "retirement", label: "Retirement planning", systemImage: "calendar"),
        OnboardingGoalOption(id: "subscriptions", label: "Track subscriptions", systemImage: "receipt.fill"),
        OnboardingGoalOption(id: "fraud", label: "Catch unwanted charges", systemImage: "shield.fill"),
        OnboardingGoalOption(id: "taxes", label: "Make taxes easier", systemImage: "banknote.fill"),
        OnboardingGoalOption(id: "real-estate", label: "Real estate / rentals", systemImage: "house.fill"),
        OnboardingGoalOption(id: "clarity", label: "General financial clarity", systemImage: "lightbulb.fill")
    ]
}

struct OnboardingReferralSource: Identifiable, Equatable {
    let id: String
    let label: String

    static let all: [OnboardingReferralSource] = [
        OnboardingReferralSource(id: "friend", label: "Friend"),
        OnboardingReferralSource(id: "twitter", label: "Twitter / X"),
        OnboardingReferralSource(id: "reddit", label: "Reddit"),
        OnboardingReferralSource(id: "product-hunt", label: "Product Hunt"),
        OnboardingReferralSource(id: "google", label: "Google"),
        OnboardingReferralSource(id: "other", label: "Other")
    ]
}

struct OnboardingData: Decodable, Equatable {
    let hasCompletedInitialOnboarding: Bool
    let goals: [String]
    let currentAge: Int?
    let retirementAge: Int?
    let referralSource: String?
    let referralSourceOther: String?
}

struct OnboardingSuccessResponse: Decodable, Equatable {
    let success: Bool
}

struct OnboardingConnectedInstitution: Identifiable, Equatable {
    let id: String
    let institutionName: String
    let accountCount: Int
}