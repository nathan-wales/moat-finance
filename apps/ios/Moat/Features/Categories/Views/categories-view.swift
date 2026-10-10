import SwiftUI

struct CategoriesView: View {
    @StateObject private var viewModel = CategoriesViewModel()
    @State private var editorMode: CategoryEditorMode?
    @State private var pendingDeletion: CategoryItem?
    @AppStorage(CategoryViewStorageKey.categoriesList) private var listViewRaw = CategoryViewMode.category.rawValue

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading categories...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Categories")
        .searchable(text: $viewModel.searchText, prompt: "Search categories")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    editorMode = .create
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("New category")
            }
        }
        .sheet(item: $editorMode) { mode in
            CategoryEditorSheet(mode: mode) { name, icon, parent in
                try await viewModel.save(category: mode.category, name: name, icon: icon, parentCategory: parent)
                editorMode = nil
            }
        }
        .confirmationDialog(
            "Delete \(pendingDeletion?.name ?? "category")?",
            isPresented: deleteConfirmationBinding,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                guard let category = pendingDeletion else { return }
                pendingDeletion = nil
                Task { await viewModel.delete(category) }
            }
            Button("Cancel", role: .cancel) { pendingDeletion = nil }
        } message: {
            if pendingDeletion?.isDefault == true {
                Text("This default category will be removed from your list. Existing transactions keep this category and can be restored later.")
            } else {
                Text("Transactions in this category will move to Uncategorized.")
            }
        }
        .sheet(item: actionMessageBinding) { message in
            actionMessageSheet(message)
        }
        .task {
            await viewModel.load()
        }
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(spacing: MoatTheme.Spacing.large) {
                HStack {
                    Spacer()
                    CategoryViewPicker(selection: $listViewRaw)
                }
                sections
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.large)
            .padding(.bottom, 112)
        }
        .moatPageBackground()
        .refreshable { await viewModel.refresh() }
    }

    @ViewBuilder
    private var sections: some View {
        if viewModel.defaultCategories.isEmpty && viewModel.customCategories.isEmpty {
            emptyState
        } else if listViewRaw == CategoryViewMode.parent.rawValue {
            ForEach(CategoryParent.allCases) { parent in
                CategorySectionCard(
                    title: parent.title,
                    description: "Spend categories in the \(parent.title) bucket.",
                    categories: viewModel.categories(for: parent),
                    onEdit: { editorMode = .edit($0) },
                    onDelete: { pendingDeletion = $0 },
                    onToggleHidden: { category in Task { await viewModel.toggleHidden(category) } }
                )
            }
            CategorySectionCard(
                title: "Ungrouped",
                description: "Income, transfer, and investment categories are not part of a spend parent.",
                categories: viewModel.ungroupedCategories,
                emptyMessage: "No ungrouped categories.",
                onEdit: { editorMode = .edit($0) },
                onDelete: { pendingDeletion = $0 },
                onToggleHidden: { category in Task { await viewModel.toggleHidden(category) } }
            )
        } else {
            if !viewModel.defaultCategories.isEmpty {
                CategorySectionCard(
                    title: "Default Categories",
                    description: "Moat's built-in categories. Rename, change the icon, or hide them — your changes stay on this account.",
                    categories: viewModel.defaultCategories,
                    onEdit: { editorMode = .edit($0) },
                    onDelete: { pendingDeletion = $0 },
                    onToggleHidden: { category in Task { await viewModel.toggleHidden(category) } }
                )
            }

            if !viewModel.customCategories.isEmpty || !viewModel.hasSearch {
                CategorySectionCard(
                    title: "Custom Categories",
                    description: "Categories you created for local classification.",
                    categories: viewModel.customCategories,
                    emptyMessage: "No custom categories yet.",
                    onEdit: { editorMode = .edit($0) },
                    onDelete: { pendingDeletion = $0 },
                    onToggleHidden: { category in Task { await viewModel.toggleHidden(category) } }
                )
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: MoatTheme.Spacing.medium) {
            Image(systemName: viewModel.hasSearch ? "magnifyingglass" : "tag")
                .font(.system(size: 40))
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            Text(viewModel.hasSearch ? "No categories match your search" : "No categories yet")
                .font(.headline)
            if !viewModel.hasSearch {
                Button {
                    editorMode = .create
                } label: {
                    Text("New category")
                }
                .buttonStyle(.moatPrimarySmall)
                .frame(maxWidth: 220)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, MoatTheme.Spacing.xxLarge)
    }

    private func actionMessageSheet(_ message: CategoryActionMessage) -> some View {
        MoatActionResultSheet(
            title: message.title,
            message: message.message,
            isFailure: message.isError
        ) {
            viewModel.clearActionMessage()
        }
    }

    private var deleteConfirmationBinding: Binding<Bool> {
        Binding(
            get: { pendingDeletion != nil },
            set: { isPresented in
                if !isPresented { pendingDeletion = nil }
            }
        )
    }

    private var actionMessageBinding: Binding<CategoryActionMessage?> {
        Binding(
            get: { viewModel.actionMessage },
            set: { value in
                if value == nil { viewModel.clearActionMessage() }
            }
        )
    }
}

#Preview {
    NavigationStack {
        CategoriesView()
    }
}
