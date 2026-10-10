import SwiftUI

struct RetirementView: View {
    @StateObject private var viewModel = RetirementViewModel()
    @StateObject private var scenariosViewModel = RetirementScenariosViewModel()
    @StateObject private var whatIfViewModel = RetirementWhatIfViewModel()

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading retirement...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Retirement")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.load()
            await scenariosViewModel.load()
        }
        .sheet(item: $whatIfViewModel.editingLever) { lever in
            RetirementLeverEditorSheet(
                draft: lever,
                onSave: { updated in
                    viewModel.replaceLever(updated)
                    whatIfViewModel.editingLever = nil
                },
                onCancel: { whatIfViewModel.editingLever = nil }
            )
        }
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(spacing: MoatTheme.Spacing.large) {
                if let overview = viewModel.overview {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                        Text(overview.headline.headline)
                            .font(.title2.bold())
                        Text(overview.headline.supporting)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let summary = viewModel.activeProjection?.summary {
                    RetirementMetricStrip(summary: summary, baseline: viewModel.baselineProjection?.summary)
                    Text("Chart and headline amounts stay in future dollars. Today’s-dollar labels sit underneath.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Picker("Retirement tab", selection: tabBinding) {
                    ForEach(RetirementTab.allCases) { tab in
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
    }

    private var tabBinding: Binding<RetirementTab> {
        Binding(
            get: { viewModel.selectedTab },
            set: { viewModel.changeTab($0) }
        )
    }

    @ViewBuilder
    private var tabContent: some View {
        switch viewModel.selectedTab {
        case .plan:
            if let projection = viewModel.activeProjection {
                RetirementTimelineChartView(years: projection.years)
            }
        case .whatIf:
            RetirementWhatIfSection(
                suggestions: viewModel.overview?.suggestedLevers ?? [],
                draftLevers: viewModel.draftLevers,
                projection: viewModel.projection,
                onAdd: { viewModel.addLever($0, source: "suggested") },
                onRemove: viewModel.removeLever,
                onEdit: whatIfViewModel.presentEditor
            )
        case .scenarios:
            RetirementScenarioCompareView(
                viewModel: scenariosViewModel,
                draftLevers: viewModel.draftLevers,
                onOpen: viewModel.openScenario,
                onSaved: { scenario in
                    viewModel.savedScenarioId = scenario.id
                },
                onReset: viewModel.clearDraft
            )
        case .risk:
            RetirementRiskView(
                levers: viewModel.draftLevers,
                scenarioId: viewModel.savedScenarioId
            )
        }
    }
}

#Preview {
    NavigationStack {
        RetirementView()
    }
}
