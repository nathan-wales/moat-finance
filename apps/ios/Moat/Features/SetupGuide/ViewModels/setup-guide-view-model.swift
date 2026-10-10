import Combine
import Foundation

@MainActor
final class SetupGuideViewModel: ObservableObject {
    @Published private(set) var state: SetupGuideState?
    @Published var isExpanded = false
    @Published var isEditPresented = false
    @Published var expandedStepId: String?

    private let service: SetupGuideService
    private let navigation: AppNavigationCoordinator

    init(
        service: SetupGuideService = SetupGuideService(),
        navigation: AppNavigationCoordinator = .shared
    ) {
        self.service = service
        self.navigation = navigation
    }

    var isVisible: Bool {
        state?.visible == true
    }

    var progress: Double {
        guard let state, state.totalCount > 0 else { return 0 }
        return Double(state.completedCount) / Double(state.totalCount)
    }

    var nextTitle: String {
        state?.nextStepTitle ?? "Finish setup"
    }

    func load() async {
        do {
            state = try await service.getState()
        } catch {
            AppLogger.warn(
                "Unable to load setup guide",
                metadata: ["operation": "setupGuide.get"]
            )
        }
    }

    func dismiss() async {
        Analytics.capture("setup_guide_dismissed")
        do {
            state = try await service.dismiss()
        } catch {
            AppLogger.warn(
                "Unable to dismiss setup guide",
                metadata: ["operation": "setupGuide.dismiss"]
            )
        }
    }

    func saveGoals(_ goals: [String]) async {
        Analytics.capture("setup_guide_goals_updated", properties: ["goalCount": goals.count])
        do {
            state = try await service.saveGoals(goals)
            isEditPresented = false
        } catch {
            AppLogger.warn(
                "Unable to save setup guide goals",
                metadata: ["operation": "setupGuide.saveGoals"]
            )
        }
    }

    func openStep(_ step: SetupGuideStep) async {
        Analytics.capture("setup_guide_step_opened", properties: ["stepId": step.id])
        if SetupGuideStepId(rawValue: step.id)?.isVisitStep == true {
            do {
                state = try await service.completeStep(step.id)
            } catch {
                AppLogger.warn(
                    "Unable to complete setup guide step",
                    metadata: ["operation": "setupGuide.completeStep"]
                )
            }
        }
        navigate(to: step)
    }

    func openNextStep() async {
        guard let state,
              let nextId = state.nextStepId,
              let step = state.steps.first(where: { $0.id == nextId })
        else { return }
        await openStep(step)
    }

    private func navigate(to step: SetupGuideStep) {
        switch SetupGuideStepId(rawValue: step.id) {
        case .reviewExpenses:
            navigation.openLargestExpenses()
        case .reviewIncome:
            navigation.openLargestIncome()
        case .createRule:
            navigation.openDestination(.rules)
        case .connectAi:
            navigation.openAIAccess()
        case .financialProfile:
            navigation.openFinancialProfile()
        case .setBudget:
            navigation.openDestination(.budget)
        case .reviewRetirement:
            navigation.openDestination(.retirement)
        case .setAlert:
            navigation.openDestination(.notifications)
        case nil:
            break
        }
    }
}
