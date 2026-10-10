import SwiftUI

struct CategoryIconPickerSheet: View {
    let selectedIconKey: String?
    let onSelect: (String?) -> Void

    @SwiftUI.Environment(\.dismiss) private var dismiss
    @State private var searchText = ""
    @FocusState private var isSearchFocused: Bool

    private var filteredGroups: [(group: String, icons: [CategoryIconOption])] {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        let icons: [CategoryIconOption]
        if trimmed.isEmpty {
            icons = CategoryIconCatalog.all
        } else {
            icons = CategoryIconCatalog.all.filter {
                $0.label.localizedCaseInsensitiveContains(trimmed)
                    || $0.key.localizedCaseInsensitiveContains(trimmed)
                    || $0.group.localizedCaseInsensitiveContains(trimmed)
            }
        }

        return CategoryIconCatalog.groups.compactMap { group in
            let groupIcons = icons.filter { $0.group == group }
            guard !groupIcons.isEmpty else { return nil }
            return (group: group, icons: groupIcons)
        }
    }

    private let columns = [
        GridItem(.adaptive(minimum: 52), spacing: MoatTheme.Spacing.small)
    ]

    var body: some View {
        MoatGlassSheet(title: "Choose icon") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                searchField

                if selectedIconKey != nil {
                    Button {
                        onSelect(nil)
                        dismiss()
                    } label: {
                        Label("Clear icon", systemImage: "xmark")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatSecondary)
                }

                if filteredGroups.isEmpty {
                    Text(searchText.isEmpty ? "No icons available" : "No matching icons")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                            ForEach(filteredGroups, id: \.group) { entry in
                                VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                                    Text(entry.group.uppercased())
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.secondary)

                                    LazyVGrid(columns: columns, spacing: MoatTheme.Spacing.small) {
                                        ForEach(entry.icons) { icon in
                                            iconButton(icon)
                                        }
                                    }
                                }
                            }
                        }
                        .padding(.bottom, MoatTheme.Spacing.xxxLarge)
                    }
                }
            }
        } footer: {
            MoatSheetActionBar {
                Button {
                    dismiss()
                } label: {
                    Text("Done").frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatSecondary)
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: MoatTheme.Spacing.small) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField("Search icons", text: $searchText)
                .focused($isSearchFocused)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        }
        .padding(.horizontal, MoatTheme.Spacing.medium)
        .padding(.vertical, MoatTheme.Spacing.small)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                .strokeBorder(MoatTheme.ColorToken.softBorder, lineWidth: 1)
        }
        .moatInputFocusRing(isFocused: isSearchFocused, cornerRadius: MoatTheme.Radius.medium)
    }

    private func iconButton(_ icon: CategoryIconOption) -> some View {
        let isSelected = selectedIconKey == icon.key
        return Button {
            onSelect(icon.key)
            dismiss()
        } label: {
            Image(systemName: icon.systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(isSelected ? MoatTheme.ColorToken.accent : MoatTheme.ColorToken.textSecondary)
                .frame(width: 44, height: 44)
                .background(
                    RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                        .fill(isSelected ? MoatTheme.ColorToken.accent.opacity(0.12) : MoatTheme.ColorToken.surface)
                )
                .overlay {
                    RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                        .strokeBorder(
                            isSelected ? MoatTheme.ColorToken.accent : MoatTheme.ColorToken.softBorder,
                            lineWidth: isSelected ? 2 : 1
                        )
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(icon.label)
    }
}

struct CategoryIconNameFields: View {
    @Binding var name: String
    let previewSystemImage: String
    let hasCustomIcon: Bool
    let onIconTap: () -> Void

    var body: some View {
        HStack(alignment: .bottom, spacing: MoatTheme.Spacing.medium) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                Text("Icon")
                    .font(.subheadline.weight(.semibold))

                Button(action: onIconTap) {
                    Image(systemName: previewSystemImage)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                        .frame(width: MoatTheme.Size.inputHeight, height: MoatTheme.Size.inputHeight)
                        .background(MoatTheme.ColorToken.mutedSurface)
                        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                                .strokeBorder(MoatTheme.ColorToken.softBorder, lineWidth: 1)
                        }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(hasCustomIcon ? "Change icon" : "Choose an icon")
            }

            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                Text("Name")
                    .font(.subheadline.weight(.semibold))
                MoatTextField(placeholder: "Name", text: $name)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
