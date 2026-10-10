import SwiftUI

/// The trailing remove control for an inline rule sentence. It sits outside the
/// wrapping flow so deleting a row never widens the sentence tokens.
struct InlineRuleRemoveButton: View {
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(.caption.weight(.semibold))
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .frame(width: 28, height: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }
}
