import SwiftUI

/// Pixel-matched loading placeholders for Financial Profile — Accounts card first,
/// then additional section cards, with Airbnb-style fade-in.
struct FinancialProfileLoadingSkeleton: View {
    private let accountRowCount = 3
    private let extraSectionCount = 2

    var body: some View {
        ScrollView(.vertical, showsIndicators: true) {
            VStack(spacing: MoatTheme.Spacing.large) {
                subtitleSkeleton

                accountsSectionSkeleton

                ForEach(0..<extraSectionCount, id: \.self) { _ in
                    extraSectionSkeleton
                }
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.medium)
            .padding(.bottom, 112)
            .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
        }
        .scrollBounceBehaviorIfAvailable()
        .moatPageBackground()
        .moatSkeletonStaticLayout()
        .moatSkeletonFadeIn()
        .accessibilityLabel("Loading profile")
    }

    private var subtitleSkeleton: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
            MoatSkeleton(height: 14, cornerRadius: 4)
            MoatSkeleton(width: 220, height: 14, cornerRadius: 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, MoatTheme.Spacing.small)
    }

    /// Mirrors `FinancialProfileAccountsSection` + `FinancialProfileSectionCard`.
    private var accountsSectionSkeleton: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            HStack(alignment: .center, spacing: MoatTheme.Spacing.medium) {
                MoatSkeleton(
                    width: 36,
                    height: 36,
                    cornerRadius: MoatTheme.Radius.small
                )
                MoatSkeleton(width: 88, height: 18, cornerRadius: 4)
                trailingAmountSkeleton(width: 52, height: 16)
            }
            .moatSkeletonStaticLayout()

            VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                MoatSkeleton(height: 14, cornerRadius: 4)
                MoatSkeleton(height: 14, cornerRadius: 4)
                MoatSkeleton(width: 200, height: 14, cornerRadius: 4)
            }

            HStack(alignment: .top, spacing: MoatTheme.Spacing.medium) {
                metricSkeleton(labelWidth: 78, valueWidth: 96)
                metricSkeleton(labelWidth: 108, valueWidth: 28)
            }

            institutionGroupSkeleton
                .padding(.top, MoatTheme.Spacing.medium)
        }
        .padding(MoatTheme.Spacing.large)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.large, style: .continuous)
                .stroke(MoatTheme.ColorToken.gray200, lineWidth: 1)
        }
        .shadow(color: MoatTheme.Shadow.soft, radius: 1, x: 0, y: 1)
        .shadow(color: MoatTheme.Shadow.card, radius: 16, x: 0, y: 8)
    }

    private func metricSkeleton(labelWidth: CGFloat, valueWidth: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            MoatSkeleton(width: labelWidth, height: 12, cornerRadius: 4)
            MoatSkeleton(width: valueWidth, height: 17, cornerRadius: 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var institutionGroupSkeleton: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                    MoatSkeleton(width: 110, height: 18, cornerRadius: 4)
                    MoatSkeleton(width: 118, height: 12, cornerRadius: 4)
                }
                MoatSkeleton(width: 28, height: 28, cornerRadius: MoatTheme.Radius.small)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .moatSkeletonStaticLayout()
            }
            .moatSkeletonStaticLayout()

            VStack(spacing: MoatTheme.Spacing.small) {
                ForEach(0..<accountRowCount, id: \.self) { index in
                    accountRowSkeleton(nameWidth: index == 0 ? 96 : (index == 1 ? 120 : 84))
                }
            }
        }
        .padding(MoatTheme.Spacing.medium)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                .stroke(MoatTheme.ColorToken.gray200, lineWidth: 1)
        }
        .shadow(color: MoatTheme.Shadow.soft, radius: 1, x: 0, y: 1)
        .shadow(color: MoatTheme.Shadow.card, radius: 16, x: 0, y: 8)
    }

    /// Matches `FinancialProfileAccountRow` icon, title/subtitle, and balance.
    private func accountRowSkeleton(nameWidth: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            HStack(alignment: .top, spacing: MoatTheme.Spacing.small) {
                MoatSkeleton(
                    width: 28,
                    height: 28,
                    cornerRadius: MoatTheme.Radius.small
                )

                VStack(alignment: .leading, spacing: 2) {
                    MoatSkeleton(width: nameWidth, height: 14, cornerRadius: 4)
                    MoatSkeleton(width: 64, height: 11, cornerRadius: 4)
                }

                trailingAmountSkeleton(width: 64, height: 14)
            }
            .moatSkeletonStaticLayout()

            MoatSkeleton(width: 88, height: 10, cornerRadius: 4)
                .padding(.leading, 36)
        }
        .padding(MoatTheme.Spacing.medium)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                .stroke(MoatTheme.ColorToken.gray200, lineWidth: 1)
        }
    }

    /// Trailing value stays flush-right inside a flexible slot so parent
    /// appear animations cannot slide a Spacer-pushed bar left/right.
    private func trailingAmountSkeleton(width: CGFloat, height: CGFloat) -> some View {
        MoatSkeleton(width: width, height: height, cornerRadius: 4)
            .frame(maxWidth: .infinity, alignment: .trailing)
            .moatSkeletonStaticLayout()
    }

    private var extraSectionSkeleton: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            HStack(alignment: .center, spacing: MoatTheme.Spacing.medium) {
                MoatSkeleton(
                    width: 36,
                    height: 36,
                    cornerRadius: MoatTheme.Radius.small
                )
                MoatSkeleton(width: 72, height: 18, cornerRadius: 4)
                trailingAmountSkeleton(width: 52, height: 16)
            }
            .moatSkeletonStaticLayout()

            VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                MoatSkeleton(height: 14, cornerRadius: 4)
                MoatSkeleton(width: 160, height: 14, cornerRadius: 4)
            }

            MoatSkeleton(height: 88, cornerRadius: MoatTheme.Radius.medium)
        }
        .padding(MoatTheme.Spacing.large)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.large, style: .continuous)
                .stroke(MoatTheme.ColorToken.gray200, lineWidth: 1)
        }
        .shadow(color: MoatTheme.Shadow.soft, radius: 1, x: 0, y: 1)
        .shadow(color: MoatTheme.Shadow.card, radius: 16, x: 0, y: 8)
    }
}

#Preview("Light") {
    NavigationStack {
        FinancialProfileLoadingSkeleton()
            .navigationTitle("Financial Profile")
    }
    .preferredColorScheme(.light)
}

#Preview("Dark") {
    NavigationStack {
        FinancialProfileLoadingSkeleton()
            .navigationTitle("Financial Profile")
    }
    .preferredColorScheme(.dark)
}
