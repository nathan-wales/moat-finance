import SwiftUI

struct RetirementRiskView: View {
    let levers: [RetirementLeverInput]
    let scenarioId: String?
    @StateObject private var viewModel = RetirementRiskViewModel()

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Running stress tests...")
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.load(levers: levers, scenarioId: scenarioId) }
                }
            case .loaded, .refreshing:
                if let data = viewModel.data {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                        if let vulnerability = data.biggestVulnerability {
                            MoatCard {
                                VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                                    Text(vulnerability.label)
                                        .font(.headline)
                                    Text(vulnerability.narrative)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }

                        ForEach(data.results) { result in
                            MoatCard {
                                HStack {
                                    Text(result.label)
                                        .font(.subheadline)
                                    Spacer()
                                    Text(RetirementCurrency.percent(result.confidence))
                                        .font(.subheadline.monospacedDigit().weight(.semibold))
                                }
                            }
                        }
                    }
                }
            }
        }
        .task(id: "\(scenarioId ?? "")-\(levers.count)") {
            await viewModel.load(levers: levers, scenarioId: scenarioId)
        }
    }
}

@MainActor
final class RetirementRiskViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var data: RetirementStressTestsResponse?

    private let service: RetirementService

    init(service: RetirementService = RetirementService()) {
        self.service = service
    }

    func load(levers: [RetirementLeverInput], scenarioId: String?) async {
        state = .loading
        do {
            data = try await service.runStressTests(levers: levers, scenarioId: scenarioId)
            state = .loaded
            Analytics.capture("retirement_stress_test_run", properties: [
                "testCount": data?.results.count ?? 0
            ])
        } catch {
            if error.isCancellation {
                state = .loaded
                return
            }
            state = .error(error)
        }
    }
}
