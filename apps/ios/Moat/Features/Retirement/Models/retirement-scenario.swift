import Foundation

struct RetirementScenarioLever: Decodable, Identifiable, Equatable {
    let id: String
    let enabled: Bool
    let lever: RetirementLever
}

struct RetirementScenario: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let description: String?
    let color: String?
    let isPinned: Bool
    let levers: [RetirementScenarioLever]
}

struct RetirementCreateScenarioRequest: Encodable {
    let name: String
    let levers: [RetirementLeverInput]
}
