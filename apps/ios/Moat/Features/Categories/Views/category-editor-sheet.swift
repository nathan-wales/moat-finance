import SwiftUI

enum CategoryEditorMode: Identifiable {
    case create
    case edit(CategoryItem)

    var id: String {
        switch self {
        case .create:
            return "create-category"
        case .edit(let category):
            return category.id
        }
    }

    var category: CategoryItem? {
        if case .edit(let category) = self { return category }
        return nil
    }
}

struct CategoryEditorSheet: View {
    let mode: CategoryEditorMode
    let onSave: (String, String?, CategoryParent?) async throws -> Void

    @State private var name: String
    @State private var iconKey: String?
    @State private var parentCategory: CategoryParent
    @State private var isIconPickerPresented = false
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(mode: CategoryEditorMode, onSave: @escaping (String, String?, CategoryParent?) async throws -> Void) {
        self.mode = mode
        self.onSave = onSave
        _name = State(initialValue: mode.category?.name ?? "")
        _iconKey = State(initialValue: mode.category?.icon)
        _parentCategory = State(initialValue: mode.category?.parentCategory ?? .flexible)
    }

    private var previewSystemImage: String {
        CategoryIconCatalog.systemImage(forKey: iconKey)
            ?? CategoryItem.systemImage(forName: name.isEmpty ? "Category" : name)
    }

    var body: some View {
        MoatGlassSheet(title: mode.category == nil ? "New category" : "Edit category") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                CategoryIconNameFields(
                    name: $name,
                    previewSystemImage: previewSystemImage,
                    hasCustomIcon: iconKey != nil,
                    onIconTap: { isIconPickerPresented = true }
                )

                if mode.category?.canEditParent ?? true {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("Parent")
                            .font(.subheadline.weight(.semibold))
                        Picker("Parent", selection: $parentCategory) {
                            ForEach(CategoryParent.allCases) { parent in
                                Text(parent.title).tag(parent)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(MoatTheme.ColorToken.destructive)
                }
            }
        } footer: {
            Button {
                HapticFeedback.saveOrSubmit()
                Task { await performSave() }
            } label: {
                if isSaving {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Text("Save").frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.moatPrimary)
            .disabled(isSaving)
        }
        .sheet(isPresented: $isIconPickerPresented) {
            CategoryIconPickerSheet(selectedIconKey: iconKey) { selected in
                iconKey = selected
            }
        }
    }

    private func performSave() async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            try await onSave(name, iconKey, (mode.category?.canEditParent ?? true) ? parentCategory : nil)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
