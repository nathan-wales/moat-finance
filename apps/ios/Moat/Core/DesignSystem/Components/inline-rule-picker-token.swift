import SwiftUI

struct InlineRuleOption<Value: Hashable>: Identifiable {
    let value: Value
    let title: String
    var systemImage: String?

    var id: Value { value }
}

/// A menu-backed token that reads as inline text: optional icon, underlined
/// words, and a compact chevron — with no pill or box around them.
struct InlineRulePickerToken<Value: Hashable>: View {
    let accessibilityLabel: String
    let title: String
    let options: [InlineRuleOption<Value>]
    @Binding var selection: Value
    var isPlaceholder = false
    var onSelect: (Value) -> Void = { _ in }

    private var selectedSystemImage: String? {
        options.first(where: { $0.value == selection })?.systemImage
    }

    var body: some View {
        Menu {
            ForEach(options) { option in
                Button {
                    selection = option.value
                    onSelect(option.value)
                } label: {
                    if let systemImage = option.systemImage {
                        Label(option.title, systemImage: systemImage)
                    } else {
                        Text(option.title)
                    }
                }
            }
        } label: {
            InlineRuleTokenLabel(
                title: title,
                systemImage: selectedSystemImage,
                isPlaceholder: isPlaceholder
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(title)
        .accessibilityAddTraits(.isButton)
        .accessibilityHint("Opens a list of choices")
    }
}

/// The same token appearance for pickers that present a sheet instead of a menu.
struct InlineRuleSheetToken<Sheet: View>: View {
    let accessibilityLabel: String
    let title: String
    var isPlaceholder = false
    @ViewBuilder let sheetContent: (@escaping () -> Void) -> Sheet

    @State private var isPresented = false

    var body: some View {
        Button {
            isPresented = true
        } label: {
            InlineRuleTokenLabel(title: title, isPlaceholder: isPlaceholder, isActive: isPresented)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(title)
        .accessibilityHint("Opens a list of choices")
        .sheet(isPresented: $isPresented) {
            sheetContent { isPresented = false }
        }
    }
}
