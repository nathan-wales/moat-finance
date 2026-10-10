import Foundation

actor BudgetService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func loadPageData() async throws -> BudgetPageData {
        try await apiClient.get(path: "/api/v1/budget/getPageData")
    }

    func loadCategoryDetail(categoryId: String) async throws -> CategoryBudgetDetail {
        try await apiClient.post(
            path: "/api/v1/budget/getCategoryDetail",
            body: .object(["categoryId": .string(categoryId)])
        )
    }

    func saveCategoryBudget(categoryId: String, monthlyGoal: Double) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/budget/upsertCategoryBudget",
            body: .object([
                "categoryId": .string(categoryId),
                "monthlyGoal": .number(monthlyGoal)
            ])
        )
    }

    func deleteCategoryBudget(categoryId: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/budget/deleteCategoryBudget",
            body: .object(["categoryId": .string(categoryId)])
        )
    }
}
