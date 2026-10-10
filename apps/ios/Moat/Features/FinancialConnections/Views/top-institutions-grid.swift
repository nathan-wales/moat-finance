import SwiftUI

struct TopInstitutionsGrid: View {
    let showAppleWallet: Bool
    let resolvingName: String?
    let onSelectAppleWallet: () -> Void
    let onSelect: (TopInstitution) -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 4)

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            Text("Popular institutions")
                .font(.caption)
                .foregroundStyle(.secondary)

            LazyVGrid(columns: columns, spacing: 8) {
                if showAppleWallet {
                    Button(action: onSelectAppleWallet) {
                        appleWalletTile
                    }
                    .buttonStyle(.plain)
                    .disabled(resolvingName != nil)
                }

                ForEach(TopInstitutions.all) { institution in
                    Button {
                        onSelect(institution)
                    } label: {
                        institutionTile(institution)
                    }
                    .buttonStyle(.plain)
                    .disabled(resolvingName != nil)
                }
            }
        }
    }

    private var appleWalletTile: some View {
        VStack(spacing: 6) {
            Image(systemName: "wallet.pass.fill")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(
                    LinearGradient(
                        colors: [Color(red: 0.12, green: 0.12, blue: 0.14), Color(red: 0.28, green: 0.28, blue: 0.32)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))

            Text("Apple Wallet")
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, minHeight: 80)
        .padding(.horizontal, 4)
        .padding(.vertical, 8)
        .background(MoatTheme.ColorToken.surface.opacity(0.65))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                .stroke(MoatTheme.ColorToken.border, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }

    private func institutionTile(_ institution: TopInstitution) -> some View {
        let isResolving = resolvingName == institution.name

        return VStack(spacing: 6) {
            ZStack {
                InstitutionLogoView(name: institution.name, domain: institution.domain, size: 36)

                if isResolving {
                    RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                        .fill(Color.black.opacity(0.35))
                    ProgressView()
                        .tint(.white)
                }
            }

            Text(institution.name)
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, minHeight: 80)
        .padding(.horizontal, 4)
        .padding(.vertical, 8)
        .background(MoatTheme.ColorToken.surface.opacity(0.65))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                .stroke(MoatTheme.ColorToken.border, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }
}
