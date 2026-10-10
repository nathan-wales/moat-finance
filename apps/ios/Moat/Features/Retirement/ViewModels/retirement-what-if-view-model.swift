import Foundation

@MainActor
final class RetirementWhatIfViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published var editingLever: RetirementLeverInput?

    func presentEditor(_ lever: RetirementLeverInput) {
        editingLever = lever
    }
}
