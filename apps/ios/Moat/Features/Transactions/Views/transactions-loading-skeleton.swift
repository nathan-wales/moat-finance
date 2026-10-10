import SwiftUI

/// Pixel-matched loading placeholders for Transactions — summary grid, filter chips,
/// and list rows — with Airbnb-style fade-in.
struct TransactionsLoadingSkeleton: View {
    private let rowCount = 7

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                summaryGridSkeleton
                    .padding(.horizontal, MoatTheme.Spacing.large)
                    .padding(.top, MoatTheme.Spacing.large)

                filterChipsSkeleton
                    .padding(.horizontal, MoatTheme.Spacing.large)
                    .padding(.top, MoatTheme.Spacing.medium)
                    .padding(.bottom, MoatTheme.Spacing.small)

                transactionListSkeleton
            }
            .padding(.bottom, 112)
        }
        .moatPageBackground()
        .moatSkeletonStaticLayout()
        .moatSkeletonFadeIn()
        .accessibilityLabel("Loading transactions")
    }

    /// Matches `TransactionsSummaryGrid` / `MetricTile` layout.
    private var summaryGridSkeleton: some View {
        LazyVGrid(
            columns: [GridItem(.flexible()), GridItem(.flexible())],
            spacing: MoatTheme.Spacing.medium
        ) {
            ForEach(0..<4, id: \.self) { index in
                metricTileSkeleton(valueWidth: index == 3 ? 48 : 88)
            }
        }
    }

    private func metricTileSkeleton(valueWidth: CGFloat) -> some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                MoatSkeletonCircle(size: 24)
                MoatSkeleton(width: valueWidth, height: 22, cornerRadius: 4)
                MoatSkeleton(width: 52, height: 12, cornerRadius: 4)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var filterChipsSkeleton: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: MoatTheme.Spacing.small) {
                MoatSkeleton(width: 92, height: 32, cornerRadius: MoatTheme.Radius.pill)
                MoatSkeleton(width: 100, height: 32, cornerRadius: MoatTheme.Radius.pill)
                MoatSkeleton(width: 90, height: 32, cornerRadius: MoatTheme.Radius.pill)
                MoatSkeleton(width: 108, height: 32, cornerRadius: MoatTheme.Radius.pill)
                MoatSkeleton(width: 84, height: 32, cornerRadius: MoatTheme.Radius.pill)
            }
        }
    }

    private var transactionListSkeleton: some View {
        VStack(spacing: 0) {
            dayBandSkeleton(titleWidth: 120, amountWidth: 64)

            ForEach(0..<rowCount, id: \.self) { index in
                if index == 4 {
                    dayBandSkeleton(titleWidth: 108, amountWidth: 56)
                }

                transactionRowSkeleton(
                    titleWidth: index % 3 == 0 ? 128 : (index % 3 == 1 ? 96 : 112),
                    amountWidth: index % 2 == 0 ? 72 : 84
                )

                if index < rowCount - 1 && index != 3 {
                    Divider()
                        .padding(.horizontal, MoatTheme.Spacing.medium)
                }
            }
        }
        .background(MoatTheme.ColorToken.surface)
    }

    /// Matches chronological `TransactionDayBand` rows inside the card list.
    private func dayBandSkeleton(titleWidth: CGFloat, amountWidth: CGFloat) -> some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            MoatSkeleton(width: titleWidth, height: 14, cornerRadius: 4)
            trailingAmountSkeleton(width: amountWidth, height: 14)
        }
        .padding(.horizontal, MoatTheme.Spacing.medium)
        .padding(.vertical, MoatTheme.Spacing.small)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MoatTheme.ColorToken.appBackground)
        .moatSkeletonStaticLayout()
    }

    /// Matches chronological `TransactionRow` — circular type icon, title, category pill, amount.
    private func transactionRowSkeleton(titleWidth: CGFloat, amountWidth: CGFloat) -> some View {
        HStack(alignment: .center, spacing: MoatTheme.Spacing.medium) {
            MoatSkeletonCircle(size: 38)

            VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                HStack(alignment: .center, spacing: MoatTheme.Spacing.medium) {
                    MoatSkeleton(width: titleWidth, height: 14, cornerRadius: 4)
                    trailingAmountSkeleton(width: amountWidth, height: 14)
                }

                MoatSkeleton(width: 72, height: 20, cornerRadius: MoatTheme.Radius.pill)
            }
            .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, MoatTheme.Spacing.medium)
        .padding(.vertical, MoatTheme.Spacing.medium + 1)
        .frame(maxWidth: .infinity, alignment: .leading)
        .moatSkeletonStaticLayout()
    }

    /// Trailing amount stays flush-right inside a flexible slot so parent
    /// appear animations cannot slide a Spacer-pushed bar left/right.
    private func trailingAmountSkeleton(width: CGFloat, height: CGFloat) -> some View {
        MoatSkeleton(width: width, height: height, cornerRadius: 4)
            .frame(maxWidth: .infinity, alignment: .trailing)
            .moatSkeletonStaticLayout()
    }
}

#Preview("Light") {
    NavigationStack {
        TransactionsLoadingSkeleton()
            .navigationTitle("Transactions")
    }
    .preferredColorScheme(.light)
}

#Preview("Dark") {
    NavigationStack {
        TransactionsLoadingSkeleton()
            .navigationTitle("Transactions")
    }
    .preferredColorScheme(.dark)
}
