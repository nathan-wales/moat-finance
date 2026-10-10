import SwiftUI

struct RetirementWhatIfSection: View {
    let suggestions: [RetirementSuggestedLever]
    let draftLevers: [RetirementLeverInput]
    let projection: RetirementProjectionResponse?
    let onAdd: (RetirementLever) -> Void
    let onRemove: (String) -> Void
    let onEdit: (RetirementLeverInput) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
            if !suggestions.isEmpty {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                    Text("Suggested changes")
                        .font(.headline)
                    ForEach(suggestions.prefix(6)) { suggestion in
                        MoatCard {
                            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                                Text(suggestion.title)
                                    .font(.subheadline.weight(.semibold))
                                Text(suggestion.detail)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Button("Try it") {
                                    onAdd(suggestion.lever)
                                }
                                .buttonStyle(.moatPrimaryCompact)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }

            RetirementLeverStackView(
                levers: draftLevers,
                onRemove: onRemove,
                onEdit: onEdit
            )

            if let baseline = projection?.baseline, let whatIf = projection?.projection {
                MoatCard {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("Impact")
                            .font(.headline)
                        impactRow("Confidence", RetirementCurrency.percent(baseline.summary.confidence), RetirementCurrency.percent(whatIf.summary.confidence))
                        impactRow("Safe spending", RetirementCurrency.monthly(baseline.summary.safeMonthlySpending), RetirementCurrency.monthly(whatIf.summary.safeMonthlySpending))
                        impactRow("Earliest", RetirementCurrency.age(baseline.summary.earliestSustainableAge), RetirementCurrency.age(whatIf.summary.earliestSustainableAge))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func impactRow(_ title: String, _ before: String, _ after: String) -> some View {
        HStack {
            Text(title)
                .font(.subheadline)
            Spacer()
            Text(before)
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)
            Text("→")
                .foregroundStyle(.secondary)
            Text(after)
                .font(.subheadline.monospacedDigit().weight(.semibold))
        }
    }
}
