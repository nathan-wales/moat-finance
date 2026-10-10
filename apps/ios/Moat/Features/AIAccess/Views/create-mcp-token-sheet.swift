import SwiftUI
import UIKit

struct CreateMcpTokenSheet: View {
    @ObservedObject var viewModel: AIAccessViewModel
    @SwiftUI.Environment(\.dismiss) private var dismiss

    @State private var name = "Local MCP token"
    @State private var clientName = ""
    @State private var expiration: McpTokenExpirationOption = .days90
    @State private var preset: McpScopePreset = .recommended
    @State private var selectedScopes: Set<McpScope> = Set(McpScope.recommendedDefaults)
    @State private var createdToken: CreatedMcpPersonalAccessToken?
    @State private var didCopy = false

    var body: some View {
        NavigationStack {
            Group {
                if let createdToken {
                    createdContent(createdToken)
                } else {
                    formContent
                }
            }
            .navigationTitle("Create MCP token")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .onDisappear {
            viewModel.clearCreateTokenError()
        }
    }

    private var formContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                Text("Use this token with Cursor, local stdio, or other MCP clients.")
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)

                MoatTextField(placeholder: "Name", text: $name)
                MoatTextField(placeholder: "Client name (e.g. Cursor)", text: $clientName)

                VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                    Text("Expiration")
                        .font(.subheadline.weight(.medium))
                    Picker("Expiration", selection: $expiration) {
                        ForEach(McpTokenExpirationOption.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    .pickerStyle(.menu)
                }

                VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                    Text("Access preset")
                        .font(.subheadline.weight(.medium))
                    Picker("Access preset", selection: $preset) {
                        ForEach(McpScopePreset.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    .pickerStyle(.menu)
                    .onChange(of: preset) { value in
                        if let scopes = value.scopes {
                            selectedScopes = Set(scopes)
                        }
                    }

                    Text(preset.description)
                        .font(.caption)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                }

                VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                    ForEach(McpScope.advertised) { scope in
                        Toggle(isOn: Binding(
                            get: { selectedScopes.contains(scope) },
                            set: { isOn in
                                if isOn {
                                    selectedScopes.insert(scope)
                                } else {
                                    selectedScopes.remove(scope)
                                }
                                preset = McpScopePreset.detect(from: Array(selectedScopes))
                            }
                        )) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(scope.label)
                                    .font(.subheadline)
                                Text(scope.rawValue)
                                    .font(.caption.monospaced())
                                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                            }
                        }
                        .moatToggleStyle()
                    }
                }

                if let error = viewModel.createTokenError {
                    Text(error)
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.destructive)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    Task {
                        let created = await viewModel.createToken(
                            name: name,
                            clientName: clientName,
                            scopes: Array(selectedScopes),
                            expiration: expiration
                        )
                        if let created {
                            createdToken = created
                        }
                    }
                } label: {
                    Text(viewModel.isCreatingToken ? "Creating…" : "Create token")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatPrimary)
                .disabled(
                    viewModel.isCreatingToken
                        || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        || selectedScopes.isEmpty
                )
            }
            .padding(MoatTheme.Spacing.large)
        }
        .moatPageBackground()
    }

    private func createdContent(_ token: CreatedMcpPersonalAccessToken) -> some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
            Text("Token")
                .font(.caption)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)

            Text(token.token)
                .font(.footnote.monospaced())
                .textSelection(.enabled)
                .padding(MoatTheme.Spacing.medium)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(MoatTheme.ColorToken.mutedSurface)
                .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))

            HStack {
                Button {
                    UIPasteboard.general.string = token.token
                    didCopy = true
                } label: {
                    Label(didCopy ? "Copied" : "Copy", systemImage: didCopy ? "checkmark" : "doc.on.doc")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatSecondary)

                Button {
                    dismiss()
                } label: {
                    Text("Done").frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatPrimary)
            }

            Spacer()
        }
        .padding(MoatTheme.Spacing.large)
        .moatPageBackground()
    }
}
