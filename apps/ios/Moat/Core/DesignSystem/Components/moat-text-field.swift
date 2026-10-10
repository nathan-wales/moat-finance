import SwiftUI

extension Text {
    static func moatPlaceholder(_ string: String) -> Text {
        Text(string).foregroundColor(MoatTheme.ColorToken.textTertiary)
    }
}

struct MoatInputFieldModifier: ViewModifier {
    let isFocused: Bool

    func body(content: Content) -> some View {
        content
            .font(.body)
            .padding(.horizontal, MoatTheme.Spacing.medium)
            .frame(minHeight: MoatTheme.Size.inputHeight)
            .background(MoatTheme.ColorToken.mutedSurface)
            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                    .strokeBorder(MoatTheme.ColorToken.softBorder, lineWidth: 1)
            }
            .moatInputFocusRing(isFocused: isFocused, cornerRadius: MoatTheme.Radius.medium)
    }
}

extension View {
    func moatInputFieldStyle(isFocused: Bool) -> some View {
        modifier(MoatInputFieldModifier(isFocused: isFocused))
    }

    func moatInputFocusRing(isFocused: Bool, cornerRadius: CGFloat = MoatTheme.Radius.medium) -> some View {
        overlay {
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .strokeBorder(MoatTheme.ColorToken.focusRing, lineWidth: 4)
                .padding(-2)
                .opacity(isFocused ? 1 : 0)
        }
        .animation(.easeInOut(duration: 0.15), value: isFocused)
    }

    func moatFormInputRow() -> some View {
        listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
    }
}

struct MoatTextField: View {
    let placeholder: String
    @Binding var text: String
    var prompt: Text?
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType?
    var autocapitalization: TextInputAutocapitalization = .sentences
    var autocorrectionDisabled: Bool = false
    var submitLabel: SubmitLabel = .return
    var disabled: Bool = false
    var formatsGroupedNumber: Bool = false
    var fractionDigits: Int = 0
    var onSubmit: (() -> Void)?
    var onFocusChange: ((Bool) -> Void)?

    @FocusState private var isFocused: Bool

    var body: some View {
        styledField
            .textFieldStyle(.plain)
            .keyboardType(keyboardType)
            .textInputAutocapitalization(autocapitalization)
            .autocorrectionDisabled(autocorrectionDisabled)
            .submitLabel(submitLabel)
            .disabled(disabled)
            .focused($isFocused)
            .moatInputFieldStyle(isFocused: isFocused)
            .onSubmit { onSubmit?() }
            .onChange(of: isFocused) { focused in
                onFocusChange?(focused)
            }
            .onChange(of: text) { newValue in
                guard formatsGroupedNumber else { return }
                let formatted = AmountInputFormatter.formatTyping(newValue, fractionDigits: fractionDigits)
                if formatted != newValue {
                    text = formatted
                }
            }
    }

    @ViewBuilder
    private var styledField: some View {
        let styledPrompt = prompt ?? Text.moatPlaceholder(placeholder)

        if let textContentType {
            TextField("", text: $text, prompt: styledPrompt)
                .textContentType(textContentType)
        } else {
            TextField("", text: $text, prompt: styledPrompt)
        }
    }
}

struct MoatSecureField: View {
    let placeholder: String
    @Binding var text: String
    var textContentType: UITextContentType?
    var submitLabel: SubmitLabel = .return
    var disabled: Bool = false
    var onSubmit: (() -> Void)?

    @FocusState private var isFocused: Bool

    var body: some View {
        styledField
            .textFieldStyle(.plain)
            .submitLabel(submitLabel)
            .disabled(disabled)
            .focused($isFocused)
            .moatInputFieldStyle(isFocused: isFocused)
            .onSubmit { onSubmit?() }
    }

    @ViewBuilder
    private var styledField: some View {
        if let textContentType {
            SecureField(placeholder, text: $text)
                .textContentType(textContentType)
        } else {
            SecureField(placeholder, text: $text)
        }
    }
}

struct MoatTextEditor: View {
    @Binding var text: String
    var minHeight: CGFloat = 120
    var disabled: Bool = false

    @FocusState private var isFocused: Bool

    var body: some View {
        TextEditor(text: $text)
            .textFieldStyle(.plain)
            .scrollContentBackground(.hidden)
            .padding(.vertical, MoatTheme.Spacing.small)
            .disabled(disabled)
            .focused($isFocused)
            .moatInputFieldStyle(isFocused: isFocused)
            .frame(minHeight: minHeight)
    }
}
