import SwiftUI
import UIKit

enum MoatKeyboard {
    /// Resigns first responder so any focused text field dismisses its keyboard.
    static func dismiss() {
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder),
            to: nil,
            from: nil,
            for: nil
        )
    }
}

/// Keyboard accessory with a chevron button that lowers/dismisses the keyboard.
/// Prefer this anywhere a `.numberPad` / `.decimalPad` (or similar) is shown, since
/// those keyboards have no built-in return/done key.
///
/// Optional `suggestions` render as a horizontally scrolling chip row to the left of
/// the dismiss control (used by the rule editor hashtag field).
struct MoatKeyboardDismissToolbar: ToolbarContent {
    var suggestions: [String] = []
    var onSelectSuggestion: ((String) -> Void)?

    var body: some ToolbarContent {
        ToolbarItemGroup(placement: .keyboard) {
            if !suggestions.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: MoatTheme.Spacing.small) {
                        ForEach(suggestions, id: \.self) { suggestion in
                            Button {
                                onSelectSuggestion?(suggestion)
                            } label: {
                                Text(suggestion)
                                    .font(.subheadline)
                            }
                            .buttonStyle(.bordered)
                            .buttonBorderShape(.capsule)
                            .accessibilityLabel("Use hashtag \(suggestion)")
                        }
                    }
                }
            }

            Spacer()

            Button(action: MoatKeyboard.dismiss) {
                Image(systemName: "keyboard.chevron.compact.down")
            }
            .accessibilityLabel("Dismiss keyboard")
        }
    }
}

extension View {
    /// Adds the shared keyboard dismiss accessory toolbar.
    /// Safe to apply on screens that may show non-numeric keyboards — the accessory
    /// only appears while the keyboard is visible.
    func moatKeyboardDismissToolbar() -> some View {
        toolbar {
            MoatKeyboardDismissToolbar()
        }
    }
}
