import SwiftUI

struct RetirementMetricStrip: View {
    let summary: RetirementProjectionSummary
    let baseline: RetirementProjectionSummary?

    var body: some View {
        MoatCard {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: MoatTheme.Spacing.medium) {
                metric(
                    "Confidence",
                    RetirementCurrency.percent(summary.confidence),
                    today: "At age \(Int(summary.retirementAgeUsed.rounded()))",
                    baseline: baseline.map { RetirementCurrency.percent($0.confidence) }
                )
                metric(
                    "Earliest",
                    RetirementCurrency.age(summary.earliestSustainableAge),
                    today: "Average path, not a success probability",
                    baseline: baseline.map { RetirementCurrency.age($0.earliestSustainableAge) }
                )
                metric(
                    "Safe spending",
                    RetirementCurrency.monthly(summary.safeMonthlySpending),
                    baseline: baseline.map { RetirementCurrency.monthly($0.safeMonthlySpending) }
                )
                metric(
                    "Investable at retirement",
                    RetirementCurrency.money(summary.assetsAtRetirement),
                    today: todayDollarsLabel(summary.assetsAtRetirementTodayDollars),
                    baseline: baseline.map { RetirementCurrency.money($0.assetsAtRetirement) }
                )
                metric(
                    "Legacy",
                    RetirementCurrency.money(summary.legacyAtLongevity),
                    today: todayDollarsLabel(summary.legacyAtLongevityTodayDollars),
                    baseline: baseline.map { RetirementCurrency.money($0.legacyAtLongevity) }
                )
            }
        }
    }

    private func metric(_ title: String, _ value: String, today: String? = nil, baseline: String?) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.headline.monospacedDigit())
            if let today, !today.isEmpty {
                Text(today)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let baseline, baseline != value {
                Text("was \(baseline)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func todayDollarsLabel(_ value: Double?) -> String? {
        guard let value else { return nil }
        return "≈ \(RetirementCurrency.money(value)) in today's dollars"
    }
}
