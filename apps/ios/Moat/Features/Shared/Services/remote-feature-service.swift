import Foundation

struct RemoteFeatureService {
    let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func load(config: RemoteFeatureConfig) async throws -> RemoteFeatureSnapshot {
        var sections: [RemoteFeatureSection] = []
        var featureMetrics: [RemoteFeatureMetric] = []

        for endpoint in config.endpoints {
            let value = try await request(endpoint)
            sections.append(section(from: value, endpoint: endpoint))
            featureMetrics.append(contentsOf: metrics(from: value, title: endpoint.title))
        }

        return RemoteFeatureSnapshot(sections: sections, metrics: featureMetrics)
    }

    func perform(_ action: FeatureAction) async throws -> JSONValue {
        switch action.method {
        case .get:
            return try await apiClient.get(path: action.path)
        case .post:
            return try await apiClient.post(path: action.path, body: action.body)
        }
    }

    private func request(_ endpoint: FeatureEndpoint) async throws -> JSONValue {
        switch endpoint.method {
        case .get:
            return try await apiClient.get(path: endpoint.path)
        case .post:
            return try await apiClient.post(path: endpoint.path, body: endpoint.body)
        }
    }

    private func section(from value: JSONValue, endpoint: FeatureEndpoint) -> RemoteFeatureSection {
        let records = records(from: value)
        return RemoteFeatureSection(
            title: endpoint.title,
            records: records,
            emptyMessage: endpoint.emptyMessage
        )
    }

    private func records(from value: JSONValue) -> [RemoteFeatureRecord] {
        switch value {
        case .array(let values):
            return values.enumerated().map { index, value in
                record(from: value, fallbackTitle: "Item \(index + 1)")
            }
        case .object(let object):
            if let items = object["items"]?.arrayValue {
                return records(from: .array(items))
            }

            let nestedRecords = object
                .sorted { $0.key < $1.key }
                .flatMap { key, value -> [RemoteFeatureRecord] in
                    guard let values = value.arrayValue, !values.isEmpty else { return [] }
                    return values.enumerated().map { index, item in
                        record(from: item, fallbackTitle: "\(key.capitalized) \(index + 1)")
                    }
                }

            if !nestedRecords.isEmpty {
                return nestedRecords
            }

            return [record(from: .object(object), fallbackTitle: "Summary")]
        case .null:
            return []
        default:
            return [record(from: value, fallbackTitle: "Value")]
        }
    }

    private func record(from value: JSONValue, fallbackTitle: String) -> RemoteFeatureRecord {
        guard let object = value.objectValue else {
            return RemoteFeatureRecord(
                id: fallbackTitle,
                title: value.displayValue,
                subtitle: nil,
                amount: value.numberValue,
                badges: [],
                details: [("Value", value.displayValue)]
            )
        }

        let stableId = object["id"]?.stringValue ?? object["plaidItemId"]?.stringValue ?? object["itemId"]?.stringValue ?? UUID().uuidString
        let title = object.preferredTitle ?? fallbackTitle
        let amount = object.preferredAmount
        let subtitle = object.preferredSubtitle
        let badges = ["isActive", "status", "type", "categoryName", "institutionName"]
            .compactMap { key -> String? in
                guard let value = object[key] else { return nil }
                let displayValue = value.displayValue
                return displayValue == "-" ? nil : displayValue
            }
        let details = object
            .sorted { $0.key < $1.key }
            .map { key, value in (key.camelCaseSpaced, value.displayValue) }

        return RemoteFeatureRecord(
            id: stableId,
            title: title,
            subtitle: subtitle,
            amount: amount,
            badges: Array(badges.prefix(3)),
            details: details
        )
    }

    private func metrics(from value: JSONValue, title: String) -> [RemoteFeatureMetric] {
        switch value {
        case .array(let values):
            return [RemoteFeatureMetric(label: title, value: "\(values.count)", systemImage: "number")]
        case .object(let object):
            var metrics = object
                .sorted { $0.key < $1.key }
                .compactMap { key, value -> RemoteFeatureMetric? in
                    if let number = value.numberValue {
                        return RemoteFeatureMetric(label: key.camelCaseSpaced, value: CurrencyFormatter.format(number), systemImage: "chart.bar.fill")
                    }

                    if let bool = value.boolValue {
                        return RemoteFeatureMetric(label: key.camelCaseSpaced, value: bool ? "Yes" : "No", systemImage: bool ? "checkmark" : "xmark")
                    }

                    if let array = value.arrayValue {
                        return RemoteFeatureMetric(label: key.camelCaseSpaced, value: "\(array.count)", systemImage: "list.bullet")
                    }

                    return nil
                }

            if metrics.isEmpty {
                metrics.append(RemoteFeatureMetric(label: title, value: "Loaded", systemImage: "checkmark"))
            }

            return Array(metrics.prefix(6))
        default:
            return [RemoteFeatureMetric(label: title, value: value.displayValue, systemImage: "info.circle.fill")]
        }
    }
}

private extension String {
    var camelCaseSpaced: String {
        let spaced = reduce(into: "") { result, character in
            if character.isUppercase, !result.isEmpty {
                result.append(" ")
            }
            result.append(character)
        }

        return spaced.replacingOccurrences(of: "_", with: " ").capitalized
    }
}
