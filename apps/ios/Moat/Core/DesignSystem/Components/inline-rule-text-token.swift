import SwiftUI

/// A freeform value inside a rule sentence: inline text with a dotted underline
/// and no chevron. A mirrored `Text` sizes the token, draws the empty-state
/// placeholder, and shares a pinned first-text baseline with picker tokens.
struct InlineRuleTextToken: View {
    let accessibilityLabel: String
    let placeholder: String
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default
    var autocapitalization: TextInputAutocapitalization = .sentences
    var autocorrectionDisabled = false
    var formatsGroupedNumber = false
    var fractionDigits = 0
    var onCommit: (() -> Void)?
    var onFocusChange: ((Bool) -> Void)?

    @FocusState private var isFocused: Bool

    private var displayText: String { text.isEmpty ? placeholder : text }

    private var underlineColor: Color {
        isFocused ? MoatTheme.ColorToken.accent : MoatTheme.ColorToken.textTertiary
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Visible when empty so the placeholder shares Text baseline with
            // neighboring tokens; TextField prompts sit low in vertical fields.
            Text(displayText)
                .font(InlineRuleTokenMetrics.font)
                .foregroundStyle(text.isEmpty ? MoatTheme.ColorToken.textTertiary : .clear)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.trailing, 4)
                .accessibilityHidden(true)

            TextField("", text: $text, axis: .vertical)
                .textFieldStyle(.plain)
                .font(InlineRuleTokenMetrics.font)
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                .lineLimit(1...4)
                .keyboardType(keyboardType)
                .textInputAutocapitalization(autocapitalization)
                .autocorrectionDisabled(autocorrectionDisabled)
                .focused($isFocused)
                .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .frame(minWidth: InlineRuleTokenMetrics.minimumTokenWidth, alignment: .topLeading)
        .moatDottedUnderline(color: underlineColor, isActive: isFocused)
        .padding(.vertical, InlineRuleTokenMetrics.verticalPadding)
        .frame(minHeight: InlineRuleTokenMetrics.tapTargetHeight, alignment: .topLeading)
        .alignmentGuide(.firstTextBaseline) { _ in
            InlineRuleTokenMetrics.alignedFirstTextBaseline
        }
        .accessibilityLabel(accessibilityLabel)
        .onSubmit { onCommit?() }
        .onChange(of: isFocused) { focused in
            onFocusChange?(focused)
            if !focused { onCommit?() }
        }
        .onChange(of: text) { newValue in
            // The field grows vertically so long values wrap, which also lets the
            // return key insert a newline; rule values stay single-line instead.
            let singleLine = newValue.replacingOccurrences(of: "\n", with: " ")
            if singleLine != newValue {
                text = singleLine
                onCommit?()
                return
            }

            guard formatsGroupedNumber else { return }
            let formatted = AmountInputFormatter.formatTyping(newValue, fractionDigits: fractionDigits)
            if formatted != newValue {
                text = formatted
            }
        }
    }
}
