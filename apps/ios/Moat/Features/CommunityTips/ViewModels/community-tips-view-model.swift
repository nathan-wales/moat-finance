import Foundation

@MainActor
final class CommunityTipsViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var tips: [CommunityTipPublicSummary] = []
    @Published var searchText = ""
    @Published var activeSort: CommunityTipFeedSort = .recommended
    @Published var actionMessage: CommunityTipActionMessage?

    private let service: CommunityTipsService

    init(service: CommunityTipsService = CommunityTipsService()) {
        self.service = service
    }

    var filteredTips: [CommunityTipPublicSummary] {
        let terms = Self.searchTerms(from: searchText)
        guard !terms.isEmpty else { return tips }
        return tips.filter { tip in
            let haystack = (
                [tip.title, tip.bodyPreview]
                    + tip.tags
                    + tip.keywords
            )
            .joined(separator: " ")
            .lowercased()
            return terms.contains { haystack.contains($0) }
        }
    }

    static func searchTerms(from query: String) -> [String] {
        var seen = Set<String>()
        var terms: [String] = []
        for part in query.split(separator: ",") {
            let term = part.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !term.isEmpty, !seen.contains(term) else { continue }
            seen.insert(term)
            terms.append(term)
        }
        return terms
    }

    func load() async {
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false, showRefreshing: true)
    }

    func applySort(_ sort: CommunityTipFeedSort) async {
        activeSort = sort
        await reload(showLoading: false, showRefreshing: true)
    }

    private func reload(showLoading: Bool, showRefreshing: Bool = false) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            let response = try await service.listFeed(sort: activeSort)
            tips = response.items
            state = .loaded
        } catch {
            if error.isCancellation {
                if case .refreshing = state {
                    state = .loaded
                }
                return
            }
            state = .error(error)
            AppLogger.error(
                "Failed to load community tips feed",
                metadata: ["error": error.localizedDescription]
            )
        }
    }

    func like(tipId: String) async {
        guard let index = tips.firstIndex(where: { $0.id == tipId }) else { return }
        tips[index].likeCount += 1
        tips[index].likedByCurrentUser = true

        do {
            let updated = try await service.like(tipId: tipId)
            if let newIndex = tips.firstIndex(where: { $0.id == tipId }) {
                tips[newIndex].likeCount = updated.likeCount
                tips[newIndex].likedByCurrentUser = updated.likedByCurrentUser
            }
        } catch {
            if let rollbackIndex = tips.firstIndex(where: { $0.id == tipId }) {
                tips[rollbackIndex].likeCount -= 1
                tips[rollbackIndex].likedByCurrentUser = false
            }
            actionMessage = CommunityTipActionMessage(title: "Like failed", message: error.localizedDescription)
        }
    }

    func unlike(tipId: String) async {
        guard let index = tips.firstIndex(where: { $0.id == tipId }) else { return }
        tips[index].likeCount = max(0, tips[index].likeCount - 1)
        tips[index].likedByCurrentUser = false

        do {
            let updated = try await service.unlike(tipId: tipId)
            if let newIndex = tips.firstIndex(where: { $0.id == tipId }) {
                tips[newIndex].likeCount = updated.likeCount
                tips[newIndex].likedByCurrentUser = updated.likedByCurrentUser
            }
        } catch {
            if let rollbackIndex = tips.firstIndex(where: { $0.id == tipId }) {
                tips[rollbackIndex].likeCount += 1
                tips[rollbackIndex].likedByCurrentUser = true
            }
            actionMessage = CommunityTipActionMessage(title: "Unlike failed", message: error.localizedDescription)
        }
    }

    func clearActionMessage() {
        actionMessage = nil
    }
}

@MainActor
final class MyCommunityTipsViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var myTips: [CommunityTipOwnerDetail] = []
    @Published var actionMessage: CommunityTipActionMessage?

    private let service: CommunityTipsService

    init(service: CommunityTipsService = CommunityTipsService()) {
        self.service = service
    }

    func load() async {
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false, showRefreshing: true)
    }

    private func reload(showLoading: Bool, showRefreshing: Bool = false) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            myTips = try await service.listMine()
            state = .loaded
        } catch {
            if error.isCancellation {
                if case .refreshing = state {
                    state = .loaded
                }
                return
            }
            state = .error(error)
            AppLogger.error(
                "Failed to load my community tips",
                metadata: ["error": error.localizedDescription]
            )
        }
    }

    func delete(tipId: String) async {
        do {
            try await service.delete(tipId: tipId)
            myTips.removeAll { $0.id == tipId }
            actionMessage = CommunityTipActionMessage(title: "Deleted", message: "Your tip has been removed.")
        } catch {
            actionMessage = CommunityTipActionMessage(title: "Delete failed", message: error.localizedDescription)
        }
    }

    func clearActionMessage() {
        actionMessage = nil
    }
}
