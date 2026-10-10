import Foundation

@MainActor
final class AppNavigationCoordinator: ObservableObject {
    static let shared = AppNavigationCoordinator()

    @Published var selectedTab: AppTab = .home
    @Published var morePendingDestination: AppDestination?
    @Published var communityTipsPendingSearch: String?
    @Published var transactionsPendingReview: SetupGuideTransactionReview?

    func openTaxes() {
        openDestination(.taxes)
    }

    func openMileage() {
        openDestination(.mileage)
    }

    func openFinancialProfile() {
        selectedTab = .profile
    }

    func openAIAccess() {
        openDestination(.aiAccess)
    }

    func openCommunityTips(search: String? = nil) {
        selectedTab = .more
        communityTipsPendingSearch = search
        morePendingDestination = .communityTips
    }

    func openDestination(_ destination: AppDestination) {
        selectedTab = .more
        morePendingDestination = destination
    }

    func openLargestExpenses() {
        selectedTab = .transactions
        transactionsPendingReview = .expenses
    }

    func openLargestIncome() {
        selectedTab = .transactions
        transactionsPendingReview = .income
    }
}
