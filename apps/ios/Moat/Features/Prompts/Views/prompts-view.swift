import SwiftUI

struct PromptsView: View {
    @StateObject private var viewModel = PromptsViewModel()
    @StateObject private var createViewModel = PromptCreateViewModel()
    @ObservedObject private var connectionStore = AIAccessConnectionStore.shared
    @State private var selectedCuratedPrompt: AiPrompt?
    @State private var selectedUserPromptId: String?
    @State private var selectedCommunityPromptId: String?
    @State private var showCreateSheet = false

    private var isCuratedPromptSelected: Binding<Bool> {
        Binding(
            get: { selectedCuratedPrompt != nil },
            set: { if !$0 { selectedCuratedPrompt = nil } }
        )
    }

    private var isUserPromptSelected: Binding<Bool> {
        Binding(
            get: { selectedUserPromptId != nil },
            set: { if !$0 { selectedUserPromptId = nil } }
        )
    }

    private var isCommunityPromptSelected: Binding<Bool> {
        Binding(
            get: { selectedCommunityPromptId != nil },
            set: { if !$0 { selectedCommunityPromptId = nil } }
        )
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                LoadingView("Loading prompts...")
            case .loaded, .refreshing:
                loadedContent
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
            }
        }
        .navigationTitle("Prompts")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $viewModel.searchText, prompt: "Search prompts…")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    createViewModel.reset()
                    showCreateSheet = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .navigationDestination(isPresented: isCuratedPromptSelected) {
            if let selectedCuratedPrompt {
                PromptDetailView(viewModel: viewModel, prompt: selectedCuratedPrompt)
            }
        }
        .navigationDestination(isPresented: isUserPromptSelected) {
            if let selectedUserPromptId {
                UserPromptDetailView(promptId: selectedUserPromptId, viewModel: viewModel)
            }
        }
        .navigationDestination(isPresented: isCommunityPromptSelected) {
            if let selectedCommunityPromptId {
                CommunityPromptDetailView(promptId: selectedCommunityPromptId, viewModel: viewModel)
            }
        }
        .sheet(isPresented: $showCreateSheet) {
            createFlowSheet
        }
        .alert(item: $viewModel.actionMessage) { message in
            Alert(title: Text(message.title), message: Text(message.message), dismissButton: .default(Text("OK")) {
                viewModel.clearActionMessage()
            })
        }
        .task {
            await viewModel.load()
            await connectionStore.refresh()
        }
    }

    @ViewBuilder
    private var createFlowSheet: some View {
        switch createViewModel.step {
        case .choice:
            PromptCreateChoiceSheet(
                errorMessage: createViewModel.errorMessage,
                onCreateWithAI: {
                    Task {
                        createViewModel.errorMessage = nil
                        do {
                            if try await viewModel.hasAiConnection() {
                                createViewModel.step = .aiBuilder
                            } else {
                                createViewModel.step = .aiGate
                            }
                        } catch {
                            AppLogger.warn(
                                "Failed to check AI connection for prompt creation",
                                metadata: ["error": error.localizedDescription]
                            )
                            createViewModel.errorMessage = error.localizedDescription
                        }
                    }
                },
                onWriteManually: {
                    createViewModel.step = .manual
                }
            )
        case .aiGate:
            PromptAiConnectionGateSheet(
                onConnectAssistant: {
                    showCreateSheet = false
                    AppNavigationCoordinator.shared.openAIAccess()
                },
                onWriteManually: {
                    createViewModel.step = .manual
                }
            )
        case .aiBuilder:
            PromptAiBuilderSheet(createViewModel: createViewModel) {
                createViewModel.isGenerating = true
                defer { createViewModel.isGenerating = false }
                do {
                    let draft = try await viewModel.generateDraft(
                        goal: createViewModel.goal,
                        financialData: createViewModel.financialData.isEmpty ? nil : createViewModel.financialData,
                        responseInclude: createViewModel.responseInclude.isEmpty ? nil : createViewModel.responseInclude
                    )
                    createViewModel.applyDraft(draft)
                } catch {
                    createViewModel.errorMessage = error.localizedDescription
                }
            }
        case .manual:
            PromptManualFormSheet(
                createViewModel: createViewModel,
                categories: viewModel.categories
            ) {
                createViewModel.isSubmitting = true
                defer { createViewModel.isSubmitting = false }
                do {
                    _ = try await viewModel.savePrompt(createViewModel.buildCreateRequest())
                    showCreateSheet = false
                    createViewModel.reset()
                    viewModel.actionMessage = PromptActionMessage(
                        title: createViewModel.submitForReview ? "Submitted for review" : "Saved",
                        message: createViewModel.submitForReview
                            ? "You can continue using and editing this prompt privately. We'll let you know when it is approved or if changes are needed."
                            : "Private prompt saved to your library."
                    )
                } catch {
                    createViewModel.errorMessage = error.localizedDescription
                }
            }
        }
    }

    private var loadedContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                headerSection
                tabPicker

                if connectionStore.shouldShowBanner && viewModel.activeTab == .curated {
                    AIAccessConnectBanner(
                        onConnect: {
                            connectionStore.dismissBanner()
                            AppNavigationCoordinator.shared.openAIAccess()
                        },
                        onDismiss: {
                            connectionStore.dismissBanner()
                        }
                    )
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.large, style: .continuous))
                }

                tabContent
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.medium)
            .padding(.bottom, MoatTheme.Spacing.xLarge)
        }
        .moatPageBackground()
        .refreshable { await viewModel.refresh() }
    }

    private var tabPicker: some View {
        Picker("Library", selection: $viewModel.activeTab) {
            ForEach(PromptLibraryTab.allCases) { tab in
                Text(tab.title).tag(tab)
            }
        }
        .pickerStyle(.segmented)
    }

    @ViewBuilder
    private var tabContent: some View {
        switch viewModel.activeTab {
        case .curated:
            curatedTab
        case .mine:
            myLibraryTab
        case .community:
            communityTab
        }
    }

    private var curatedTab: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            tagFilterRow
            if viewModel.filteredCuratedPrompts.isEmpty {
                emptyState
            } else {
                LazyVStack(spacing: MoatTheme.Spacing.medium) {
                    ForEach(viewModel.filteredCuratedPrompts) { prompt in
                        ZStack(alignment: .topTrailing) {
                            Button {
                                selectedCuratedPrompt = prompt
                            } label: {
                                PromptCardView(
                                    prompt: prompt,
                                    previewText: viewModel.assembledPrompt(for: prompt),
                                    launchCount: viewModel.launchCount(forCuratedPromptId: prompt.id)
                                )
                            }
                            .buttonStyle(.plain)

                            PromptPinButton(
                                isPinned: viewModel.isPinned(prompt.id, source: .curated)
                            ) {
                                Task {
                                    await viewModel.togglePin(promptId: prompt.id, source: .curated)
                                }
                            }
                            .padding(MoatTheme.Spacing.small)
                        }
                    }
                }
            }
        }
    }

    private var myLibraryTab: some View {
        Group {
            if viewModel.filteredMyPrompts.isEmpty {
                Text("No prompts in your library yet. Tap + to create one.")
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, MoatTheme.Spacing.xLarge)
            } else {
                LazyVStack(spacing: MoatTheme.Spacing.medium) {
                    ForEach(viewModel.filteredMyPrompts) { prompt in
                        ZStack(alignment: .topTrailing) {
                            Button {
                                selectedUserPromptId = prompt.id
                            } label: {
                                UserPromptCardView(prompt: prompt)
                            }
                            .buttonStyle(.plain)

                            PromptPinButton(
                                isPinned: viewModel.isPinned(prompt.id, source: .mine)
                            ) {
                                Task {
                                    await viewModel.togglePin(promptId: prompt.id, source: .mine)
                                }
                            }
                            .padding(MoatTheme.Spacing.small)
                        }
                    }
                }
            }
        }
    }

    private var communityTab: some View {
        Group {
            if viewModel.filteredCommunityPrompts.isEmpty {
                Text("No community prompts yet.")
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, MoatTheme.Spacing.xLarge)
            } else {
                LazyVStack(spacing: MoatTheme.Spacing.medium) {
                    ForEach(viewModel.filteredCommunityPrompts) { prompt in
                        ZStack(alignment: .topTrailing) {
                            Button {
                                selectedCommunityPromptId = prompt.id
                            } label: {
                                CommunityPromptCardView(prompt: prompt)
                            }
                            .buttonStyle(.plain)

                            PromptPinButton(
                                isPinned: viewModel.isPinned(prompt.id, source: .community)
                            ) {
                                Task {
                                    await viewModel.togglePin(promptId: prompt.id, source: .community)
                                }
                            }
                            .padding(MoatTheme.Spacing.small)
                        }
                    }
                }
            }
        }
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            Text("Curated prompts, your personal library, and community prompts reviewed by Moat.")
                .font(.subheadline)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)

            Text("AI-generated responses are for informational purposes only and do not constitute financial advice. Consult a qualified financial professional before making decisions.")
                .font(.caption)
                .foregroundStyle(MoatTheme.ColorToken.textTertiary)
        }
    }

    private var tagFilterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: MoatTheme.Spacing.small) {
                PromptTagChip(
                    title: "All",
                    isSelected: viewModel.activeTag == .all
                ) {
                    viewModel.activeTag = .all
                }

                ForEach(viewModel.availableTags) { tag in
                    PromptTagChip(
                        title: tag.displayTitle,
                        isSelected: viewModel.activeTag == .tag(tag)
                    ) {
                        viewModel.activeTag = .tag(tag)
                    }
                }
            }
            .padding(.vertical, 2)
        }
    }

    private var emptyState: some View {
        Text("No prompts match your search.")
            .font(.subheadline)
            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, MoatTheme.Spacing.xLarge)
    }
}

private struct UserPromptDetailView: View {
    let promptId: String
    @ObservedObject var viewModel: PromptsViewModel
    @StateObject private var editViewModel = PromptCreateViewModel()
    @State private var prompt: UserPromptDetail?
    @State private var isLoading = true
    @State private var showEditSheet = false
    @State private var showWithdrawConfirm = false
    @State private var pendingUpdateRequest: UpdateUserPromptRequest?

    var body: some View {
        Group {
            if isLoading {
                LoadingView("Loading prompt...")
            } else if let prompt {
                ScrollView {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                        HStack {
                            Text(prompt.title)
                                .font(.title2.weight(.semibold))
                            Spacer()
                            PromptStatusBadge(
                                reviewStatus: prompt.reviewStatus,
                                visibility: prompt.visibility
                            )
                        }

                        if let feedback = prompt.moderationFeedback ?? prompt.rejectionReason {
                            Text(feedback)
                                .font(.subheadline)
                                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                                .padding(MoatTheme.Spacing.medium)
                                .background(MoatTheme.ColorToken.elevatedSurface)
                                .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium))
                        }

                        Text(prompt.body)
                            .font(.body)
                            .foregroundStyle(MoatTheme.ColorToken.textPrimary)

                        HStack(spacing: MoatTheme.Spacing.medium) {
                            Button("Edit") {
                                editViewModel.loadFromPrompt(prompt)
                                showEditSheet = true
                            }
                            .buttonStyle(.bordered)

                            if prompt.reviewStatus != .pending {
                                Button("Submit for review") {
                                    Task {
                                        try? await viewModel.submitPrompt(id: prompt.id)
                                        self.prompt = try? await PromptsService().getPrompt(id: prompt.id)
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                            }
                        }
                    }
                    .padding(MoatTheme.Spacing.large)
                }
                .sheet(isPresented: $showEditSheet) {
                    PromptManualFormSheet(
                        createViewModel: editViewModel,
                        categories: viewModel.categories,
                        isEditing: true
                    ) {
                        await saveEdits(for: prompt)
                    }
                }
                .alert(
                    "Remove from review?",
                    isPresented: $showWithdrawConfirm,
                    presenting: pendingUpdateRequest
                ) { request in
                    Button("Continue editing", role: .destructive) {
                        Task {
                            await confirmWithdrawAndSave(request: request, promptId: prompt.id)
                        }
                    }
                    Button("Cancel", role: .cancel) {
                        pendingUpdateRequest = nil
                    }
                } message: { _ in
                    Text("Editing this prompt will remove it from review. You can submit the updated version again when you are ready.")
                }
            } else {
                Text("Prompt not found.")
            }
        }
        .task {
            isLoading = true
            prompt = try? await PromptsService().getPrompt(id: promptId)
            isLoading = false
        }
    }

    private func saveEdits(for prompt: UserPromptDetail) async {
        editViewModel.isSubmitting = true
        defer { editViewModel.isSubmitting = false }

        let request = editViewModel.buildUpdateRequest(promptId: prompt.id)
        do {
            let updated = try await viewModel.updatePrompt(id: prompt.id, request: request)
            self.prompt = updated
            showEditSheet = false
        } catch {
            let message = error.localizedDescription
            if message.contains("remove it from review") {
                pendingUpdateRequest = request
                showWithdrawConfirm = true
            } else {
                editViewModel.errorMessage = message
            }
        }
    }

    private func confirmWithdrawAndSave(request: UpdateUserPromptRequest, promptId: String) async {
        editViewModel.isSubmitting = true
        defer { editViewModel.isSubmitting = false }

        do {
            let updated = try await viewModel.updatePrompt(
                id: promptId,
                request: request,
                confirmWithdrawFromReview: true
            )
            self.prompt = updated
            pendingUpdateRequest = nil
            showEditSheet = false
        } catch {
            editViewModel.errorMessage = error.localizedDescription
        }
    }
}

private struct CommunityPromptDetailView: View {
    let promptId: String
    @ObservedObject var viewModel: PromptsViewModel
    @State private var prompt: CommunityPromptDetail?
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                LoadingView("Loading prompt...")
            } else if let prompt {
                ScrollView {
                    VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                        HStack {
                            Text(prompt.title)
                                .font(.title2.weight(.semibold))
                            Spacer()
                            CommunityReviewedBadge()
                        }

                        Text("By \(prompt.creatorDisplayName)")
                            .font(.subheadline)
                            .foregroundStyle(MoatTheme.ColorToken.textSecondary)

                        Text(prompt.body)
                            .font(.body)

                        Button("Save to my library") {
                            Task {
                                try? await viewModel.saveCommunityPrompt(id: prompt.id)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding(MoatTheme.Spacing.large)
                }
            } else {
                Text("Prompt not found.")
            }
        }
        .task {
            isLoading = true
            prompt = try? await PromptsService().getCommunityPrompt(id: promptId)
            isLoading = false
        }
    }
}

extension String: @retroactive Identifiable {
    public var id: String { self }
}

#Preview {
    NavigationStack {
        PromptsView()
    }
}
