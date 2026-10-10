import Foundation

@MainActor
final class RemoteFeatureViewModel: ObservableObject {
    @Published private(set) var state: RemoteFeatureState = .loading
    @Published private(set) var snapshot: RemoteFeatureSnapshot?
    @Published private(set) var actionResult: RemoteFeatureActionResult?
    @Published var searchText = ""

    let config: RemoteFeatureConfig
    private let service: RemoteFeatureService

    init(config: RemoteFeatureConfig, service: RemoteFeatureService = RemoteFeatureService()) {
        self.config = config
        self.service = service
    }

    var filteredSections: [RemoteFeatureSection] {
        guard !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return snapshot?.sections ?? []
        }

        let query = searchText.lowercased()
        return (snapshot?.sections ?? []).map { section in
            let records = section.records.filter { record in
                record.title.lowercased().contains(query)
                    || (record.subtitle?.lowercased().contains(query) ?? false)
                    || record.badges.contains { $0.lowercased().contains(query) }
                    || record.details.contains { label, value in
                        label.lowercased().contains(query) || value.lowercased().contains(query)
                    }
            }

            return RemoteFeatureSection(
                title: section.title,
                records: records,
                emptyMessage: section.emptyMessage
            )
        }
    }

    func load() async {
        state = .loading

        do {
            snapshot = try await service.load(config: config)
            state = .loaded
        } catch let error as APIError where error.isUnauthorized {
            await AuthManager.shared.signOut(reason: "remote_feature_unauthorized")
        } catch {
            if error.isCancellation { return }
            state = .error(error)
        }
    }

    func refresh() async {
        state = .refreshing
        do {
            snapshot = try await service.load(config: config)
            state = .loaded
        } catch let error as APIError where error.isUnauthorized {
            await AuthManager.shared.signOut(reason: "remote_feature_unauthorized")
        } catch {
            if error.isCancellation {
                state = .loaded
                return
            }
            state = .error(error)
        }
    }

    func perform(_ action: FeatureAction) async {
        state = .refreshing

        do {
            let value = try await service.perform(action)
            actionResult = RemoteFeatureActionResult(
                title: action.title,
                message: value.displayValue
            )
            snapshot = try await service.load(config: config)
            state = .loaded
        } catch {
            actionResult = RemoteFeatureActionResult(
                title: action.title,
                message: error.localizedDescription
            )
            state = .loaded
        }
    }

    func clearActionResult() {
        actionResult = nil
    }
}

enum RemoteFeatureState {
    case loading
    case loaded
    case refreshing
    case error(Error)
}

struct RemoteFeatureActionResult: Identifiable {
    let id = UUID()
    let title: String
    let message: String
}
