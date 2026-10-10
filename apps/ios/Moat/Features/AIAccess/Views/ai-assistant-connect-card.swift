import SwiftUI

struct AIAssistantConnectCard: View {
    private let providers = ["ChatGPT", "Claude", "OpenClaw", "Cursor"]

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                    Label("AI assistant connections", systemImage: "sparkles")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(MoatTheme.ColorToken.accent)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(MoatTheme.ColorToken.accent.opacity(0.12))
                        .clipShape(Capsule())

                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("Connect your personal AI assistant")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(MoatTheme.ColorToken.textPrimary)

                        Text("Soon you will be able to connect ChatGPT, Claude, OpenClaw, or Cursor directly to Moat so your assistant can help answer questions about your finances.")
                            .font(.subheadline)
                            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(spacing: MoatTheme.Spacing.small) {
                    ForEach(providers, id: \.self) { provider in
                        providerButton(for: provider)
                    }
                }
            }
        }
    }

    private func providerButton(for provider: String) -> some View {
        Button {
        } label: {
            HStack {
                Text("Connect \(provider)")
                    .font(.subheadline.weight(.medium))
                Spacer()
                comingSoonBadge
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.moatSecondary)
        .disabled(true)
    }

    private var comingSoonBadge: some View {
        Label("Coming soon", systemImage: "lock")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(MoatTheme.ColorToken.mutedSurface)
            .clipShape(Capsule())
    }
}
