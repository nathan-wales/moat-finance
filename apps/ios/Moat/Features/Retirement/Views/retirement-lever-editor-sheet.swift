import SwiftUI

struct RetirementLeverEditorSheet: View {
    @State private var draft: RetirementLeverInput
    @State private var ageText: String
    let onSave: (RetirementLeverInput) -> Void
    let onCancel: () -> Void

    init(
        draft: RetirementLeverInput,
        onSave: @escaping (RetirementLeverInput) -> Void,
        onCancel: @escaping () -> Void
    ) {
        _draft = State(initialValue: draft)
        _ageText = State(initialValue: draft.lever.ageParam.map { String(Int($0)) } ?? "")
        self.onSave = onSave
        self.onCancel = onCancel
    }

    var body: some View {
        MoatGlassSheet(title: draft.lever.displayTitle) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                Toggle("Include this change", isOn: $draft.enabled)
                    .moatToggleStyle()

                if draft.lever.ageParam != nil {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("Age")
                            .font(.subheadline.weight(.semibold))
                        TextField("Age", text: $ageText)
                            .keyboardType(.numberPad)
                            .padding(MoatTheme.Spacing.small)
                            .background(MoatTheme.ColorToken.elevatedSurface)
                            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
                    }
                }
            }
            .moatKeyboardDismissToolbar()
        } footer: {
            VStack(spacing: MoatTheme.Spacing.medium) {
                Button("Save") {
                    var next = draft
                    if let age = Double(ageText), next.lever.ageParam != nil {
                        next.lever = next.lever.withAge(age)
                    }
                    onSave(next)
                }
                .buttonStyle(.moatPrimary)

                Button("Cancel", action: onCancel)
                    .buttonStyle(.moatSecondary)
            }
        }
    }
}
