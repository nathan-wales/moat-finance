import SwiftUI

struct OAuthConnectionsSection: View {
    @ObservedObject var viewModel: AIAccessViewModel
    let onDisconnect: (McpOAuthClientConnection) -> Void

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                sectionHeader

                switch viewModel.oauthState {
                case .idle, .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, MoatTheme.Spacing.large)
                case .error(let message):
                    Text(message)
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, MoatTheme.Spacing.medium)
                case .loaded where viewModel.oauthConnections.isEmpty:
                    emptyState
                case .loaded:
                    VStack(spacing: 0) {
                        ForEach(viewModel.oauthConnections) { connection in
                            OAuthConnectionRow(
                                connection: connection,
                                isDisconnecting: viewModel.disconnectingConnectionId == connection.id,
                                onDisconnect: { onDisconnect(connection) }
                            )
                            if connection.id != viewModel.oauthConnections.last?.id {
                                Divider().padding(.vertical, MoatTheme.Spacing.small)
                            }
                        }
                    }
                }
            }
        }
    }

    private var sectionHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("OAuth connections", systemImage: "link")
                .font(.headline)
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
            Text("Hosted MCP clients connected via OAuth.")
                .font(.subheadline)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
        }
    }

    private var emptyState: some View {
        VStack(spacing: MoatTheme.Spacing.small) {
            Image(systemName: "cable.connector")
                .font(.title2)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary.opacity(0.5))
            Text("No OAuth clients connected.")
                .font(.subheadline)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, MoatTheme.Spacing.xLarge)
    }
}

private struct OAuthConnectionRow: View {
    let connection: McpOAuthClientConnection
    let isDisconnecting: Bool
    let onDisconnect: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: MoatTheme.Spacing.small) {
                    Text(connection.displayName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                    statusChip(connection.status)
                }

                Text(connection.clientProfile)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(MoatTheme.ColorToken.mutedSurface)
                    .clipShape(Capsule())

                Text("\(connection.tokenPrefix)…")
                    .font(.caption.monospaced())
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)

                Text(connection.scopes.joined(separator: " "))
                    .font(.caption)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)

                Text(
                    "Connected \(AIAccessDateFormatting.short(connection.connectedAt)) · Last used \(AIAccessDateFormatting.short(connection.lastUsedAt)) · Refresh expires \(AIAccessDateFormatting.short(connection.refreshTokenExpiresAt))"
                )
                .font(.caption)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            }

            HStack {
                Spacer(minLength: 0)
                AIAccessCompactActionButton(
                    title: "Disconnect",
                    systemImage: "trash",
                    isLoading: isDisconnecting,
                    isDisabled: connection.status != .active || isDisconnecting,
                    action: onDisconnect
                )
            }
        }
        .padding(.vertical, MoatTheme.Spacing.xSmall)
    }
}

func statusChip(_ status: AIAccessStatus) -> some View {
    Text(status.rawValue)
        .font(.caption2.weight(.semibold))
        .foregroundStyle(status == .active ? MoatTheme.ColorToken.positive : MoatTheme.ColorToken.textSecondary)
        .padding(.horizontal, 8)
        .padding(.vertical, 2)
        .background(
            status == .active
                ? MoatTheme.ColorToken.positive.opacity(0.12)
                : MoatTheme.ColorToken.mutedSurface
        )
        .clipShape(Capsule())
}
