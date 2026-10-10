import SwiftUI

struct TaxesUnavailableView: View {
    var body: some View {
        ErrorStateView(
            title: "Taxes isn't available yet",
            message: "This workspace is parked for now. Filing status and planning rates still live in Financial Profile."
        )
        .navigationTitle("Taxes")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct TaxesView: View {
    @StateObject private var viewModel = TaxesViewModel()

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading taxes...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Taxes")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(spacing: MoatTheme.Spacing.large) {
                yearPicker
                Picker("Taxes tab", selection: tabBinding) {
                    ForEach(TaxesTab.allCases) { tab in
                        Text(tab.title).tag(tab)
                    }
                }
                .pickerStyle(.segmented)

                tabContent
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.large)
            .padding(.bottom, 112)
        }
        .moatPageBackground()
        .refreshable { await viewModel.refresh() }
        .alert("Taxes", isPresented: actionErrorBinding) {
            Button("OK", role: .cancel) { viewModel.actionError = nil }
        } message: {
            Text(viewModel.actionError ?? "Something went wrong.")
        }
    }

    private var actionErrorBinding: Binding<Bool> {
        Binding(
            get: { viewModel.actionError != nil },
            set: { if $0 == false { viewModel.actionError = nil } }
        )
    }

    private var yearPicker: some View {
        let current = viewModel.years?.defaultYear ?? viewModel.taxYear
        let fromApi = viewModel.years?.years.map(\.taxYear) ?? []
        let options = Array(Set([viewModel.taxYear, current, current - 1, current - 2] + fromApi)).sorted(by: >)
        return Picker("Tax year", selection: yearBinding) {
            ForEach(options, id: \.self) { year in
                Text(String(year)).tag(year)
            }
        }
        .pickerStyle(.menu)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var yearBinding: Binding<Int> {
        Binding(
            get: { viewModel.taxYear },
            set: { viewModel.changeYear($0) }
        )
    }

    private var tabBinding: Binding<TaxesTab> {
        Binding(
            get: { viewModel.selectedTab },
            set: { viewModel.changeTab($0) }
        )
    }

    @ViewBuilder
    private var tabContent: some View {
        switch viewModel.selectedTab {
        case .overview:
            overviewContent
        case .documents:
            documentsContent
        case .details:
            detailsContent
        }
    }

    @ViewBuilder
    private var overviewContent: some View {
        if let overview = viewModel.overview {
            if overview.hasAnyDocuments == false && overview.hasAnyFacts == false {
                MoatCard {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("Taxes for \(overview.taxYear)")
                            .font(.headline)
                        Text("Moat can start from the accounts and transactions you already have. Upload a W-2 or 1099 on web or desktop to turn that into confirmed tax facts.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                MoatCard {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("Estimated readiness")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text("\(Int(overview.readiness.score.rounded()))% ready")
                            .font(.title2.bold())
                        ProgressView(value: overview.readiness.score, total: 100)
                        Text(overview.readiness.formula)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                MoatCard {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                        metricRow("Documents", "\(overview.documentsPresent) of \(overview.documentsExpected)")
                        metricRow("Income identified", CurrencyFormatter.formatCompact(overview.incomeIdentified))
                        metricRow("Withheld", CurrencyFormatter.formatCompact(overview.taxesWithheld))
                        metricRow("Confirmed deductions", CurrencyFormatter.formatCompact(overview.confirmedDeductions))
                        metricRow("Potential deductions", CurrencyFormatter.formatCompact(overview.potentialDeductions))
                        metricRow("Capital gains/losses", CurrencyFormatter.formatCompact(overview.capitalGains))
                    }
                }

                MoatCard {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                        Text("Estimated result")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text(overview.estimate.label)
                            .font(.headline)
                        if let amount = overview.estimate.amount, overview.estimate.direction != "insufficient" {
                            Text(CurrencyFormatter.formatCompact(amount))
                                .font(.title3.bold())
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button("Edit planning taxes") {
                    AppNavigationCoordinator.shared.openFinancialProfile()
                }
                .buttonStyle(.bordered)

                if overview.attention.isEmpty == false {
                    MoatCard {
                        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                            Text("Needs attention")
                                .font(.headline)
                            ForEach(overview.attention) { item in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.title)
                                        .font(.subheadline.weight(.semibold))
                                    Text(item.detail)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        }
    }

    private var documentsContent: some View {
        Group {
            if viewModel.documents.isEmpty {
                MoatCard {
                    Text("No tax documents uploaded for \(viewModel.taxYear) yet.")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                ForEach(viewModel.documents) { document in
                    NavigationLink {
                        TaxDocumentDetailView(viewModel: viewModel, documentId: document.id)
                    } label: {
                        MoatCard {
                            VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                                Text(document.formType ?? document.documentCategory)
                                    .font(.headline)
                                if let issuer = document.issuer {
                                    Text(issuer)
                                        .font(.subheadline)
                                }
                                Text("\(document.taxYear) · \(processingLabel(document.processingState)) · \(document.factCount) facts")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var detailsContent: some View {
        Group {
            if viewModel.facts.isEmpty {
                MoatCard {
                    Text("No tax facts for \(viewModel.taxYear) yet.")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                ForEach(viewModel.facts) { fact in
                    MoatCard {
                        VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                            Text(fact.type)
                                .font(.headline)
                            Text(fact.value.display)
                                .font(.title3.bold())
                            Text(provenanceCopy(fact))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(fact.status)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        }
    }

    private func metricRow(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
        }
        .font(.subheadline)
    }

    private func provenanceCopy(_ fact: TaxFact) -> String {
        let form = fact.sourceForm ?? fact.sourceType
        if let box = fact.sourceBox {
            return "\(form) box \(box) · \(fact.status)"
        }
        return "\(form) · \(fact.status)"
    }
}

private func processingLabel(_ state: String) -> String {
    switch state {
    case "complete": return "Processed"
    case "needs_review": return "Needs review"
    case "failed": return "Failed"
    case "processing", "parsed": return "Processing"
    default: return "Uploaded"
    }
}

private struct TaxDocumentDetailView: View {
    @ObservedObject var viewModel: TaxesViewModel
    let documentId: String

    var body: some View {
        Group {
            if let document = viewModel.selectedDocument, document.id == documentId {
                ScrollView {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                        MoatCard {
                            VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                                Text(document.formType ?? document.documentCategory)
                                    .font(.headline)
                                if let issuer = document.issuer {
                                    Text(issuer)
                                        .font(.subheadline)
                                }
                                Text("\(document.taxYear) · \(processingLabel(document.processingState))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                if document.processingState == "failed" {
                                    Text(document.failureReason ?? "Processing failed")
                                        .font(.subheadline)
                                        .foregroundStyle(.red)
                                    Button("Retry") {
                                        Task { await viewModel.retrySelectedDocument() }
                                    }
                                    .buttonStyle(.bordered)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        ForEach(document.facts) { fact in
                            MoatCard {
                                VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                                    Text(fact.type)
                                        .font(.headline)
                                    Text(fact.value.display)
                                        .font(.title3.bold())
                                    Text(provenanceCopy(fact))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    if fact.status == "candidate" || fact.status == "extracted" {
                                        HStack {
                                            Button("Confirm") {
                                                Task { await viewModel.confirmFact(id: fact.id, confirmed: true) }
                                            }
                                            .buttonStyle(.bordered)
                                            Button("Reject") {
                                                Task { await viewModel.confirmFact(id: fact.id, confirmed: false) }
                                            }
                                            .buttonStyle(.bordered)
                                        }
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                    }
                    .padding(.horizontal, MoatTheme.Spacing.large)
                    .padding(.vertical, MoatTheme.Spacing.large)
                }
            } else if viewModel.documentLoadFailed {
                ErrorStateView(
                    title: "Couldn't load document",
                    message: "Try again to open this tax document."
                ) {
                    Task { await viewModel.openDocument(id: documentId) }
                }
            } else {
                LoadingView("Loading document...")
            }
        }
        .navigationTitle("Document")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.openDocument(id: documentId)
        }
    }

    private func provenanceCopy(_ fact: TaxFact) -> String {
        let form = fact.sourceForm ?? fact.sourceType
        if let box = fact.sourceBox {
            return "\(form) box \(box) · \(fact.status)"
        }
        return "\(form) · \(fact.status)"
    }
}

#Preview {
    NavigationStack {
        TaxesView()
    }
}
