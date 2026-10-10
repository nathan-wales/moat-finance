import Foundation

@MainActor
final class PromptsViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var prompts: [AiPrompt] = []
    @Published private(set) var myPrompts: [UserPromptSummary] = []
    @Published private(set) var communityPrompts: [CommunityPromptSummary] = []
    @Published private(set) var categories: [PromptCategory] = []
    @Published private(set) var availableTags: [AiPromptTag] = []
    @Published private(set) var accountCount: Int?
    @Published private(set) var pinnedPromptIdsBySource: [PromptLibrarySource: [String]] = [:]
    @Published private(set) var curatedLaunchCounts: [String: Int] = [:]
    @Published var searchText = ""
    @Published var activeTag: PromptTagFilter = .all
    @Published var activeTab: PromptLibraryTab = .curated
    @Published var actionMessage: PromptActionMessage?

    private let libraryService: PromptLibraryService
    private let promptsService: PromptsService
    private let accountsService: AccountsService

    init(
        libraryService: PromptLibraryService = .shared,
        promptsService: PromptsService = PromptsService(),
        accountsService: AccountsService = AccountsService()
    ) {
        self.libraryService = libraryService
        self.promptsService = promptsService
        self.accountsService = accountsService
    }

    var filteredCuratedPrompts: [AiPrompt] {
        sortByPinnedThenLaunchCount(
            libraryService.filterPrompts(
                in: prompts,
                query: searchText,
                activeTag: activeTag
            ),
            source: .curated,
            launchCount: { curatedLaunchCounts[$0.id] ?? 0 }
        )
    }

    var filteredMyPrompts: [UserPromptSummary] {
        sortByPinnedThenLaunchCount(
            filterCloudPrompts(myPrompts),
            source: .mine,
            launchCount: \.launchCount
        )
    }

    var filteredCommunityPrompts: [CommunityPromptSummary] {
        sortByPinnedThenLaunchCount(
            filterCloudPrompts(communityPrompts),
            source: .community,
            launchCount: \.launchCount
        )
    }

    func launchCount(forCuratedPromptId promptId: String) -> Int {
        curatedLaunchCounts[promptId] ?? 0
    }

    func promptContext() -> AiPromptContext {
        libraryService.defaultContext(accountCount: accountCount)
    }

    func assembledPrompt(for prompt: AiPrompt) -> String {
        libraryService.assemblePrompt(prompt, context: promptContext())
    }

    func isPinned(_ promptId: String, source: PromptLibrarySource? = nil) -> Bool {
        let resolvedSource = source ?? activeTab.pinSource
        return pinnedPromptIdsBySource[resolvedSource]?.contains(promptId) ?? false
    }

    func togglePin(promptId: String, source: PromptLibrarySource? = nil) async {
        let resolvedSource = source ?? activeTab.pinSource
        let currentlyPinned = isPinned(promptId, source: resolvedSource)

        var next = pinnedPromptIdsBySource[resolvedSource] ?? []
        if currentlyPinned {
            next.removeAll { $0 == promptId }
        } else {
            next = [promptId] + next.filter { $0 != promptId }
        }
        pinnedPromptIdsBySource[resolvedSource] = next

        do {
            let result = try await promptsService.togglePin(
                source: resolvedSource,
                promptId: promptId
            )
            if result.pinned != !currentlyPinned {
                await reloadPins(for: resolvedSource)
            }
        } catch {
            await reloadPins(for: resolvedSource)
            actionMessage = PromptActionMessage(
                title: "Pin failed",
                message: error.localizedDescription
            )
        }
    }

    func recordLaunch(source: PromptLibrarySource, promptId: String) async {
        do {
            let result = try await promptsService.recordLaunch(
                source: source,
                promptId: promptId
            )
            guard result.counted else { return }

            if source == .curated {
                curatedLaunchCounts[promptId] = result.launchCount
            } else if source == .mine {
                if let index = myPrompts.firstIndex(where: { $0.id == promptId }) {
                    myPrompts[index].launchCount = result.launchCount
                }
            } else if source == .community {
                if let index = communityPrompts.firstIndex(where: { $0.id == promptId }) {
                    communityPrompts[index].launchCount = result.launchCount
                }
            }
        } catch {
            AppLogger.warn(
                "Failed to record prompt launch",
                metadata: ["error": error.localizedDescription]
            )
        }
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
            async let mine = promptsService.listMyPrompts()
            async let community = promptsService.listCommunityPrompts()
            async let cats = promptsService.listCategories()
            async let pins = promptsService.listPins()
            async let curatedCounts = promptsService.listLaunchCounts(source: .curated)

            let loadedPrompts = try libraryService.loadPrompts()
            prompts = loadedPrompts
            availableTags = libraryService.getAllTags(from: loadedPrompts)
            myPrompts = try await mine
            communityPrompts = try await community
            categories = try await cats
            pinnedPromptIdsBySource = Self.groupPins(try await pins)
            curatedLaunchCounts = Dictionary(
                uniqueKeysWithValues: try await curatedCounts.map { ($0.promptId, $0.launchCount) }
            )
            state = .loaded
            await loadAccountCountIfNeeded()
        } catch {
            if error.isCancellation {
                if case .refreshing = state {
                    state = .loaded
                }
                return
            }
            state = .error(error)
        }
    }

    func savePrompt(_ request: CreateUserPromptRequest) async throws -> UserPromptDetail {
        let created = try await promptsService.createPrompt(request)
        myPrompts = try await promptsService.listMyPrompts()
        return created
    }

    func updatePrompt(
        id: String,
        request: UpdateUserPromptRequest,
        confirmWithdrawFromReview: Bool = false
    ) async throws -> UserPromptDetail {
        var payload = request
        if confirmWithdrawFromReview {
            payload = UpdateUserPromptRequest(
                promptId: request.promptId,
                title: request.title,
                description: request.description,
                body: request.body,
                categorySlug: request.categorySlug,
                tags: request.tags,
                confirmWithdrawFromReview: true
            )
        }
        let updated = try await promptsService.updatePrompt(payload)
        myPrompts = try await promptsService.listMyPrompts()
        return updated
    }

    func submitPrompt(id: String) async throws {
        _ = try await promptsService.submitPrompt(id: id)
        myPrompts = try await promptsService.listMyPrompts()
    }

    func saveCommunityPrompt(id: String) async throws {
        _ = try await promptsService.saveCommunityPromptToLibrary(id: id)
        myPrompts = try await promptsService.listMyPrompts()
        actionMessage = PromptActionMessage(
            title: "Saved",
            message: "Prompt saved to your library."
        )
    }

    func generateDraft(goal: String, financialData: String?, responseInclude: String?) async throws -> GeneratePromptDraftResponse {
        try await promptsService.generateDraft(
            GeneratePromptDraftRequest(
                goal: goal,
                financialData: financialData,
                responseInclude: responseInclude
            )
        )
    }

    func hasAiConnection() async throws -> Bool {
        try await promptsService.hasAiConnection()
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    private func reloadPins(for source: PromptLibrarySource) async {
        do {
            let pins = try await promptsService.listPins(source: source)
            pinnedPromptIdsBySource[source] = pins.map(\.promptId)
        } catch {
            AppLogger.warn(
                "Failed to reload prompt pins",
                metadata: ["error": error.localizedDescription]
            )
        }
    }

    private func sortByPinnedThenLaunchCount<T: Identifiable>(
        _ items: [T],
        source: PromptLibrarySource,
        launchCount: (T) -> Int
    ) -> [T] where T.ID == String {
        let pinnedIds = pinnedPromptIdsBySource[source] ?? []
        let pinnedSet = Set(pinnedIds)
        var pinned: [T] = []
        var unpinned: [T] = []

        for item in items {
            if pinnedSet.contains(item.id) {
                pinned.append(item)
            } else {
                unpinned.append(item)
            }
        }

        pinned.sort {
            let left = pinnedIds.firstIndex(of: $0.id) ?? .max
            let right = pinnedIds.firstIndex(of: $1.id) ?? .max
            return left < right
        }

        unpinned.sort { launchCount($0) > launchCount($1) }

        return pinned + unpinned
    }

    private static func groupPins(_ pins: [PromptPinSummary]) -> [PromptLibrarySource: [String]] {
        var grouped: [PromptLibrarySource: [String]] = [:]
        for pin in pins {
            var ids = grouped[pin.source] ?? []
            ids.append(pin.promptId)
            grouped[pin.source] = ids
        }
        return grouped
    }

    private func filterCloudPrompts<T: Identifiable & Hashable>(_ prompts: [T]) -> [T] where T: HasPromptSearchFields {
        guard !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return prompts
        }
        let query = searchText.lowercased()
        return prompts.filter { $0.matches(query: query) }
    }

    private func loadAccountCountIfNeeded() async {
        do {
            let result = try await accountsService.load()
            accountCount = result.institutions.reduce(0) { partial, institution in
                partial + institution.accounts.count
            }
        } catch {
            AppLogger.warn(
                "Failed to load account count for prompt context",
                metadata: ["error": error.localizedDescription]
            )
        }
    }
}

protocol HasPromptSearchFields {
    func matches(query: String) -> Bool
}

extension UserPromptSummary: HasPromptSearchFields {
    func matches(query: String) -> Bool {
        title.lowercased().contains(query)
            || (description?.lowercased().contains(query) ?? false)
            || tags.contains(where: { $0.lowercased().contains(query) })
    }
}

extension CommunityPromptSummary: HasPromptSearchFields {
    func matches(query: String) -> Bool {
        title.lowercased().contains(query)
            || (description?.lowercased().contains(query) ?? false)
            || tags.contains(where: { $0.lowercased().contains(query) })
    }
}
