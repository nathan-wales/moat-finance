import Foundation

@MainActor
final class BudgetViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var pageData: BudgetPageData?
    @Published var editingCategory: BudgetEditingCategory?
    @Published private(set) var selectedDetail: CategoryBudgetDetail?
    @Published private(set) var isDetailLoading = false
    @Published private(set) var detailError: Error?

    private let service: BudgetService

    init(service: BudgetService = BudgetService()) {
        self.service = service
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false, showRefreshing: true)
    }

    func beginEditing(_ category: CategoryBudgetRow) {
        editingCategory = BudgetEditingCategory(
            categoryId: category.categoryId,
            categoryName: category.categoryName,
            monthlyGoal: category.monthlyGoal
        )
        selectedDetail = nil
        detailError = nil
        isDetailLoading = true
    }

    func loadDetailIfNeeded() async {
        guard let editingCategory else { return }

        if selectedDetail?.categoryId == editingCategory.categoryId {
            isDetailLoading = false
            return
        }

        isDetailLoading = true
        detailError = nil

        do {
            selectedDetail = try await service.loadCategoryDetail(categoryId: editingCategory.categoryId)
            isDetailLoading = false
        } catch {
            if error.isCancellation {
                isDetailLoading = false
                return
            }
            detailError = error
            isDetailLoading = false
        }
    }

    func clearEditing() {
        editingCategory = nil
        selectedDetail = nil
        detailError = nil
        isDetailLoading = false
    }

    func saveBudget(monthlyGoal: Double) async throws {
        guard let editingCategory else { return }
        try await service.saveCategoryBudget(
            categoryId: editingCategory.categoryId,
            monthlyGoal: monthlyGoal
        )
        MoatDataRefresh.notifySetupGuideChanged()
        clearEditing()
        await refresh()
    }

    private func reload(showLoading: Bool, showRefreshing: Bool = true) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            pageData = try await service.loadPageData()
            state = .loaded
        } catch {
            if error.isCancellation {
                if case .refreshing = state {
                    state = .loaded
                }
                return
            }
            state = .error(error)
        }
    }
}
