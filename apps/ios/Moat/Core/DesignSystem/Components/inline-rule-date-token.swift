import SwiftUI

/// A date value inside a rule sentence. It keeps the picker-token grammar —
/// underlined words plus a chevron — and defers to a native graphical picker in
/// a sheet, because a compact `DatePicker` would draw its own box.
struct InlineRuleDateToken: View {
    let accessibilityLabel: String
    @Binding var date: Date
    var onChange: () -> Void = {}

    @State private var isPresented = false

    var body: some View {
        Button {
            isPresented = true
        } label: {
            InlineRuleTokenLabel(
                title: DateFormatterProvider.fullDate(date),
                isActive: isPresented
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(DateFormatterProvider.fullDate(date))
        .accessibilityHint("Opens a date picker")
        .sheet(isPresented: $isPresented) {
            datePickerSheet
        }
    }

    private var datePickerSheet: some View {
        MoatGlassSheet(title: accessibilityLabel) {
            DatePicker("", selection: $date, displayedComponents: .date)
                .datePickerStyle(.graphical)
                .labelsHidden()
                .onChange(of: date) { _ in onChange() }
        } footer: {
            Button {
                isPresented = false
            } label: {
                Text("Done").frame(maxWidth: .infinity)
            }
            .buttonStyle(.moatPrimary)
        }
        .presentationDetents([.medium, .large])
    }
}
