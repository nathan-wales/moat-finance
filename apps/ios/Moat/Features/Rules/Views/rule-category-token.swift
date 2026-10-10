import SwiftUI

/// Category selection as an inline sentence token, backed by the same category
/// picker sheet the rest of the app uses.
struct RuleCategoryToken: View {
    let accessibilityLabel: String
    @Binding var name: String
    var onCommit: () -> Void = {}

    var body: some View {
        InlineRuleSheetToken(
            accessibilityLabel: accessibilityLabel,
            title: name.isEmpty ? "Select category" : name,
            isPlaceholder: name.isEmpty
        ) { dismiss in
            CategoryPickerSheet(selectedCategoryName: name.isEmpty ? nil : name) { selected in
                name = selected
                onCommit()
                dismiss()
            }
        }
    }
}
