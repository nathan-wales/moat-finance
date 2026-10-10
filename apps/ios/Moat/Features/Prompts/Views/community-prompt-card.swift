import SwiftUI

struct CommunityPromptCardView: View {
    let prompt: CommunityPromptSummary

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            HStack {
                Text(prompt.title)
                    .font(.headline)
                    .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                    .padding(.trailing, MoatTheme.Spacing.xLarge)
                Spacer()
                CommunityReviewedBadge()
            }

            if let description = prompt.description, !description.isEmpty {
                Text(description)
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .lineLimit(2)
            }

            Text("By \(prompt.creatorDisplayName)")
                .font(.caption)
                .foregroundStyle(MoatTheme.ColorToken.textTertiary)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: MoatTheme.Spacing.xSmall) {
                    ForEach(prompt.tags, id: \.self) { tag in
                        Text(tag)
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(MoatTheme.ColorToken.elevatedSurface)
                            .clipShape(Capsule())
                    }
                }
            }

            Text(prompt.launchCount == 1 ? "1 launch" : "\(prompt.launchCount) launches")
                .font(.caption)
                .foregroundStyle(MoatTheme.ColorToken.textTertiary)
        }
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.large, style: .continuous))
    }
}

struct UserPromptCardView: View {
    let prompt: UserPromptSummary

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            HStack {
                Text(prompt.title)
                    .font(.headline)
                    .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                    .padding(.trailing, MoatTheme.Spacing.xLarge)
                Spacer()
                PromptStatusBadge(
                    reviewStatus: prompt.reviewStatus,
                    visibility: prompt.visibility
                )
            }

            if let description = prompt.description, !description.isEmpty {
                Text(description)
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .lineLimit(2)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: MoatTheme.Spacing.xSmall) {
                    ForEach(prompt.tags, id: \.self) { tag in
                        Text(tag)
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(MoatTheme.ColorToken.elevatedSurface)
                            .clipShape(Capsule())
                    }
                }
            }

            Text(prompt.launchCount == 1 ? "1 launch" : "\(prompt.launchCount) launches")
                .font(.caption)
                .foregroundStyle(MoatTheme.ColorToken.textTertiary)
        }
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.large, style: .continuous))
    }
}
