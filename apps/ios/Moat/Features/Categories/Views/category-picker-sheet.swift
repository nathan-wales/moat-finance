import SwiftUI

struct CategoryPickerSheet: View {
    let selectedCategoryName: String?
    let onSelect: (String) -> Void

    @SwiftUI.Environment(\.dismiss) private var dismiss

    @State private var categories: [CategoryItem] = []
    @State private var searchText = ""
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var isCreatePresented = false
    @FocusState private var isSearchFocused: Bool

    private let service = CategoriesService()

    private var visibleCategories: [CategoryItem] {
        let nonHidden = categories.filter { !$0.isHidden }
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nonHidden }
        return nonHidden.filter { $0.name.localizedCaseInsensitiveContains(trimmed) }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                searchField
                    .padding(.horizontal, MoatTheme.Spacing.large)
                    .padding(.top, MoatTheme.Spacing.medium)
                    .padding(.bottom, MoatTheme.Spacing.small)

                Group {
                    if isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if let loadError {
                        VStack(spacing: MoatTheme.Spacing.medium) {
                            Text(loadError)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                            Button("Retry") {
                                Task { await loadCategories() }
                            }
                            .buttonStyle(.moatSecondary)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .padding(MoatTheme.Spacing.large)
                    } else {
                        categoryList
                    }
                }
            }
            .background(MoatTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle("Category")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .categoryPickerSheetCornerRadius(36)
        .sheet(isPresented: $isCreatePresented) {
            CategoryCreateSheet { name, icon in
                try await createCategory(named: name, icon: icon)
            }
        }
        .task {
            await loadCategories()
        }
    }

    private var searchField: some View {
        HStack(spacing: MoatTheme.Spacing.small) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)

            TextField("Search categories", text: $searchText)
                .textFieldStyle(.plain)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($isSearchFocused)

            if !searchText.isEmpty {
                Button {
                    searchText = ""
                } label: {
                    Image(systemName: "xmark")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, MoatTheme.Spacing.medium)
        .padding(.vertical, 10)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                .strokeBorder(MoatTheme.ColorToken.softBorder, lineWidth: 1)
        }
        .moatInputFocusRing(isFocused: isSearchFocused, cornerRadius: MoatTheme.Radius.medium)
    }

    private var categoryList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                Button {
                    isCreatePresented = true
                } label: {
                    CategoryPickerRow(
                        systemImage: "plus",
                        title: "Create new category",
                        isSelected: false
                    )
                }
                .buttonStyle(.plain)

                if visibleCategories.isEmpty {
                    Divider()
                        .padding(.horizontal, MoatTheme.Spacing.medium)

                    Text(searchText.isEmpty ? "No categories available" : "No matching categories")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(MoatTheme.Spacing.medium)
                } else {
                    ForEach(visibleCategories) { category in
                        Divider()
                            .padding(.horizontal, MoatTheme.Spacing.medium)

                        Button {
                            onSelect(category.name)
                            dismiss()
                        } label: {
                            CategoryPickerRow(
                                systemImage: category.systemImage,
                                title: category.name,
                                isSelected: category.name.caseInsensitiveCompare(selectedCategoryName ?? "") == .orderedSame
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .moatCard()
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.small)
            .padding(.bottom, MoatTheme.Spacing.xxxLarge)
        }
    }

    private func loadCategories() async {
        isLoading = true
        loadError = nil
        defer { isLoading = false }

        do {
            categories = try await service.load().sorted {
                $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
            }
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func createCategory(named name: String, icon: String?) async throws {
        let created = try await service.create(name: name, icon: icon)
        categories.insert(created, at: 0)
        categories.sort {
            $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
        isCreatePresented = false
        onSelect(created.name)
        dismiss()
    }
}

private struct CategoryPickerRow: View {
    let systemImage: String
    let title: String
    let isSelected: Bool

    var body: some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            Image(systemName: systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .frame(width: 28, height: 28)

            Text(title)
                .font(.body.weight(.medium))
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)

            if isSelected {
                Image(systemName: "checkmark")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(MoatTheme.ColorToken.accent)
            }
        }
        .padding(.horizontal, MoatTheme.Spacing.medium)
        .padding(.vertical, MoatTheme.Spacing.large)
        .contentShape(Rectangle())
    }
}

private struct CategoryCreateSheet: View {
    let onCreate: (String, String?) async throws -> Void

    @SwiftUI.Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var iconKey: String?
    @State private var isIconPickerPresented = false
    @State private var isWorking = false
    @State private var errorMessage: String?

    private var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var previewSystemImage: String {
        CategoryIconCatalog.systemImage(forKey: iconKey)
            ?? CategoryItem.systemImage(forName: name.isEmpty ? "Category" : name)
    }

    var body: some View {
        MoatGlassSheet(title: "New category") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                CategoryIconNameFields(
                    name: $name,
                    previewSystemImage: previewSystemImage,
                    hasCustomIcon: iconKey != nil,
                    onIconTap: { isIconPickerPresented = true }
                )

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(MoatTheme.ColorToken.destructive)
                }
            }
        } footer: {
            MoatSheetActionBar {
                Button {
                    dismiss()
                } label: {
                    Text("Cancel").frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatSecondary)
                .disabled(isWorking)

                Button {
                    Task { await performCreate() }
                } label: {
                    if isWorking {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Label("Save", systemImage: "checkmark").frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.moatPrimary)
                .disabled(isWorking || trimmedName.isEmpty)
            }
        }
        .sheet(isPresented: $isIconPickerPresented) {
            CategoryIconPickerSheet(selectedIconKey: iconKey) { selected in
                iconKey = selected
            }
        }
    }

    private func performCreate() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onCreate(trimmedName, iconKey)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private extension View {
    @ViewBuilder
    func categoryPickerSheetCornerRadius(_ radius: CGFloat) -> some View {
        if #available(iOS 16.4, *) {
            presentationCornerRadius(radius)
        } else {
            self
        }
    }
}
