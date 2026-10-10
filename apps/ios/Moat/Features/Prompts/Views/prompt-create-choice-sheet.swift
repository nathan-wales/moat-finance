import SwiftUI

struct PromptCreateChoiceSheet: View {
    var errorMessage: String?
    let onCreateWithAI: () -> Void
    let onWriteManually: () -> Void

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                if let errorMessage {
                    Text(errorMessage)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(MoatTheme.ColorToken.destructive)
                }

                createButton(
                    title: "Create with AI",
                    subtitle: "Describe what you want, and your connected AI assistant will help build the prompt.",
                    systemImage: "sparkles",
                    action: onCreateWithAI
                )

                createButton(
                    title: "Write manually",
                    subtitle: "Write the prompt yourself, choose a category, and decide whether to keep it private or submit it to the community.",
                    systemImage: "pencil",
                    action: onWriteManually
                )

                Spacer()
            }
            .padding(MoatTheme.Spacing.large)
            .navigationTitle("Create a prompt")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
    }

    private func createButton(
        title: String,
        subtitle: String,
        systemImage: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                Label(title, systemImage: systemImage)
                    .font(.headline)
                    .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(MoatTheme.Spacing.medium)
            .background(MoatTheme.ColorToken.elevatedSurface)
            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.large, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct PromptAiConnectionGateSheet: View {
    let onConnectAssistant: () -> Void
    let onWriteManually: () -> Void

    var body: some View {
        MoatGlassSheet(title: "Connect an AI assistant first") {
            Text("To build prompts with AI, connect an assistant to Moat. You can still write and save prompts manually without connecting one.")
                .font(.subheadline)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        } footer: {
            VStack(spacing: MoatTheme.Spacing.medium) {
                Button(action: onConnectAssistant) {
                    Text("Connect an assistant")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatPrimary)

                Button(action: onWriteManually) {
                    Text("Write manually instead")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatSecondary)
            }
        }
    }
}

struct PromptManualFormSheet: View {
    @ObservedObject var createViewModel: PromptCreateViewModel
    let categories: [PromptCategory]
    var isEditing = false
    let onSave: () async -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Title", text: $createViewModel.title)
                    TextField("Short description", text: $createViewModel.description)
                    Picker("Category", selection: $createViewModel.categorySlug) {
                        ForEach(categories) { category in
                            Text(category.label).tag(category.slug)
                        }
                    }
                    TextField("Tags (comma-separated)", text: $createViewModel.tags)
                }

                Section("Prompt body") {
                    TextEditor(text: $createViewModel.body)
                        .frame(minHeight: 160)
                }

                if !isEditing {
                    Section("Who is this prompt for?") {
                        Toggle("Submit to the community", isOn: $createViewModel.submitForReview)
                            .moatToggleStyle()
                        Text(createViewModel.submitForReview
                            ? "Send it for review. It will remain available privately while it is reviewed."
                            : "Save it privately in your library.")
                            .font(.caption)
                            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit prompt" : "Write manually")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save changes" : (createViewModel.submitForReview ? "Save and submit for review" : "Save private prompt")) {
                        Task { await onSave() }
                    }
                    .disabled(createViewModel.title.isEmpty || createViewModel.body.isEmpty || createViewModel.isSubmitting)
                }
            }
        }
        .presentationDetents([.large])
    }
}

struct PromptAiBuilderSheet: View {
    @ObservedObject var createViewModel: PromptCreateViewModel
    let onGenerate: () async -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("What should this prompt help you accomplish?")
                        .font(.subheadline)
                    TextEditor(text: $createViewModel.goal)
                        .frame(minHeight: 100)
                }

                Section("Optional details") {
                    TextField("Which financial data should the prompt use?", text: $createViewModel.financialData)
                    TextField("What should the response include?", text: $createViewModel.responseInclude)
                }
            }
            .navigationTitle("Build with AI")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(createViewModel.isGenerating ? "Generating…" : "Generate") {
                        Task { await onGenerate() }
                    }
                    .disabled(createViewModel.goal.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || createViewModel.isGenerating)
                }
            }
        }
        .presentationDetents([.large])
    }
}
