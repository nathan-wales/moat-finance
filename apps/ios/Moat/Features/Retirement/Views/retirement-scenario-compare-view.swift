import SwiftUI

struct RetirementScenarioCompareView: View {
    @ObservedObject var viewModel: RetirementScenariosViewModel
    let draftLevers: [RetirementLeverInput]
    let onOpen: (RetirementScenario) -> Void
    let onSaved: (RetirementScenario) -> Void
    let onReset: () -> Void
    @State private var name = "Retire earlier"

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
            MoatCard {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                    Text("Save current stack")
                        .font(.headline)
                    MoatTextField(placeholder: "Scenario name", text: $name)
                    Button("Save") {
                        Task {
                            do {
                                let scenario = try await viewModel.save(name: name, levers: draftLevers)
                                onSaved(scenario)
                            } catch {
                                viewModel.actionMessage = error.localizedDescription
                            }
                        }
                    }
                    .buttonStyle(.moatPrimary)
                    .disabled(draftLevers.isEmpty)
                }
            }

            Button("View baseline") {
                onReset()
            }
            .buttonStyle(.moatSecondary)

            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading scenarios...")
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            case .loaded, .refreshing:
                if viewModel.scenarios.isEmpty {
                    Text("No saved retirement scenarios yet.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(viewModel.scenarios) { scenario in
                        MoatCard {
                            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                                Text(scenario.name)
                                    .font(.subheadline.weight(.semibold))
                                Text("\(scenario.levers.count) changes")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                HStack {
                                    Button("Open") { onOpen(scenario) }
                                        .buttonStyle(.moatPrimaryCompact)
                                    Button("Delete", role: .destructive) {
                                        Task { await viewModel.delete(scenario) }
                                    }
                                    .buttonStyle(.moatDestructive)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
        }
        .refreshable { await viewModel.refresh() }
    }
}
