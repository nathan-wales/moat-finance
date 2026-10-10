import SwiftUI

enum ProductFlags {
    /// Keep in sync with `TAXES_PRODUCT_ENABLED` in `packages/contracts`.
    /// TODO(taxes-restore): parked on purpose. Do not set true unless a human
    /// explicitly asks to restore Taxes. That constant has the restore
    /// checklist; the GCP Qwen3-8B VM + `TAX_LLM_EXTRACTION_ENABLED` are
    /// a separate, unfinished E2E path (`infra/tax-llm`).
    static let taxesEnabled = false
}

enum AppTab: String, CaseIterable, Identifiable {
    case home
    case profile
    case insights
    case transactions
    case more

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home:
            return "Overview"
        case .profile:
            return "Profile"
        case .insights:
            return "Insights"
        case .transactions:
            return "Transactions"
        case .more:
            return "More"
        }
    }

    var systemImage: String {
        switch self {
        case .home:
            return "house"
        case .profile:
            return "person.text.rectangle"
        case .insights:
            return "chart.bar.xaxis"
        case .transactions:
            return "list.bullet.rectangle.portrait"
        case .more:
            return "ellipsis"
        }
    }
}

enum AppDestination: String, CaseIterable, Identifiable, Hashable {
    case accounts
    case budget
    case transactions
    case rules
    case notifications
    case insights
    case categories
    case whatIf
    case investments
    case retirement
    case taxes
    case mileage
    case scenarios
    case demoMode
    case household
    case prompts
    case communityTips
    case aiAccess
    case accountSettings

    var id: String { rawValue }

    static var moreMenuDestinations: [AppDestination] {
        MoreMenuSection.allCases.flatMap(\.destinations)
    }

    var title: String {
        switch self {
        case .accounts:
            return "Accounts"
        case .budget:
            return "Budget"
        case .transactions:
            return "Transactions"
        case .rules:
            return "Rules"
        case .notifications:
            return "Notifications"
        case .insights:
            return "Insights"
        case .categories:
            return "Categories"
        case .whatIf:
            return "What If"
        case .investments:
            return "Investments"
        case .retirement:
            return "Retirement"
        case .taxes:
            return "Taxes"
        case .mileage:
            return "Mileage"
        case .scenarios:
            return "Scenarios"
        case .demoMode:
            return "Demo mode"
        case .household:
            return "Household"
        case .prompts:
            return "Prompts"
        case .communityTips:
            return "Community Tips"
        case .aiAccess:
            return "AI Access"
        case .accountSettings:
            return "Account settings"
        }
    }

    var systemImage: String {
        switch self {
        case .accounts:
            return "building.columns"
        case .budget:
            return "chart.pie"
        case .transactions:
            return "list.bullet.rectangle.portrait"
        case .rules:
            return "wand.and.stars"
        case .notifications:
            return "bell"
        case .insights:
            return "chart.bar.xaxis"
        case .categories:
            return "tag"
        case .whatIf:
            return "slider.horizontal.3"
        case .investments:
            return "chart.line.uptrend.xyaxis"
        case .retirement:
            return "banknote"
        case .taxes:
            return "receipt"
        case .mileage:
            return "car"
        case .scenarios:
            return "square.stack.3d.up"
        case .demoMode:
            return "play.fill"
        case .household:
            return "person.2"
        case .prompts:
            return "sparkles"
        case .communityTips:
            return "lightbulb"
        case .aiAccess:
            return "cable.connector"
        case .accountSettings:
            return "gearshape"
        }
    }
}

enum MoreMenuSection: String, CaseIterable, Identifiable {
    case aiAssistant
    case budget
    case wealthManagement
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .aiAssistant:
            return "AI Assistant"
        case .budget:
            return "Budget"
        case .wealthManagement:
            return "Wealth Management"
        case .settings:
            return "Settings"
        }
    }

    var destinations: [AppDestination] {
        switch self {
        case .aiAssistant:
            return [.prompts, .aiAccess]
        case .budget:
            return [.budget, .rules, .categories, .whatIf, .communityTips]
        case .wealthManagement:
            let destinations: [AppDestination] = [.investments, .retirement, .taxes, .mileage, .scenarios]
            if ProductFlags.taxesEnabled {
                return destinations
            }
            return destinations.filter { $0 != .taxes }
        case .settings:
            return [.demoMode, .household, .accountSettings, .notifications]
        }
    }
}
