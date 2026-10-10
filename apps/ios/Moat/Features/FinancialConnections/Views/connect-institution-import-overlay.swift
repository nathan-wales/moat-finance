import SwiftUI

struct ConnectInstitutionImportOverlay: View {
    let phase: ConnectInstitutionOverlayPhase
    let onDone: () -> Void

    var body: some View {
        ZStack {
            MoatTheme.ColorToken.appBackground
                .ignoresSafeArea()

            switch phase {
            case .none:
                EmptyView()
            case .importing(let institutionName):
                importingContent(institutionName: institutionName)
            case .succeeded(let institutionName, let accountCount, _):
                succeededContent(
                    institutionName: institutionName,
                    accountCount: accountCount
                )
            }
        }
        .accessibilityElement(children: .contain)
    }

    private func importingContent(institutionName: String?) -> some View {
        VStack(spacing: MoatTheme.Spacing.large) {
            ProgressView()
                .controlSize(.large)

            Text("Please wait")
                .font(.title2.weight(.semibold))

            Text("Importing your account data. This may take a moment.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if let institutionName {
                Text("Connecting \(institutionName)…")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            warningCallout
        }
        .padding(.horizontal, MoatTheme.Spacing.xLarge)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityLabel("Importing account data")
    }

    private func succeededContent(institutionName: String, accountCount: Int) -> some View {
        VStack(spacing: MoatTheme.Spacing.large) {
            Image(systemName: "checkmark")
                .font(.system(size: 56, weight: .semibold))
                .foregroundStyle(MoatTheme.ColorToken.positive)
                .accessibilityHidden(true)

            VStack(spacing: MoatTheme.Spacing.small) {
                Text("Data imported successfully")
                    .font(.title3.weight(.bold))
                    .multilineTextAlignment(.center)

                Text(successSummary(institutionName: institutionName, accountCount: accountCount))
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .multilineTextAlignment(.center)
            }

            Button(action: onDone) {
                Text("Done")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.moatPrimary)
            .padding(.top, MoatTheme.Spacing.medium)
        }
        .padding(.horizontal, MoatTheme.Spacing.xLarge)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Data imported successfully")
    }

    private var warningCallout: some View {
        Label {
            Text("Don't close this sheet or leave the app until import finishes.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.leading)
        } icon: {
            Image(systemName: "hand.raised.fill")
                .foregroundStyle(MoatTheme.ColorToken.warning.opacity(0.85))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.warning.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        .padding(.top, MoatTheme.Spacing.small)
    }

    private func successSummary(institutionName: String, accountCount: Int) -> String {
        let noun = accountCount == 1 ? "account" : "accounts"
        return "\(institutionName) is connected with \(accountCount) \(noun)."
    }
}

#Preview("Importing") {
    ConnectInstitutionImportOverlay(
        phase: .importing(institutionName: "Chase"),
        onDone: {}
    )
}

#Preview("Success") {
    ConnectInstitutionImportOverlay(
        phase: .succeeded(institutionName: "Chase", accountCount: 3, plaidItemDbId: "preview-item-id"),
        onDone: {}
    )
}
