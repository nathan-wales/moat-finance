import SwiftUI

struct InvestmentsView: View {
    @StateObject private var viewModel = InvestmentsViewModel()
    @State private var investmentSheet: InvestmentSheetMode?
    @State private var propertySheet: PropertyIntakeMode?
    @State private var propertyDetailSheet: RealEstateProperty?
    @State private var investmentDetailSheet: InvestmentItem?

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading investments...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Investments")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    investmentSheet = .create
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Add investment")
            }
        }
        .sheet(item: $investmentSheet) { mode in
            InvestmentEditorSheet(
                mode: mode,
                onSave: { type, name, balance, contribution, returnPercent, notes in
                    try await viewModel.saveInvestment(
                        investment: mode.investment,
                        type: type,
                        name: name,
                        startingBalance: balance,
                        monthlyContribution: contribution,
                        returnPercent: returnPercent,
                        notes: notes
                    )
                    investmentSheet = nil
                },
                onDelete: {
                    if let investment = mode.investment {
                        try await viewModel.deleteInvestment(investment)
                    }
                    investmentSheet = nil
                }
            )
        }
        .sheet(item: $propertySheet) { mode in
            PropertyIntakeSheet(
                mode: mode,
                mortgageAccounts: viewModel.mortgageAccountCandidates,
                onSave: { values in
                    try await viewModel.saveProperty(property: mode.property, values: values)
                    propertySheet = nil
                },
                onCancel: { propertySheet = nil },
                onDelete: mode.property == nil ? nil : {
                    let property = mode.property
                    Task {
                        do {
                            if let property {
                                try await viewModel.deleteProperty(property)
                            }
                            propertySheet = nil
                        } catch {
                            viewModel.setActionMessage(
                                title: "Delete failed",
                                message: error.localizedDescription
                            )
                        }
                    }
                },
                onAccountsRefresh: { await viewModel.refresh() }
            )
        }
        .sheet(item: $investmentDetailSheet) { investment in
            InvestmentDetailSheet(
                investment: investment,
                onEdit: {
                    investmentDetailSheet = nil
                    investmentSheet = .edit(investment)
                }
            )
        }
        .sheet(item: $propertyDetailSheet) { property in
            PropertyDetailSheet(
                property: property,
                linkedMortgageAccount: viewModel.linkedAccount(for: property),
                onEdit: {
                    propertyDetailSheet = nil
                    propertySheet = .edit(property)
                },
                onLoadProjection: {
                    try await viewModel.loadProjection(for: property)
                }
            )
        }
        .sheet(item: actionMessageBinding) { message in
            InvestmentActionSheet(message: message) {
                viewModel.clearActionMessage()
            }
        }
        .task {
            await viewModel.load()
        }
    }

    private var actionMessageBinding: Binding<InvestmentActionMessage?> {
        Binding(
            get: { viewModel.actionMessage },
            set: { value in
                if value == nil { viewModel.clearActionMessage() }
            }
        )
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(spacing: MoatTheme.Spacing.large) {
                if let summary = viewModel.summary {
                    InvestmentSummaryCard(summary: summary)
                }

                if let activeScenario = viewModel.activeScenario {
                    InvestmentScenarioCard(scenario: activeScenario)
                }

                if !viewModel.forecast.isEmpty {
                    InvestmentForecastSection(forecast: viewModel.forecast)
                }

                if !viewModel.allocation.sections.isEmpty {
                    AllocationSectionView(sections: viewModel.allocation.sections)
                }

                InvestmentsListSection(
                    investments: viewModel.investments,
                    onAdd: { investmentSheet = .create },
                    onSelect: { investmentDetailSheet = $0 }
                )

                PropertiesListSection(
                    properties: viewModel.properties,
                    onAdd: { propertySheet = .create },
                    onSelect: { propertyDetailSheet = $0 }
                )
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.large)
            .padding(.bottom, 112)
        }
        .moatPageBackground()
        .refreshable { await viewModel.refresh() }
    }
}

private struct InvestmentActionSheet: View {
    let message: InvestmentActionMessage
    let onDismiss: () -> Void

    var body: some View {
        MoatActionResultSheet(
            title: message.title,
            message: message.message,
            onDismiss: onDismiss
        )
    }
}

private struct InvestmentSummaryCard: View {
    let summary: InvestmentSummary

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                    Text("Portfolio")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(CurrencyFormatter.formatCompact(summary.totalCurrentPortfolio))
                        .font(.largeTitle.weight(.bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: MoatTheme.Spacing.medium) {
                    InvestmentMetric(title: "Invested", value: CurrencyFormatter.formatCompact(summary.totalBalance), systemImage: "chart.line.uptrend.xyaxis")
                    InvestmentMetric(title: "Real estate", value: CurrencyFormatter.formatCompact(summary.totalRealEstateEquity), systemImage: "house.fill")
                    InvestmentMetric(title: "Monthly", value: CurrencyFormatter.formatCompact(summary.totalMonthly), systemImage: "calendar.badge.plus")
                    InvestmentMetric(title: "5-year", value: CurrencyFormatter.formatCompact(summary.forecastedPortfolio), systemImage: "sparkles")
                }
            }
        }
    }
}

private struct InvestmentMetric: View {
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
    }
}

private struct InvestmentScenarioCard: View {
    let scenario: ForecastScenario

    var body: some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            Image(systemName: "sparkles")
                .foregroundStyle(MoatTheme.ColorToken.accent)
                .frame(width: 36, height: 36)
                .background(MoatTheme.ColorToken.accent.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text("Active scenario")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("\(scenario.name) forecast uses \(scenario.investmentReturn.scenarioPercentDisplay) returns")
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
            }

            Spacer()
        }
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }
}

private struct InvestmentForecastSection: View {
    let forecast: [InvestmentForecast]

    private var totalPoints: [InvestmentForecastPoint] {
        guard let firstForecast = forecast.first else { return [] }
        return firstForecast.projections.map { point in
            let total = forecast.reduce(0) { sum, item in
                sum + (item.projections.first { $0.month == point.month }?.balance ?? 0)
            }
            return InvestmentForecastPoint(month: point.month, balance: total)
        }
    }

    private var sampledPoints: [InvestmentForecastPoint] {
        let points = totalPoints
        guard points.count > 6 else { return points }
        let step = max(1, points.count / 6)
        let sampled = stride(from: 0, to: points.count, by: step).map { points[$0] }
        return Array(sampled.prefix(6))
    }

    private var maxBalance: Double {
        max(sampledPoints.map(\.balance).max() ?? 0, 1)
    }

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                HStack {
                    Text("Forecast")
                        .font(.headline)
                    Spacer()
                    if let last = totalPoints.last {
                        Text(CurrencyFormatter.formatCompact(last.balance))
                            .font(.subheadline.weight(.semibold))
                    }
                }

                HStack(alignment: .bottom, spacing: MoatTheme.Spacing.small) {
                    ForEach(sampledPoints) { point in
                        VStack(spacing: MoatTheme.Spacing.xSmall) {
                            Text(CurrencyFormatter.formatCompact(point.balance))
                                .font(.caption2.weight(.semibold))
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                            GeometryReader { proxy in
                                VStack {
                                    Spacer(minLength: 0)
                                    RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                                        .fill(MoatTheme.ColorToken.accent)
                                        .frame(height: max(4, proxy.size.height * (point.balance / maxBalance)))
                                }
                            }
                            .frame(height: 112)
                            Text(DateFormatterProvider.shortMonth(point.dateValue))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
    }
}

private struct AllocationSectionView: View {
    let sections: [PortfolioAllocationSection]

    var total: Double { sections.reduce(0) { $0 + $1.value } }

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                Text("Allocation")
                    .font(.headline)

                ForEach(sections) { section in
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                        HStack {
                            Text(section.label)
                                .font(.subheadline.weight(.medium))
                            Spacer()
                            Text(CurrencyFormatter.formatCompact(section.value))
                                .font(.subheadline.weight(.semibold))
                        }

                        GeometryReader { proxy in
                            Capsule()
                                .fill(MoatTheme.ColorToken.elevatedSurface)
                                .overlay(alignment: .leading) {
                                    Capsule()
                                        .fill(MoatTheme.ColorToken.accent)
                                        .frame(width: proxy.size.width * progress(for: section))
                                }
                        }
                        .frame(height: 7)
                    }
                }
            }
        }
    }

    private func progress(for section: PortfolioAllocationSection) -> Double {
        guard total > 0 else { return 0 }
        return min(1, section.value / total)
    }
}

private struct InvestmentsListSection: View {
    let investments: [InvestmentItem]
    let onAdd: () -> Void
    let onSelect: (InvestmentItem) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            sectionHeader(title: "Investments", systemImage: "plus", action: onAdd)

            if investments.isEmpty {
                emptyState("No investments yet")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(investments.enumerated()), id: \.element.id) { index, investment in
                        Button { onSelect(investment) } label: {
                            InvestmentRow(investment: investment)
                        }
                        .buttonStyle(.plain)

                        if index < investments.count - 1 {
                            Divider()
                                .padding(.horizontal, MoatTheme.Spacing.medium)
                        }
                    }
                }
                .moatCard()
            }
        }
    }
}

private struct PropertiesListSection: View {
    let properties: [RealEstateProperty]
    let onAdd: () -> Void
    let onSelect: (RealEstateProperty) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            sectionHeader(title: "Real estate", systemImage: "house.fill", action: onAdd)

            if properties.isEmpty {
                emptyState("No properties yet")
            } else {
                ForEach(properties) { property in
                    Button { onSelect(property) } label: {
                        PropertyRow(property: property)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private func sectionHeader(title: String, systemImage: String, action: @escaping () -> Void) -> some View {
    HStack {
        Text(title)
            .font(.headline)
        Spacer()
        Button(action: action) {
            Image(systemName: systemImage)
        }
        .buttonStyle(.bordered)
        .clipShape(Circle())
    }
}

private func emptyState(_ title: String) -> some View {
    Text(title)
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(MoatTheme.Spacing.large)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
}

private struct InvestmentRow: View {
    let investment: InvestmentItem

    var body: some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            Image(systemName: investment.isPlaidBacked ? "building.columns.fill" : "chart.line.uptrend.xyaxis")
                .foregroundStyle(MoatTheme.ColorToken.accent)
                .frame(width: 38, height: 38)
                .background(MoatTheme.ColorToken.accent.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(investment.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(rowSubtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                Text(CurrencyFormatter.formatCompact(investment.startingBalance))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text("+\(CurrencyFormatter.formatCompact(investment.monthlyContribution))/mo")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(MoatTheme.Spacing.medium)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    private var rowSubtitle: String {
        if investment.isPlaidBacked {
            return [investment.institutionName, investment.accountSubtype?.capitalized]
                .compactMap { $0 }
                .joined(separator: " - ")
        }
        return "\(investment.type.title) - \(formatPercentInput(investment.returnPercent))% return"
    }
}

private struct PropertyRow: View {
    let property: RealEstateProperty

    var body: some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            Image(systemName: "house.fill")
                .foregroundStyle(MoatTheme.ColorToken.accent)
                .frame(width: 38, height: 38)
                .background(MoatTheme.ColorToken.accent.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(property.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text("\(property.propertyType.title) - \(property.usageType.title)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                Text(CurrencyFormatter.formatCompact(property.equity))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(CurrencyFormatter.formatCompact(property.currentEstimatedValue))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }
}

private enum InvestmentSheetMode: Identifiable {
    case create
    case edit(InvestmentItem)

    var id: String {
        switch self {
        case .create: "create-investment"
        case .edit(let investment): investment.id
        }
    }

    var investment: InvestmentItem? {
        if case .edit(let investment) = self { return investment }
        return nil
    }
}

private struct PropertyDetailSheet: View {
    let property: RealEstateProperty
    let linkedMortgageAccount: LinkedPlaidAccountSummary?
    let onEdit: () -> Void
    let onLoadProjection: () async throws -> RealEstateProjection

    @State private var projection: RealEstateProjection?
    @State private var isLoadingProjection = true
    @State private var errorMessage: String?

    var body: some View {
        MoatGlassSheet(title: property.name) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                PropertyDetailSummary(property: property)

                if let linkedMortgageAccount {
                    LinkedMortgageAccountCard(account: linkedMortgageAccount)
                }

                PropertyCashFlowSection(property: property)

                VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                    HStack {
                        Text("Projection")
                            .font(.headline)
                        Spacer()
                        Text(property.forecastScenario?.title ?? "Standard")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    if isLoadingProjection {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, MoatTheme.Spacing.large)
                    } else if let projection {
                        RealEstateProjectionChart(projection: projection)
                    } else if let errorMessage {
                        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(MoatTheme.ColorToken.destructive)
                            Button {
                                Task { await loadProjection() }
                            } label: {
                                Label("Retry", systemImage: "arrow.clockwise")
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }
        } footer: {
            Button(action: onEdit) {
                Label("Edit property", systemImage: "pencil")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.moatPrimary)
        }
        .task { await loadProjection() }
    }

    private func loadProjection() async {
        isLoadingProjection = true
        errorMessage = nil
        defer { isLoadingProjection = false }

        do {
            projection = try await onLoadProjection()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct PropertyDetailSummary: View {
    let property: RealEstateProperty

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            HStack(spacing: MoatTheme.Spacing.medium) {
                InvestmentMetric(title: "Value", value: CurrencyFormatter.formatCompact(property.currentEstimatedValue), systemImage: "house.fill")
                InvestmentMetric(title: "Equity", value: CurrencyFormatter.formatCompact(property.equity), systemImage: "chart.pie.fill")
            }
            HStack(spacing: MoatTheme.Spacing.medium) {
                InvestmentMetric(title: "Loan", value: CurrencyFormatter.formatCompact(property.currentLoanBalance), systemImage: "building.columns.fill")
                InvestmentMetric(title: "Cash flow", value: CurrencyFormatter.formatCompact(property.monthlyCashFlow), systemImage: "arrow.left.arrow.right")
            }
        }
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }
}

private struct LinkedMortgageAccountCard: View {
    let account: LinkedPlaidAccountSummary

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            HStack(spacing: MoatTheme.Spacing.medium) {
                Image(systemName: "link")
                    .foregroundStyle(MoatTheme.ColorToken.accent)
                    .frame(width: 36, height: 36)
                    .background(MoatTheme.ColorToken.accent.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))

                VStack(alignment: .leading, spacing: 2) {
                    Text("Linked mortgage account")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(account.maskedName)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                }

                Spacer()
            }

            DetailLine(title: "Institution", value: account.institutionName)
            DetailLine(title: "Balance", value: CurrencyFormatter.formatCompact(abs(account.balance)))
            DetailLine(title: "Last sync", value: account.lastBalanceSyncAt.map(DateFormatterProvider.fullDate) ?? "Not synced yet")
        }
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }
}

private struct PropertyCashFlowSection: View {
    let property: RealEstateProperty

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            Text("Cash flow")
                .font(.headline)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: MoatTheme.Spacing.medium) {
                DetailMetric(title: "Income", value: CurrencyFormatter.formatCompact(property.totalMonthlyIncome), systemImage: "arrow.down")
                DetailMetric(title: "Mortgage", value: CurrencyFormatter.formatCompact(property.monthlyMortgagePayment ?? 0), systemImage: "building.columns.fill")
                DetailMetric(title: "Expenses", value: CurrencyFormatter.formatCompact(property.effectiveMonthlyExpenses), systemImage: "wrench.and.screwdriver.fill")
                DetailMetric(title: "Net", value: CurrencyFormatter.formatCompact(property.monthlyCashFlow), systemImage: "equal")
            }

            if let interestRate = property.interestRate {
                DetailLine(title: "Interest rate", value: "\(String(format: "%.2f", interestRate * 100))%")
            }
            if let remainingTermMonths = property.remainingTermMonths {
                DetailLine(title: "Remaining term", value: "\(remainingTermMonths) months")
            }
            if let appreciationRate = property.appreciationRate {
                DetailLine(title: "Appreciation", value: "\(String(format: "%.1f", appreciationRate * 100))%")
            }
        }
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.elevatedSurface.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }
}

private struct RealEstateProjectionChart: View {
    let projection: RealEstateProjection

    private var maxEquity: Double {
        max(projection.projections.map(\.equity).max() ?? 0, 1)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            HStack(spacing: MoatTheme.Spacing.small) {
                InvestmentMetric(title: "Final equity", value: CurrencyFormatter.formatCompact(projection.summary.finalEquity), systemImage: "checkmark.seal.fill")
                InvestmentMetric(title: "Appreciation", value: CurrencyFormatter.formatCompact(projection.summary.totalAppreciation), systemImage: "arrow.up.right")
            }

            HStack(alignment: .bottom, spacing: MoatTheme.Spacing.small) {
                ForEach(projection.projections) { point in
                    VStack(spacing: MoatTheme.Spacing.xSmall) {
                        Text(CurrencyFormatter.formatCompact(point.equity))
                            .font(.caption2.weight(.semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        GeometryReader { proxy in
                            VStack {
                                Spacer(minLength: 0)
                                RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                                    .fill(MoatTheme.ColorToken.positive)
                                    .frame(height: max(4, proxy.size.height * (point.equity / maxEquity)))
                            }
                        }
                        .frame(height: 112)
                        Text("Y\(point.year)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }
}

private struct InvestmentEditorSheet: View {
    let mode: InvestmentSheetMode
    let onSave: (InvestmentType, String, Double, Double, Double, String?) async throws -> Void
    let onDelete: () async throws -> Void

    @State private var type: InvestmentType
    @State private var name: String
    @State private var balance: String
    @State private var monthlyContribution: String
    @State private var returnPercent: String
    @State private var notes: String
    @State private var isDeleteConfirmationPresented = false
    @State private var isWorking = false
    @State private var errorMessage: String?

    init(
        mode: InvestmentSheetMode,
        onSave: @escaping (InvestmentType, String, Double, Double, Double, String?) async throws -> Void,
        onDelete: @escaping () async throws -> Void
    ) {
        self.mode = mode
        self.onSave = onSave
        self.onDelete = onDelete
        let investment = mode.investment
        _type = State(initialValue: investment?.type ?? .stocks)
        _name = State(initialValue: investment?.name ?? "")
        _balance = State(initialValue: investment.map { AmountInputFormatter.format($0.startingBalance) } ?? "")
        _monthlyContribution = State(initialValue: investment.map { AmountInputFormatter.format($0.monthlyContribution) } ?? "0")
        _returnPercent = State(initialValue: investment.map { formatPercentInput($0.returnPercent) } ?? "7")
        _notes = State(initialValue: investment?.notes ?? "")
    }

    var body: some View {
        MoatGlassSheet(title: mode.investment == nil ? "Add investment" : "Edit investment") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                    Text("Type")
                        .font(.subheadline.weight(.semibold))
                    Menu {
                        Picker("", selection: $type) {
                            ForEach(InvestmentType.editorCases) { option in
                                Label(option.title, systemImage: option.systemImage)
                                    .tag(option)
                            }
                        }
                        .labelsHidden()
                        .pickerStyle(.inline)
                    } label: {
                        HStack(spacing: MoatTheme.Spacing.small) {
                            Label(type.title, systemImage: type.systemImage)
                                .font(.body)
                                .lineLimit(1)
                                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                            Spacer(minLength: MoatTheme.Spacing.xSmall)
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.caption2)
                                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                        .moatInputFieldStyle(isFocused: false)
                    }
                    .buttonStyle(.plain)
                    .disabled(mode.investment?.isPlaidBacked == true)
                    .accessibilityLabel("Type")
                    .accessibilityValue(type.title)
                }

                VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                    Text("Name")
                        .font(.subheadline.weight(.semibold))
                    MoatTextField(placeholder: "Name", text: $name)
                }

                currencyField("Starting balance", text: $balance)
                    .disabled(mode.investment?.isPlaidBacked == true)
                if mode.investment?.isPlaidBacked == true {
                    Text("Plaid account balances stay synced from the connected institution.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if type != .other {
                    currencyField("Monthly contribution", text: $monthlyContribution)
                }
                percentField("Annual return", text: $returnPercent)
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                    Text("Notes")
                        .font(.subheadline.weight(.semibold))
                    MoatTextEditor(text: $notes, minHeight: 96)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(MoatTheme.ColorToken.destructive)
                }
            }
        } footer: {
            MoatSheetActionBar {
                if mode.investment != nil {
                    Button(role: .destructive) {
                        isDeleteConfirmationPresented = true
                    } label: {
                        Label("Delete", systemImage: "trash").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatDestructive)
                }

                Button {
                    HapticFeedback.saveOrSubmit()
                    Task { await performSave() }
                } label: {
                    if isWorking {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Label("Save", systemImage: "checkmark").frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.moatPrimary)
                .disabled(isWorking)
            }
        }
        .sheet(isPresented: $isDeleteConfirmationPresented) {
            MoatGlassSheet(title: "Delete investment") {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    Text(name.isEmpty ? "Investment" : name)
                        .font(.headline)
                    Text("This removes the manual investment from portfolio totals and forecast charts.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
            } footer: {
                MoatSheetActionBar {
                    Button {
                        isDeleteConfirmationPresented = false
                    } label: {
                        Text("Cancel").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatSecondary)

                    Button(role: .destructive) {
                        Task { await performDelete() }
                    } label: {
                        if isWorking {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Label("Delete", systemImage: "trash").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.moatDestructive)
                    .disabled(isWorking)
                }
            }
        }
    }

    private func performSave() async {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let contributionValue: Double
        if type == .other {
            contributionValue = 0
        } else if let parsedContribution = AmountInputFormatter.parse(monthlyContribution) {
            contributionValue = parsedContribution
        } else {
            errorMessage = "Fill out the investment details."
            return
        }
        guard !trimmedName.isEmpty,
              let balanceValue = AmountInputFormatter.parse(balance),
              let returnValue = AmountInputFormatter.parse(returnPercent)
        else {
            errorMessage = "Fill out the investment details."
            return
        }

        let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onSave(
                type,
                trimmedName,
                balanceValue,
                contributionValue,
                returnValue,
                trimmedNotes.isEmpty ? nil : trimmedNotes
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func performDelete() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onDelete()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private func currencyField(_ title: String, text: Binding<String>) -> some View {
    VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
        Text(title)
            .font(.subheadline.weight(.semibold))
        MoatTextField(placeholder: "0", text: text, keyboardType: .decimalPad, formatsGroupedNumber: true)
    }
}

private func percentField(_ title: String, text: Binding<String>) -> some View {
    VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
        Text(title)
            .font(.subheadline.weight(.semibold))
        MoatTextField(
            placeholder: "0",
            text: text,
            keyboardType: .decimalPad,
            formatsGroupedNumber: true,
            fractionDigits: 2
        )
    }
}

#Preview {
    NavigationStack {
        InvestmentsView()
    }
}
