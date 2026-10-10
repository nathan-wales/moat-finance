import SwiftUI

struct CategoryBudgetsCard: View {
    let categories: [CategoryBudgetRow]
    let reportingPeriod: BudgetReportingPeriod
    let onEdit: (CategoryBudgetRow) -> Void

    @AppStorage(CategoryViewStorageKey.budget) private var viewRaw = CategoryViewMode.category.rawValue
    @State private var showAllCategories = false

    private var isParentView: Bool {
        viewRaw == CategoryViewMode.parent.rawValue
    }

    private var categoriesWithActivity: [CategoryBudgetRow] {
        categories.filter { $0.monthlyGoal != nil || $0.spentThisMonth > 0 }
    }

    private var unusedCategories: [CategoryBudgetRow] {
        categories
            .filter { $0.monthlyGoal == nil && $0.spentThisMonth == 0 }
            .sorted {
                $0.categoryName.localizedStandardCompare($1.categoryName) == .orderedAscending
            }
    }

    private var visibleCategories: [CategoryBudgetRow] {
        if showAllCategories {
            return categoriesWithActivity + unusedCategories
        }
        return categoriesWithActivity
    }

    private var tableRows: [BudgetDisplayRow] {
        if isParentView {
            return rollupBudgetByParent(rows: categories)
        }
        return visibleCategories.map { category in
            BudgetDisplayRow(
                id: category.categoryId,
                name: category.categoryName,
                spentThisMonth: category.spentThisMonth,
                monthlyGoal: category.monthlyGoal,
                status: category.status,
                categoryNames: [category.categoryName],
                canEditBudget: true,
                sourceCategory: category
            )
        }
    }

    private var showAllButtonLabel: String {
        showAllCategories ? "Show fewer" : "Show all categories"
    }

    private var isEmpty: Bool {
        isParentView ? categories.isEmpty : visibleCategories.isEmpty
    }

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .center, spacing: MoatTheme.Spacing.medium) {
                    Text("Category Budgets")
                        .font(.headline)
                    Spacer()
                    CategoryViewPicker(selection: $viewRaw)
                }
                .padding(.bottom, MoatTheme.Spacing.medium)

                if isEmpty {
                    emptyState
                } else {
                    ForEach(Array(tableRows.enumerated()), id: \.element.id) { index, row in
                        CategoryBudgetRowView(
                            row: row,
                            reportingPeriod: reportingPeriod,
                            onEdit: {
                                if let source = row.sourceCategory {
                                    onEdit(source)
                                }
                            }
                        )

                        if index < tableRows.count - 1 {
                            Divider()
                                .padding(.vertical, MoatTheme.Spacing.small)
                        }
                    }
                }

                if !isParentView, !unusedCategories.isEmpty {
                    Divider()
                        .padding(.top, MoatTheme.Spacing.medium)
                    Button(showAllButtonLabel) {
                        showAllCategories.toggle()
                    }
                    .font(.subheadline.weight(.medium))
                    .frame(maxWidth: .infinity)
                    .padding(.top, MoatTheme.Spacing.medium)
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: MoatTheme.Spacing.small) {
            Text("No budgets set yet")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)
            Text("Set budgets to start tracking your spending by category.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, MoatTheme.Spacing.xxLarge)
    }
}

private struct CategoryBudgetRowView: View {
    let row: BudgetDisplayRow
    let reportingPeriod: BudgetReportingPeriod
    let onEdit: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: MoatTheme.Spacing.medium) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                Text(row.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)

                HStack(spacing: MoatTheme.Spacing.xSmall) {
                    spentLink
                    Text("/")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    budgetAction
                }
            }

            Spacer(minLength: MoatTheme.Spacing.small)

            Text(row.status.title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(row.status.color)
                .padding(.horizontal, MoatTheme.Spacing.medium)
                .padding(.vertical, MoatTheme.Spacing.small)
                .background(row.status.color.opacity(0.12))
                .clipShape(Capsule())
        }
        .padding(.vertical, MoatTheme.Spacing.small)
    }

    @ViewBuilder
    private var spentLink: some View {
        if row.categoryNames.isEmpty {
            Text(CurrencyFormatter.formatCompact(row.spentThisMonth))
                .font(.subheadline)
                .foregroundStyle(.primary)
        } else if let startDate = reportingPeriod.startDateValue,
                  let endDate = reportingPeriod.endDateValue {
            NavigationLink {
                TransactionsView(
                    initialFilters: spentFilters(startDate: startDate, endDate: endDate),
                    title: row.name
                )
            } label: {
                HStack(spacing: 2) {
                    Text(CurrencyFormatter.formatCompact(row.spentThisMonth))
                    Image(systemName: "arrow.up.right")
                        .font(.caption2.weight(.semibold))
                }
                .font(.subheadline)
                .foregroundStyle(.primary)
            }
            .buttonStyle(.plain)
        } else {
            Text(CurrencyFormatter.formatCompact(row.spentThisMonth))
                .font(.subheadline)
                .foregroundStyle(.primary)
        }
    }

    private func spentFilters(startDate: Date, endDate: Date) -> TransactionFilterState {
        if row.categoryNames.count == 1, let category = row.categoryNames.first {
            return TransactionFilterState(
                category: category,
                type: .expense,
                startDate: startDate,
                endDate: endDate
            )
        }
        return TransactionFilterState(
            categories: row.categoryNames,
            type: .expense,
            startDate: startDate,
            endDate: endDate
        )
    }

    @ViewBuilder
    private var budgetAction: some View {
        if row.canEditBudget {
            if let monthlyGoal = row.monthlyGoal {
                Button(action: onEdit) {
                    HStack(spacing: 2) {
                        Text(CurrencyFormatter.formatCompact(monthlyGoal))
                        Image(systemName: "pencil")
                            .font(.caption2.weight(.semibold))
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            } else {
                Button("Set", action: onEdit)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(MoatTheme.ColorToken.accent)
                    .buttonStyle(.plain)
            }
        } else if let monthlyGoal = row.monthlyGoal {
            Text(CurrencyFormatter.formatCompact(monthlyGoal))
                .font(.subheadline)
                .foregroundStyle(.secondary)
        } else {
            Text("—")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}
