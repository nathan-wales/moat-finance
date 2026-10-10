import Foundation
import SwiftUI

@MainActor
final class CategoriesViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var categories: [CategoryItem] = []
    @Published private(set) var actionMessage: CategoryActionMessage?
    @Published var searchText = ""

    private let service: CategoriesService

    init(service: CategoriesService = CategoriesService()) {
        self.service = service
    }

    var hasSearch: Bool {
        !normalizedQuery.isEmpty
    }

    var defaultCategories: [CategoryItem] {
        sortedForDisplay(searchMatches.filter { !$0.isUserOwned })
    }

    var customCategories: [CategoryItem] {
        sortedForDisplay(searchMatches.filter(\.isUserOwned))
    }

    func categories(for parent: CategoryParent) -> [CategoryItem] {
        sortedForDisplay(searchMatches.filter { $0.parentCategory == parent })
    }

    var ungroupedCategories: [CategoryItem] {
        sortedForDisplay(searchMatches.filter { $0.parentCategory == nil })
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false, showRefreshing: true)
    }

    func save(category: CategoryItem?, name: String, icon: String?, parentCategory: CategoryParent?) async throws {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { throw CategoryValidationError.emptyName }

        if let category {
            _ = try await service.update(
                id: category.id,
                name: trimmedName,
                icon: icon,
                parentCategory: category.canEditParent ? parentCategory : nil
            )
            actionMessage = CategoryActionMessage(title: "Category updated", message: trimmedName)
        } else {
            _ = try await service.create(name: trimmedName, icon: icon, parentCategory: parentCategory ?? .flexible)
            actionMessage = CategoryActionMessage(title: "Category created", message: trimmedName)
        }

        await refresh()
    }

    func delete(_ category: CategoryItem) async {
        do {
            try await service.delete(id: category.id)
            actionMessage = CategoryActionMessage(title: "Category deleted", message: category.name)
        } catch {
            actionMessage = CategoryActionMessage(
                title: "Could not delete category",
                message: error.localizedDescription,
                isError: true
            )
        }
        await refresh()
    }

    func toggleHidden(_ category: CategoryItem) async {
        do {
            try await service.toggleHidden(id: category.id, isHidden: !category.isHidden)
        } catch {
            actionMessage = CategoryActionMessage(
                title: "Could not update visibility",
                message: error.localizedDescription,
                isError: true
            )
        }
        await refresh()
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    private var normalizedQuery: String {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private var searchMatches: [CategoryItem] {
        let query = normalizedQuery
        guard !query.isEmpty else { return categories }
        return categories.filter { $0.name.lowercased().contains(query) }
    }

    private func sortedForDisplay(_ items: [CategoryItem]) -> [CategoryItem] {
        items.sorted { lhs, rhs in
            if lhs.isHidden != rhs.isHidden { return !lhs.isHidden }
            if lhs.sortOrder != rhs.sortOrder { return lhs.sortOrder < rhs.sortOrder }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    private func reload(showLoading: Bool, showRefreshing: Bool = true) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            categories = try await service.load()
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

enum CategoryValidationError: LocalizedError {
    case emptyName

    var errorDescription: String? {
        switch self {
        case .emptyName:
            return "Enter a category name."
        }
    }
}
