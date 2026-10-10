import SwiftUI

struct CommunityTipSubmitView: View {
    let onSuccess: () -> Void

    @SwiftUI.Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var tipBody = ""
    @State private var attribution: CommunityTipAttribution = .public
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private let service = CommunityTipsService()

    private var isValid: Bool {
        title.trimmingCharacters(in: .whitespacesAndNewlines).count >= 5
            && tipBody.trimmingCharacters(in: .whitespacesAndNewlines).count >= 20
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("Title")
                            .font(.headline)
                        MoatTextField(
                            placeholder: "A short, descriptive title",
                            text: $title,
                            autocapitalization: .sentences
                        )
                        Text("5–120 characters")
                            .font(.caption)
                            .foregroundStyle(MoatTheme.ColorToken.textTertiary)
                    }

                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("Tip")
                            .font(.headline)
                        TextEditor(text: $tipBody)
                            .frame(minHeight: 120)
                            .padding(MoatTheme.Spacing.small)
                            .background(MoatTheme.ColorToken.mutedSurface)
                            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                                    .strokeBorder(MoatTheme.ColorToken.softBorder, lineWidth: 1)
                            }
                        Text("20–5000 characters. Describe the tip clearly and include any steps needed.")
                            .font(.caption)
                            .foregroundStyle(MoatTheme.ColorToken.textTertiary)
                    }

                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("Attribution")
                            .font(.headline)
                        Picker("Attribution", selection: $attribution) {
                            ForEach(CommunityTipAttribution.allCases) { option in
                                Text(option.displayTitle).tag(option)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.subheadline)
                            .foregroundStyle(MoatTheme.ColorToken.destructive)
                            .padding(MoatTheme.Spacing.medium)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(MoatTheme.ColorToken.destructiveSoft)
                            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
                    }

                    Button {
                        Task { await submit() }
                    } label: {
                        if isSubmitting {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text("Share tip").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.moatPrimary)
                    .disabled(!isValid || isSubmitting)
                }
                .padding(.horizontal, MoatTheme.Spacing.large)
                .padding(.top, MoatTheme.Spacing.large)
                .padding(.bottom, 112)
            }
            .moatPageBackground()
            .navigationTitle("Share a Tip")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func submit() async {
        isSubmitting = true
        errorMessage = nil
        do {
            _ = try await service.create(CreateCommunityTipRequest(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                body: tipBody.trimmingCharacters(in: .whitespacesAndNewlines),
                attribution: attribution.rawValue
            ))
            onSuccess()
        } catch {
            errorMessage = error.localizedDescription
            AppLogger.error(
                "Failed to submit community tip",
                metadata: ["error": error.localizedDescription]
            )
        }
        isSubmitting = false
    }
}

#Preview {
    CommunityTipSubmitView(onSuccess: {})
}
