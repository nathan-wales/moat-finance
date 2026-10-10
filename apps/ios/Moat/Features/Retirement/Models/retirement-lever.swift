import Foundation

struct RetirementLever: Codable, Equatable {
    let type: String
    let params: [String: JSONValue]

    enum CodingKeys: String, CodingKey {
        case type
        case params
    }

    init(type: String, params: [String: JSONValue] = [:]) {
        self.type = type
        self.params = params
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(String.self, forKey: .type)
        params = try container.decodeIfPresent([String: JSONValue].self, forKey: .params) ?? [:]
    }

    var displayTitle: String {
        type
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
    }

    var ageParam: Double? {
        params["age"]?.numberValue ?? params["atAge"]?.numberValue
    }

    func withAge(_ age: Double) -> RetirementLever {
        var next = params
        if params["age"] != nil {
            next["age"] = .number(age)
        } else {
            next["atAge"] = .number(age)
        }
        return RetirementLever(type: type, params: next)
    }
}

struct RetirementLeverInput: Codable, Equatable, Identifiable {
    var id: String
    var enabled: Bool
    var lever: RetirementLever

    init(id: String = UUID().uuidString, enabled: Bool = true, lever: RetirementLever) {
        self.id = id
        self.enabled = enabled
        self.lever = lever
    }

    func jsonObject() -> JSONValue {
        .object([
            "id": .string(id),
            "enabled": .bool(enabled),
            "lever": .object([
                "type": .string(lever.type),
                "params": .object(lever.params)
            ])
        ])
    }
}

struct RetirementSuggestedLever: Decodable, Identifiable, Equatable {
    let id: String
    let title: String
    let detail: String
    let secondaryDetail: String?
    let lever: RetirementLever
}
