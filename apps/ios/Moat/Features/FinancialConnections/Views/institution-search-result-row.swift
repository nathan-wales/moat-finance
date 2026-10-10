import SwiftUI

struct InstitutionSearchResultRow: View {
    let institution: InstitutionSearchResult
    let isSelected: Bool
    let isLoading: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: MoatTheme.Spacing.medium) {
                InstitutionLogoView(
                    name: institution.displayName,
                    domain: institution.logoDomain,
                    logoUrl: institution.logoUrl,
                    size: 36
                )

                VStack(alignment: .leading, spacing: 2) {
                    Text(institution.displayName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    if let legalName = institution.legalName, !legalName.isEmpty {
                        Text(legalName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 0)

                if isLoading {
                    ProgressView()
                } else if isSelected {
                    Image(systemName: "checkmark")
                        .foregroundStyle(MoatTheme.ColorToken.accent)
                }
            }
            .padding(MoatTheme.Spacing.medium)
            .background(isSelected ? MoatTheme.ColorToken.accent.opacity(0.08) : MoatTheme.ColorToken.surface)
            .overlay {
                RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                    .stroke(isSelected ? MoatTheme.ColorToken.accent : MoatTheme.ColorToken.border, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }
}
