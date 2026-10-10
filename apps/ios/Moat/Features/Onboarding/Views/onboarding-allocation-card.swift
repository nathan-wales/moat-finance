import SwiftUI

struct OnboardingAllocationCard: View {
    let sections: [DashboardPortfolioAllocationSection]
    let total: Double
    let isLoading: Bool

    private var isEmpty: Bool {
        sections.isEmpty || total <= 0
    }

    var body: some View {
        if isEmpty {
            emptyCard
        } else {
            PortfolioAllocationChartView(
                sections: sections,
                total: total,
                borderColor: MoatTheme.ColorToken.gray200
            )
        }
    }

    private var emptyCard: some View {
        MoatCard(borderColor: MoatTheme.ColorToken.gray200) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                HStack {
                    Text("Portfolio allocation")
                        .font(.headline)

                    Spacer()

                    if isLoading {
                        ProgressView()
                            .controlSize(.small)
                    }
                }

                Text("Connect accounts to see your allocation.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .fill(MoatTheme.ColorToken.chartMuted.opacity(0.6))
                    .frame(height: 22)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
