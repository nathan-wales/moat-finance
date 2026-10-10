import SwiftUI

/// Airbnb-style dashboard loading placeholders that mirror the loaded layout:
/// net worth hero skeletons, then full-width medium widget squares.
struct DashboardLoadingSkeleton: View {
    private let widgetPlaceholderCount = 3

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                netWorthSkeleton
                ForEach(0..<widgetPlaceholderCount, id: \.self) { _ in
                    widgetSquareSkeleton
                }
            }
            .padding()
        }
        .moatPageBackground()
        .moatSkeletonFadeIn()
        .accessibilityLabel("Loading your finances")
    }

    /// Matches `SummaryCardView` spacing, padding, and typography sizes.
    private var netWorthSkeleton: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            MoatSkeleton(width: 78, height: 12, cornerRadius: 4)

            MoatSkeleton(
                width: 236,
                height: 44,
                cornerRadius: MoatTheme.Radius.medium
            )

            HStack(spacing: MoatTheme.Spacing.small) {
                MoatSkeleton(
                    width: 78,
                    height: 26,
                    cornerRadius: MoatTheme.Radius.pill
                )
                MoatSkeleton(
                    width: 118,
                    height: 14,
                    cornerRadius: 4
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, MoatTheme.Spacing.small)
        .padding(.vertical, MoatTheme.Spacing.medium)
    }

    private var widgetSquareSkeleton: some View {
        MoatSkeleton(height: nil, cornerRadius: MoatTheme.Radius.large)
            .aspectRatio(1.1, contentMode: .fit)
            .frame(maxWidth: .infinity)
    }
}

#Preview("Light") {
    DashboardLoadingSkeleton()
        .preferredColorScheme(.light)
}

#Preview("Dark") {
    DashboardLoadingSkeleton()
        .preferredColorScheme(.dark)
}
