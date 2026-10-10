import SwiftUI

struct McpLogDetailsSheet: View {
    let log: McpLogEntry
    @SwiftUI.Environment(\.dismiss) private var dismiss

    var body: some View {
        MoatGlassSheet(title: "Log details", showsCloseButton: true) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                labeledRow("Status") {
                    Text(log.status)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(statusForeground)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(statusForeground.opacity(0.12))
                        .clipShape(Capsule())
                }

                labeledRow("Time") {
                    Text(AIAccessDateFormatting.absolute(log.createdAt))
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                }

                labeledRow("Client") {
                    Text(log.clientName ?? "—")
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                }

                labeledRow("Profile") {
                    Text(log.clientProfile ?? "—")
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                }

                labeledRow("Auth type") {
                    Text(log.authTypeLabel)
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                }

                labeledRow("Tool / action") {
                    Text(log.toolName)
                        .font(.caption.monospaced())
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                }

                labeledRow("Duration") {
                    Text("\(log.durationMs) ms")
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                }

                if let errorCode = log.errorCode, !errorCode.isEmpty {
                    labeledRow("Error code") {
                        Text(errorCode)
                            .font(.caption.monospaced())
                            .foregroundStyle(MoatTheme.ColorToken.destructive)
                    }
                }

                if log.rateLimited {
                    labeledRow("Rate limited") {
                        Text("Yes")
                            .font(.subheadline)
                            .foregroundStyle(MoatTheme.ColorToken.warning)
                    }
                }

                if !log.requiredScopes.isEmpty {
                    scopeBlock(title: "Required scopes", scopes: log.requiredScopes)
                }

                if !log.grantedScopes.isEmpty {
                    scopeBlock(title: "Granted scopes", scopes: log.grantedScopes)
                }
            }
        } footer: {
            Button {
                dismiss()
            } label: {
                Text("Done").frame(maxWidth: .infinity)
            }
            .buttonStyle(.moatPrimary)
        }
    }

    private var statusForeground: Color {
        switch log.status {
        case "success": return MoatTheme.ColorToken.positive
        case "denied": return MoatTheme.ColorToken.warning
        default: return MoatTheme.ColorToken.destructive
        }
    }

    private func labeledRow<Content: View>(_ label: String, @ViewBuilder value: () -> Content) -> some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .frame(width: 110, alignment: .leading)
            value()
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func scopeBlock(title: String, scopes: [String]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            Text(scopes.joined(separator: " "))
                .font(.caption.monospaced())
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
        }
        .padding(.top, MoatTheme.Spacing.small)
    }
}
