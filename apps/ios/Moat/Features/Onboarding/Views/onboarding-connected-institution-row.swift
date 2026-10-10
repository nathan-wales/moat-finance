import SwiftUI

struct OnboardingConnectedInstitutionRow: View {
    let institution: OnboardingConnectedInstitution

    private var subtitle: String {
        let accountLabel = institution.accountCount == 1
            ? "1 account connected"
            : "\(institution.accountCount) accounts connected"
        return "\(institution.institutionName) · \(accountLabel)"
    }

    var body: some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            InstitutionLogoView(name: institution.institutionName, size: 28)

            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(.primary)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
