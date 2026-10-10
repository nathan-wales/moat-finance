import SwiftUI

struct PersonalAccessTokensSection: View {
    @ObservedObject var viewModel: AIAccessViewModel
    let onCreate: () -> Void
    let onRevoke: (McpPersonalAccessToken) -> Void

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                HStack(alignment: .top, spacing: MoatTheme.Spacing.medium) {
                    VStack(alignment: .leading, spacing: 4) {
                        Label("Personal access tokens", systemImage: "key.fill")
                            .font(.headline)
                            .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                        Text("Scoped tokens for local MCP clients.")
                            .font(.subheadline)
                            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    Spacer(minLength: MoatTheme.Spacing.small)

                    Button(action: onCreate) {
                        Image(systemName: "plus")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(MoatTheme.ColorToken.inkInverse)
                            .frame(width: 36, height: 36)
                            .background(MoatTheme.ColorToken.ink)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("New personal access token")
                }

                switch viewModel.tokensState {
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
                case .loaded where viewModel.tokens.isEmpty:
                    emptyState
                case .loaded:
                    VStack(spacing: 0) {
                        ForEach(viewModel.tokens) { token in
                            PersonalAccessTokenRow(
                                token: token,
                                isRevoking: viewModel.revokingTokenId == token.id,
                                onRevoke: { onRevoke(token) }
                            )
                            if token.id != viewModel.tokens.last?.id {
                                Divider().padding(.vertical, MoatTheme.Spacing.small)
                            }
                        }
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: MoatTheme.Spacing.small) {
            Image(systemName: "key")
                .font(.title2)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary.opacity(0.5))
            Text("No personal access tokens yet.")
                .font(.subheadline)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, MoatTheme.Spacing.xLarge)
    }
}

private struct PersonalAccessTokenRow: View {
    let token: McpPersonalAccessToken
    let isRevoking: Bool
    let onRevoke: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: MoatTheme.Spacing.small) {
                    Text(token.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                    statusChip(token.status)
                }

                Text("\(token.tokenPrefix)…")
                    .font(.caption.monospaced())
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)

                Text(token.scopes.joined(separator: " "))
                    .font(.caption)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)

                Text(
                    "Created \(AIAccessDateFormatting.short(token.createdAt)) · Last used \(AIAccessDateFormatting.short(token.lastUsedAt)) · Expires \(AIAccessDateFormatting.short(token.expiresAt))"
                )
                .font(.caption)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            }
            .opacity(token.status == .active ? 1 : 0.6)

            HStack {
                Spacer(minLength: 0)
                AIAccessCompactActionButton(
                    title: "Revoke",
                    systemImage: "trash",
                    isLoading: isRevoking,
                    isDisabled: token.status != .active || isRevoking,
                    action: onRevoke
                )
            }
        }
        .padding(.vertical, MoatTheme.Spacing.xSmall)
    }
}
