import SwiftUI

struct OnboardingGateView: View {
    @State private var state: GateState = .checking
    private let service = OnboardingService()

    var body: some View {
        Group {
            switch state {
            case .checking:
                AuthLoadingView()
            case .onboarding:
                OnboardingView {
                    state = .app
                }
            case .app:
                AppShellView()
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await checkOnboardingNeed() }
                }
            }
        }
        .task {
            await checkOnboardingNeed()
        }
    }

    private func checkOnboardingNeed() async {
        state = .checking

        do {
            state = try await service.shouldShowOnboarding() ? .onboarding : .app
        } catch {
            AppLogger.warn("Unable to determine onboarding state", metadata: ["operation": "onboarding.gate"])
            state = .app
        }
    }

    private enum GateState {
        case checking
        case onboarding
        case app
        case error(Error)
    }
}

#Preview {
    OnboardingGateView()
}