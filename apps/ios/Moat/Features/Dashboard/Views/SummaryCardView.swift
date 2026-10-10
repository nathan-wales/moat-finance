import SwiftUI

/// The net worth hero — sits directly on the page background for an open, editorial feel.
struct SummaryCardView: View {

    let summary: DashboardSummary

    private var changeColor: Color {
        summary.isPositiveChange
            ? MoatTheme.ColorToken.positive
            : MoatTheme.ColorToken.destructive
    }

    private var changeBackground: Color {
        summary.isPositiveChange
            ? MoatTheme.ColorToken.positiveSoft
            : MoatTheme.ColorToken.destructiveSoft
    }

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            Text("Net Worth")
                .font(.footnote.weight(.medium))
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .textCase(.uppercase)
                .kerning(0.8)

            Text(CurrencyFormatter.format(summary.currentNetWorth))
                .font(.system(size: 44, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                .contentTransition(.numericText())

            HStack(spacing: MoatTheme.Spacing.small) {
                HStack(spacing: 4) {
                    Image(systemName: summary.isPositiveChange ? "arrow.up.right" : "arrow.down.right")
                        .font(.caption2.weight(.bold))
                    Text(summary.formattedAbsoluteChange)
                        .font(.footnote.weight(.semibold))
                        .monospacedDigit()
                }
                .foregroundStyle(changeColor)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(changeBackground)
                .clipShape(Capsule())

                Text("\(summary.formattedPercentChange) this month")
                    .font(.footnote)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, MoatTheme.Spacing.small)
        .padding(.vertical, MoatTheme.Spacing.medium)
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        SummaryCardView(
            summary: DashboardSummary(
                currentNetWorth: 145250.50,
                previousNetWorth: 140000,
                percentChange: 3.75,
                absoluteChange: 5250.50,
                dataPoints: []
            )
        )

        SummaryCardView(
            summary: DashboardSummary(
                currentNetWorth: 98000,
                previousNetWorth: 100000,
                percentChange: -2.0,
                absoluteChange: -2000,
                dataPoints: []
            )
        )
    }
    .padding()
    .frame(maxHeight: .infinity)
    .moatPageBackground()
}
