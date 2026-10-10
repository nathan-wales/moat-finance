import SwiftUI

struct HashtagPickerSheet: View {
    @Binding var selectedNames: [String]
    let allHashtags: [HashtagSummary]

    @SwiftUI.Environment(\.dismiss) private var dismiss
    @State private var searchText = ""
    @FocusState private var isSearchFocused: Bool

    private var query: String {
        searchText
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
    }

    private var listedNames: [String] {
        let selectedLower = Set(selectedNames.map { $0.lowercased() })
        let available = allHashtags
            .map(\.name)
            .filter { !selectedLower.contains($0.lowercased()) }
        let combined = selectedNames + available
        let trimmed = query
        guard !trimmed.isEmpty else { return combined }
        return combined.filter { $0.localizedCaseInsensitiveContains(trimmed) }
    }

    private var canCreateQuery: Bool {
        let trimmed = query
        guard !trimmed.isEmpty else { return false }
        let alreadySelected = selectedNames.contains { $0.caseInsensitiveCompare(trimmed) == .orderedSame }
        let alreadyExists = allHashtags.contains { $0.name.caseInsensitiveCompare(trimmed) == .orderedSame }
        return !alreadySelected && !alreadyExists
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                searchField
                    .padding(.horizontal, MoatTheme.Spacing.large)
                    .padding(.top, MoatTheme.Spacing.medium)
                    .padding(.bottom, MoatTheme.Spacing.small)

                if listedNames.isEmpty && !canCreateQuery {
                    Text(query.isEmpty ? "No hashtags yet" : "No matching hashtags")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                        .padding(MoatTheme.Spacing.large)
                } else {
                    hashtagList
                }
            }
            .background(MoatTheme.ColorToken.appBackground.ignoresSafeArea())
            .navigationTitle("Hashtags")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
                MoatKeyboardDismissToolbar()
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .hashtagPickerSheetCornerRadius(36)
    }

    private var searchField: some View {
        HStack(spacing: MoatTheme.Spacing.small) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)

            TextField("Add tags", text: $searchText)
                .textFieldStyle(.plain)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($isSearchFocused)
                .onSubmit { createFromQueryIfNeeded() }

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

    private var hashtagList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if canCreateQuery {
                    Button {
                        addTag(query)
                    } label: {
                        HashtagPickerRow(
                            title: "Create \"#\(query)\"",
                            isSelected: false,
                            systemImage: "plus"
                        )
                    }
                    .buttonStyle(.plain)

                    if !listedNames.isEmpty {
                        Divider()
                            .padding(.horizontal, MoatTheme.Spacing.medium)
                    }
                }

                ForEach(Array(listedNames.enumerated()), id: \.element) { index, name in
                    if index > 0 || canCreateQuery {
                        Divider()
                            .padding(.horizontal, MoatTheme.Spacing.medium)
                    }

                    Button {
                        toggleTag(name)
                    } label: {
                        HashtagPickerRow(
                            title: "#\(name)",
                            isSelected: isSelected(name)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .moatCard()
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.small)
            .padding(.bottom, MoatTheme.Spacing.xxxLarge)
        }
    }

    private func isSelected(_ name: String) -> Bool {
        selectedNames.contains { $0.caseInsensitiveCompare(name) == .orderedSame }
    }

    private func toggleTag(_ name: String) {
        if let existing = selectedNames.first(where: { $0.caseInsensitiveCompare(name) == .orderedSame }) {
            selectedNames.removeAll { $0.caseInsensitiveCompare(existing) == .orderedSame }
            return
        }
        addTag(name)
    }

    private func addTag(_ name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard !isSelected(trimmed) else { return }
        selectedNames.append(trimmed)
        searchText = ""
    }

    private func createFromQueryIfNeeded() {
        guard canCreateQuery else { return }
        addTag(query)
    }
}

private struct HashtagPickerRow: View {
    let title: String
    let isSelected: Bool
    var systemImage: String? = nil

    var body: some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .frame(width: 28, height: 28)
            }

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

private extension View {
    @ViewBuilder
    func hashtagPickerSheetCornerRadius(_ radius: CGFloat) -> some View {
        if #available(iOS 16.4, *) {
            presentationCornerRadius(radius)
        } else {
            self
        }
    }
}
