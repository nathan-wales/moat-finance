import SwiftUI

struct FinancialProfileFieldHelpButton: View {
    let title: String
    let message: String

    @State private var isPresented = false

    var body: some View {
        Button {
            isPresented = true
        } label: {
            Image(systemName: "info.circle")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("About \(title)")
        .alert(title, isPresented: $isPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(message)
        }
    }
}

struct FinancialProfileFieldLabel: View {
    let title: String
    let helpMessage: String

    var body: some View {
        HStack(spacing: MoatTheme.Spacing.xSmall) {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            FinancialProfileFieldHelpButton(title: title, message: helpMessage)
        }
    }
}

struct FinancialProfileLabeledTextField: View {
    let title: String
    let helpMessage: String
    let placeholder: String
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default
    var disabled: Bool = false
    var formatsGroupedNumber: Bool = false
    var fractionDigits: Int = 0

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            FinancialProfileFieldLabel(title: title, helpMessage: helpMessage)
            TextField("", text: $text, prompt: Text.moatPlaceholder(placeholder))
                .textFieldStyle(.plain)
                .keyboardType(keyboardType)
                .disabled(disabled)
                .focused($isFocused)
                .moatInputFieldStyle(isFocused: isFocused)
                .onChange(of: text) { newValue in
                    guard formatsGroupedNumber else { return }
                    let formatted = AmountInputFormatter.formatTyping(newValue, fractionDigits: fractionDigits)
                    if formatted != newValue {
                        text = formatted
                    }
                }
        }
    }
}

struct FinancialProfileLabeledDateField: View {
    let title: String
    let helpMessage: String
    @Binding var dateString: String
    var isOptional: Bool = false

    @State private var isPresented = false
    @State private var draftDate = Date()

    private var parsedDate: Date? {
        FinancialProfileDateFieldFormatting.date(from: dateString)
    }

    private var displayTitle: String {
        guard let parsedDate else { return "Select date" }
        return DateFormatterProvider.fullDate(parsedDate)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            FinancialProfileFieldLabel(title: title, helpMessage: helpMessage)
            Button {
                draftDate = parsedDate ?? Date()
                isPresented = true
            } label: {
                HStack(spacing: MoatTheme.Spacing.small) {
                    Text(displayTitle)
                        .font(.body)
                        .lineLimit(1)
                        .foregroundStyle(
                            parsedDate == nil
                                ? MoatTheme.ColorToken.textSecondary
                                : MoatTheme.ColorToken.textPrimary
                        )
                    Spacer(minLength: MoatTheme.Spacing.xSmall)
                    Image(systemName: "calendar")
                        .font(.caption)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .moatInputFieldStyle(isFocused: isPresented)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(title)
            .accessibilityValue(parsedDate.map(DateFormatterProvider.fullDate) ?? "No date selected")
            .accessibilityHint("Opens a date picker")
        }
        .sheet(isPresented: $isPresented) {
            datePickerSheet
        }
    }

    private var datePickerSheet: some View {
        MoatGlassSheet(title: title) {
            DatePicker("", selection: $draftDate, displayedComponents: .date)
                .datePickerStyle(.graphical)
                .labelsHidden()
        } footer: {
            VStack(spacing: MoatTheme.Spacing.small) {
                Button {
                    dateString = FinancialProfileDateFieldFormatting.string(from: draftDate)
                    isPresented = false
                } label: {
                    Text("Done").frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatPrimary)

                if isOptional {
                    Button {
                        dateString = ""
                        isPresented = false
                    } label: {
                        Text("Clear").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatSecondary)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

private enum FinancialProfileDateFieldFormatting {
    static func date(from value: String) -> Date? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let normalized = formatDateString(trimmed)
        guard let parsed = isoDateFormatter.date(from: normalized) else { return nil }

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = isoDateFormatter.timeZone
        let components = calendar.dateComponents([.year, .month, .day], from: parsed)
        return Calendar.current.date(from: components)
    }

    static func string(from date: Date) -> String {
        let components = Calendar.current.dateComponents([.year, .month, .day], from: date)
        guard
            let year = components.year,
            let month = components.month,
            let day = components.day
        else {
            return isoDateFormatter.string(from: date)
        }
        return String(format: "%04d-%02d-%02d", year, month, day)
    }

    private static let isoDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

struct FinancialProfileLabeledMenuField<MenuContent: View>: View {
    let title: String
    let helpMessage: String
    let valueLabel: String
    var valueSystemImage: String?
    var isPlaceholder: Bool = false
    var footnote: String?
    @ViewBuilder let menuContent: () -> MenuContent

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            FinancialProfileFieldLabel(title: title, helpMessage: helpMessage)
            Menu(content: menuContent) {
                HStack(spacing: MoatTheme.Spacing.small) {
                    valueContent
                    Spacer(minLength: MoatTheme.Spacing.xSmall)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption2)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .moatInputFieldStyle(isFocused: false)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(title)
            .accessibilityValue(valueLabel)

            if let footnote {
                Text(footnote)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var valueForegroundStyle: Color {
        isPlaceholder
            ? MoatTheme.ColorToken.textTertiary
            : MoatTheme.ColorToken.textPrimary
    }

    @ViewBuilder
    private var valueContent: some View {
        if let valueSystemImage {
            Label(valueLabel, systemImage: valueSystemImage)
                .font(.body)
                .lineLimit(1)
                .foregroundStyle(valueForegroundStyle)
        } else {
            Text(valueLabel)
                .font(.body)
                .lineLimit(1)
                .foregroundStyle(valueForegroundStyle)
        }
    }
}

struct FinancialProfileLabeledPicker<Selection: Hashable, Content: View>: View {
    let title: String
    let helpMessage: String
    @Binding var selection: Selection
    let selectionTitle: String
    var selectionSystemImage: String?
    @ViewBuilder let content: () -> Content

    var body: some View {
        FinancialProfileLabeledMenuField(
            title: title,
            helpMessage: helpMessage,
            valueLabel: selectionTitle,
            valueSystemImage: selectionSystemImage
        ) {
            Picker("", selection: $selection, content: content)
                .labelsHidden()
                .pickerStyle(.inline)
        }
    }
}

struct FinancialProfileLinkMenuPicker: View {
    let title: String
    let helpMessage: String
    @Binding var selection: String
    let options: [String]
    let onCreateNew: () -> Void
    var onConnectNew: (() -> Void)? = nil

    private var displayOptions: [String] {
        var result = options
        if !selection.isEmpty, !result.contains(selection) {
            result.append(selection)
        }
        return result
    }

    private var selectionLabel: String {
        selection.isEmpty ? "None" : selection
    }

    var body: some View {
        FinancialProfileLabeledMenuField(
            title: title,
            helpMessage: helpMessage,
            valueLabel: selectionLabel,
            isPlaceholder: selection.isEmpty
        ) {
            Button("None") { selection = "" }
            ForEach(displayOptions, id: \.self) { option in
                Button(option) { selection = option }
            }
            Divider()
            if let onConnectNew {
                Menu("Create new…") {
                    Button(action: onConnectNew) {
                        Label("Connect liability", systemImage: "link.badge.plus")
                    }
                    Button(action: onCreateNew) {
                        Label("Add manual liability", systemImage: "square.and.pencil")
                    }
                }
            } else {
                Button("Create new…", action: onCreateNew)
            }
        }
    }
}

struct FinancialProfileLabeledToggle: View {
    let title: String
    let helpMessage: String
    @Binding var isOn: Bool

    var body: some View {
        HStack(alignment: .center) {
            FinancialProfileFieldLabel(title: title, helpMessage: helpMessage)
            Spacer(minLength: MoatTheme.Spacing.small)
            Toggle("", isOn: $isOn)
                .labelsHidden()
                .moatToggleStyle()
        }
    }
}

struct FinancialProfileLabeledTextEditor: View {
    let title: String
    let helpMessage: String
    @Binding var text: String
    var minHeight: CGFloat = 120
    var disabled: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            FinancialProfileFieldLabel(title: title, helpMessage: helpMessage)
            MoatTextEditor(text: $text, minHeight: minHeight, disabled: disabled)
        }
    }
}
