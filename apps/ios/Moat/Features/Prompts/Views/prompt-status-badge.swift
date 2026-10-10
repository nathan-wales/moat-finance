import SwiftUI

struct PromptStatusBadge: View {
    let reviewStatus: PromptReviewStatus
    let visibility: PromptVisibility

    private var label: String {
        if reviewStatus == .approved && visibility == .public {
            return "Published"
        }
        return reviewStatus.badgeLabel
    }

    private var color: Color {
        switch reviewStatus {
        case .rejected:
            return .red
        case .pending, .changesRequested:
            return MoatTheme.ColorToken.textSecondary
        case .approved:
            return MoatTheme.ColorToken.accent
        case .notSubmitted:
            return MoatTheme.ColorToken.textSecondary
        }
    }

    var body: some View {
        Text(label)
            .font(.caption.weight(.medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

struct CommunityReviewedBadge: View {
    var body: some View {
        Text("Reviewed by Moat")
            .font(.caption.weight(.medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(MoatTheme.ColorToken.accent.opacity(0.15))
            .foregroundStyle(MoatTheme.ColorToken.accent)
            .clipShape(Capsule())
    }
}
