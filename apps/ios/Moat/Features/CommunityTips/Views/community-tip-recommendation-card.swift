import SwiftUI

struct CommunityTipRecommendationCard: View {
    let recommendations: [CommunityTipTransactionRecommendation]
    @Binding var showCommunityTips: Bool
    let onShowCommunityTipsChange: (Bool) -> Void
    let onOpen: (String) -> Void
    let onShowMore: ((String) -> Void)?

    private var showMoreQuery: String {
        var seen = Set<String>()
        var terms: [String] = []
        for tip in recommendations {
            let source = tip.matchedKeywords.isEmpty ? tip.keywords : tip.matchedKeywords
            for keyword in source {
                let normalized = keyword.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                guard !normalized.isEmpty, !seen.contains(normalized) else { continue }
                seen.insert(normalized)
                terms.append(normalized)
                if terms.count >= 12 { break }
            }
            if terms.count >= 12 { break }
        }
        return terms.joined(separator: ", ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Toggle(isOn: Binding(
                get: { showCommunityTips },
                set: { newValue in
                    showCommunityTips = newValue
                    onShowCommunityTipsChange(newValue)
                }
            )) {
                Text("Show community tips")
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            }
            .moatToggleStyle()
            .padding(.bottom, MoatTheme.Spacing.small)

            if showCommunityTips {
                ForEach(Array(recommendations.enumerated()), id: \.element.id) { index, tip in
                    if index > 0 {
                        Divider()
                    }
                    Button {
                        onOpen(tip.id)
                    } label: {
                        RecommendationRow(tip: tip)
                    }
                    .buttonStyle(.plain)
                }

                if let onShowMore, !showMoreQuery.isEmpty {
                    Divider()
                    Button("Show more") {
                        onShowMore(showMoreQuery)
                    }
                    .font(.subheadline.weight(.medium))
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(.top, MoatTheme.Spacing.small)
                }
            }
        }
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.elevatedSurface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                .strokeBorder(MoatTheme.ColorToken.softBorder, lineWidth: 1)
        }
    }
}

private struct RecommendationRow: View {
    let tip: CommunityTipTransactionRecommendation

    var body: some View {
        HStack(alignment: .center, spacing: MoatTheme.Spacing.small) {
            VStack(alignment: .leading, spacing: 2) {
                Text(tip.title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                    .lineLimit(1)

                Text(tip.bodyPreview)
                    .font(.caption)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(MoatTheme.ColorToken.textTertiary)
        }
        .padding(.vertical, MoatTheme.Spacing.small)
        .contentShape(Rectangle())
    }
}
