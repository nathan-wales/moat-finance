import SwiftUI

struct InvestmentDetailSheet: View {
    let investment: InvestmentItem
    let historyAccountId: String?
    let showsHistory: Bool
    let onEdit: () -> Void

    init(
        investment: InvestmentItem,
        historyAccountId: String? = nil,
        showsHistory: Bool = false,
        onEdit: @escaping () -> Void
    ) {
        self.investment = investment
        self.historyAccountId = historyAccountId
        self.showsHistory = showsHistory
        self.onEdit = onEdit
    }

    var body: some View {
        MoatGlassSheet(title: investment.name) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                if showsHistory, let historyAccountId {
                    AccountHistoryChartView(
                        accountId: historyAccountId,
                        fallbackBalance: investment.startingBalance
                    )
                }

                HStack(spacing: MoatTheme.Spacing.medium) {
                    Image(systemName: investment.isPlaidBacked ? "building.columns.fill" : "chart.line.uptrend.xyaxis")
                        .font(.title2)
                        .foregroundStyle(MoatTheme.ColorToken.accent)
                        .frame(width: 46, height: 46)
                        .background(MoatTheme.ColorToken.accent.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))

                    VStack(alignment: .leading, spacing: 3) {
                        Text(investment.isPlaidBacked ? "Plaid investment account" : "Manual investment")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if !showsHistory {
                            Text(CurrencyFormatter.formatCompact(investment.startingBalance))
                                .font(.largeTitle.weight(.bold))
                                .lineLimit(1)
                                .minimumScaleFactor(0.75)
                        } else {
                            Text(investment.type.title)
                                .font(.headline)
                        }
                    }
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: MoatTheme.Spacing.medium) {
                    DetailMetric(title: "Type", value: investment.type.title, systemImage: "chart.pie.fill")
                    DetailMetric(title: "Monthly", value: CurrencyFormatter.formatCompact(investment.monthlyContribution), systemImage: "calendar.badge.plus")
                    DetailMetric(title: "Return", value: formatPercent(investment.returnPercent), systemImage: "percent")
                    DetailMetric(title: "Source", value: investment.isPlaidBacked ? "Plaid" : "Manual", systemImage: investment.isPlaidBacked ? "link" : "pencil")
                }

                if investment.isPlaidBacked {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                        Text("Account details")
                            .font(.headline)
                        DetailLine(title: "Institution", value: investment.institutionName ?? "Connected account")
                        DetailLine(title: "Subtype", value: investment.accountSubtype?.capitalized ?? "Investment")
                        DetailLine(title: "Mask", value: investment.accountMask.map { "...\($0)" } ?? "Not reported")
                        DetailLine(title: "Last balance sync", value: investment.lastBalanceSyncAt.map(DateFormatterProvider.fullDate) ?? "Not synced yet")
                    }
                    .padding(MoatTheme.Spacing.medium)
                    .background(MoatTheme.ColorToken.surface)
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
                }

                if let notes = investment.notes?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !notes.isEmpty {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                        Text("Notes")
                            .font(.subheadline.weight(.semibold))
                        Text(notes)
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(MoatTheme.Spacing.medium)
                    .background(MoatTheme.ColorToken.surface)
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
                }
            }
        } footer: {
            Button(action: onEdit) {
                Label(investment.isPlaidBacked ? "Edit forecast assumptions" : "Edit investment", systemImage: "slider.horizontal.3")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.moatPrimary)
        }
        .presentationDetents([.large])
    }
}

struct DetailMetric: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        HStack(spacing: MoatTheme.Spacing.small) {
            Image(systemName: systemImage)
                .foregroundStyle(MoatTheme.ColorToken.accent)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }
}

struct DetailLine: View {
    let title: String
    let value: String

    var body: some View {
        HStack(alignment: .top) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.caption.weight(.semibold))
                .multilineTextAlignment(.trailing)
        }
    }
}
