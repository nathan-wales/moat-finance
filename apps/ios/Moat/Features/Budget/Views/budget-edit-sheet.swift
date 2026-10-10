import SwiftUI

struct BudgetEditSheet: View {
    @ObservedObject var viewModel: BudgetViewModel
    let category: BudgetEditingCategory

    @State private var goalText: String
    @State private var isWorking = false
    @State private var errorMessage: String?
    @SwiftUI.Environment(\.dismiss) private var dismiss

    init(viewModel: BudgetViewModel, category: BudgetEditingCategory) {
        self.viewModel = viewModel
        self.category = category
        _goalText = State(
            initialValue: category.monthlyGoal.map { AmountInputFormatter.format($0) } ?? ""
        )
    }

    var body: some View {
        MoatGlassSheet(title: "\(category.categoryName) Budget") {
            Group {
                if viewModel.isDetailLoading && viewModel.selectedDetail == nil {
                    loadingContent
                } else if let detail = viewModel.selectedDetail {
                    loadedContent(detail)
                } else if let loadError = viewModel.detailError {
                    Text(loadError.localizedDescription)
                        .font(.subheadline)
                        .foregroundStyle(MoatTheme.ColorToken.destructive)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    loadingContent
                }
            }
            .task {
                await viewModel.loadDetailIfNeeded()
            }
        } footer: {
            MoatSheetActionBar {
                Button {
                    viewModel.clearEditing()
                    dismiss()
                } label: {
                    Text("Cancel")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatSecondary)
                .disabled(isWorking)

                Button {
                    HapticFeedback.saveOrSubmit()
                    Task { await performSave() }
                } label: {
                    if isWorking {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Save")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.moatPrimary)
                .disabled(isWorking || viewModel.selectedDetail == nil)
            }
        }
    }

    private var loadingContent: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                .fill(MoatTheme.ColorToken.mutedSurface)
                .frame(height: 48)
            RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                .fill(MoatTheme.ColorToken.mutedSurface)
                .frame(height: 128)
            RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                .fill(MoatTheme.ColorToken.mutedSurface)
                .frame(height: 56)
        }
        .redacted(reason: .placeholder)
    }

    private func loadedContent(_ detail: CategoryBudgetDetail) -> some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
            HStack(alignment: .top, spacing: MoatTheme.Spacing.large) {
                BudgetEditStat(
                    label: "Last 6 Mo. Avg",
                    value: CurrencyFormatter.formatCompact(detail.sixMonthAverage)
                )
                BudgetEditStat(
                    label: "Last Month",
                    value: CurrencyFormatter.formatCompact(detail.lastMonthSpend)
                )
            }

            if detail.monthlyTrend.isEmpty {
                Text("No spending history available yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, MoatTheme.Spacing.xLarge)
                    .background(MoatTheme.ColorToken.mutedSurface)
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
            } else {
                BudgetTrendChart(monthlyTrend: detail.monthlyTrend)
            }

            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                Text("Monthly Target")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                monthlyTargetField

                if detail.suggestedBudget > 0 {
                    Button {
                        goalText = AmountInputFormatter.format(detail.suggestedBudget)
                    } label: {
                        Text("Suggested: \(CurrencyFormatter.formatCompact(detail.suggestedBudget))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(MoatTheme.ColorToken.destructive)
            }
        }
    }

    private var monthlyTargetField: some View {
        HStack(spacing: MoatTheme.Spacing.small) {
            Text("$")
                .foregroundStyle(.secondary)
            MoatTextField(
                placeholder: "0",
                text: $goalText,
                keyboardType: .decimalPad,
                formatsGroupedNumber: true
            )
        }
    }

    private func performSave() async {
        guard let goal = AmountInputFormatter.parse(goalText), goal >= 0 else {
            errorMessage = "Enter a valid monthly target."
            return
        }

        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await viewModel.saveBudget(monthlyGoal: goal)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct BudgetEditStat: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.body.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct BudgetTrendChart: View {
    let monthlyTrend: [MonthlySpend]

    private var maxAmount: Double {
        max(monthlyTrend.map(\.amount).max() ?? 0, 1)
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: MoatTheme.Spacing.small) {
            ForEach(monthlyTrend) { spend in
                VStack(spacing: MoatTheme.Spacing.xSmall) {
                    Text(CurrencyFormatter.formatShort(spend.amount))
                        .font(.caption2.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    GeometryReader { proxy in
                        VStack {
                            Spacer(minLength: 0)
                            RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                                .fill(MoatTheme.ColorToken.accent)
                                .frame(height: max(4, proxy.size.height * (spend.amount / maxAmount)))
                        }
                    }
                    .frame(height: 112)
                    Text(DateFormatterProvider.shortMonth(spend.dateValue))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}
