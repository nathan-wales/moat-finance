import SwiftUI
import UIKit

struct TransactionsView: View {
    @ObservedObject private var navigation = AppNavigationCoordinator.shared
    @StateObject private var viewModel = TransactionsViewModel()
    @State private var activeSheet: TransactionSheet?
    @State private var swipeRulePresentation: SwipeRuleEditorPresentation?
    @State private var isSearchPresented = false
    @State private var visibleTransactionIDs: Set<String> = []
    @State private var pendingScrollRestoreID: String?
    @State private var bulkActionErrorMessage: String?
    @FocusState private var isSearchFieldFocused: Bool
    private let title: String

    init(initialFilters: TransactionFilterState = TransactionFilterState(), title: String = "Transactions") {
        _viewModel = StateObject(wrappedValue: TransactionsViewModel(initialFilters: initialFilters))
        self.title = title
    }

    var body: some View {
        ZStack {
            switch viewModel.state {
            case .idle, .loading:
                TransactionsLoadingSkeleton()
                    .transition(.opacity)
            case .loaded, .refreshing:
                loadedContent
                    .transition(.opacity)
            case .error(let error):
                ErrorStateView(error: error) {
                    Task { await viewModel.refresh() }
                }
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.4), value: transactionsContentKey)
        .navigationTitle(title)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    if isSearchPresented {
                        isSearchFieldFocused = false
                        isSearchPresented = false
                    } else {
                        openSearch()
                    }
                } label: {
                    Image(systemName: "magnifyingglass")
                }
                .accessibilityLabel("Search transactions")

                Button {
                    activeSheet = .filters(nil)
                } label: {
                    Image(systemName: "line.3.horizontal.decrease")
                }
                .accessibilityLabel("Filter transactions")
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            if isSearchPresented {
                transactionsSearchBar
                    .padding(.horizontal, MoatTheme.Spacing.large)
                    .padding(.top, MoatTheme.Spacing.small)
                    .padding(.bottom, MoatTheme.Spacing.small)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: isSearchPresented)
        .onChange(of: viewModel.searchText) { _ in
            Task { await viewModel.handleSearchTextChange() }
        }
        .onChange(of: viewModel.searchText) { _ in
            Task { await viewModel.handleSearchTextChange() }
        }
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .edit(let transaction):
                TransactionDetailSheet(
                    transaction: transaction,
                    allHashtags: viewModel.hashtags,
                    allTransactions: viewModel.transactions,
                    onSave: { description, amount, category, type, hashtags in
                        let prompt = try await viewModel.save(
                            transaction: transaction,
                            description: description,
                            amount: amount,
                            category: category,
                            type: type,
                            hashtags: hashtags
                        )
                        activeSheet = prompt.map(TransactionSheet.rulePrompt)
                    },
                    onSplit: { description, originalAmount, splitAmount, category, splitCategory, type, hashtags in
                        try await viewModel.split(
                            transaction: transaction,
                            description: description,
                            originalAmount: originalAmount,
                            splitAmount: splitAmount,
                            type: type,
                            originalCategoryName: category,
                            splitCategoryName: splitCategory,
                            hashtags: hashtags
                        )
                        activeSheet = nil
                    },
                    onUnsplit: {
                        try await viewModel.unsplit(transaction)
                        activeSheet = nil
                    },
                    onHide: {
                        let prompt = try await viewModel.hide(transaction)
                        activeSheet = prompt.map(TransactionSheet.rulePrompt)
                    },
                    onUnhide: {
                        try await viewModel.unhide(transaction)
                        activeSheet = nil
                    },
                    onPrepareRuleEditor: {
                        try await viewModel.prepareSwipeRuleEditor(for: transaction)
                    },
                    onSaveRule: { prompt, draft, applyToHistorical in
                        try await viewModel.applyRulePrompt(
                            prompt,
                            draft: draft,
                            applyToHistorical: applyToHistorical
                        )
                    },
                    onFetchRulePreview: { prompt, draft in
                        try await viewModel.previewRulePrompt(prompt, draft: draft)
                    },
                    onResolveManageRuleTitle: {
                        await viewModel.resolveManageRuleTitle(for: transaction)
                    },
                    onShowMoreCommunityTips: { searchQuery in
                        activeSheet = nil
                        AppNavigationCoordinator.shared.openCommunityTips(search: searchQuery)
                    }
                )
            case .filters(let focus):
                TransactionFilterSheet(
                    filters: viewModel.filters,
                    categories: viewModel.categories,
                    hashtags: viewModel.hashtags,
                    focus: focus,
                    onApply: { filters in
                        await viewModel.applyFilters(filters)
                        activeSheet = nil
                    },
                    onClear: {
                        await viewModel.clearFilters()
                        activeSheet = nil
                    }
                )
            case .bulkActions:
                BulkTransactionsSheet(
                    selectedCount: viewModel.selectedTransactionIds.count,
                    allHashtags: viewModel.hashtags,
                    onChangeCategory: { category in
                        try await viewModel.bulkUpdateCategory(category)
                        activeSheet = nil
                    },
                    onAddHashtags: { hashtags in
                        try await viewModel.bulkAddHashtags(hashtags)
                        activeSheet = nil
                    },
                    onHide: {
                        try await viewModel.bulkHide()
                        activeSheet = nil
                    }
                )
            case .rulePrompt(let prompt):
                TransactionRulePromptSheet(
                    prompt: prompt,
                    hashtags: viewModel.hashtags,
                    onDismiss: { activeSheet = nil },
                    onPrepareEditor: { try await viewModel.prepareRuleEditor(for: prompt) },
                    onSaveRule: { draft, applyToHistorical in
                        try await viewModel.applyRulePrompt(prompt, draft: draft, applyToHistorical: applyToHistorical)
                        activeSheet = nil
                    },
                    onFetchPreview: { draft in
                        try await viewModel.previewRulePrompt(prompt, draft: draft)
                    }
                )
            }
        }
        .sheet(item: $swipeRulePresentation) { presentation in
            RuleEditorSheet(
                mode: presentation.context.existingRule.map { .edit($0) } ?? .create,
                title: presentation.prompt.editorTitle,
                initialDraft: presentation.context.draft,
                hashtags: viewModel.hashtags,
                onSave: { draft, applyToHistorical in
                    try await viewModel.applyRulePrompt(
                        presentation.prompt,
                        draft: draft,
                        applyToHistorical: applyToHistorical
                    )
                    swipeRulePresentation = nil
                },
                onFetchPreview: { draft in
                    try await viewModel.previewRulePrompt(presentation.prompt, draft: draft)
                },
                onDelete: {}
            )
        }
        .task {
            await viewModel.load()
            await applyPendingTransactionReview()
        }
        .onChange(of: navigation.transactionsPendingReview) { _ in
            Task { await applyPendingTransactionReview() }
        }
        .alert(
            "Couldn't update transactions",
            isPresented: Binding(
                get: { bulkActionErrorMessage != nil },
                set: { if !$0 { bulkActionErrorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) {
                bulkActionErrorMessage = nil
            }
        } message: {
            Text(bulkActionErrorMessage ?? "Something went wrong. Please try again.")
        }
    }

    private var transactionsContentKey: String {
        switch viewModel.state {
        case .idle, .loading: return "loading"
        case .loaded, .refreshing: return "loaded"
        case .error: return "error"
        }
    }

    private var loadedContent: some View {
        ScrollViewReader { proxy in
            List {
                Section {
                    if let summary = viewModel.summary {
                        TransactionsSummaryGrid(summary: summary, totalCount: viewModel.totalCount)
                            .listRowInsets(
                                EdgeInsets(
                                    top: MoatTheme.Spacing.large,
                                    leading: MoatTheme.Spacing.large,
                                    bottom: 0,
                                    trailing: MoatTheme.Spacing.large
                                )
                            )
                            .listRowSeparator(.hidden)
                            .listRowBackground(Color.clear)
                    }

                    filterChips
                        .listRowInsets(
                            EdgeInsets(
                                top: MoatTheme.Spacing.medium,
                                leading: MoatTheme.Spacing.large,
                                bottom: MoatTheme.Spacing.small,
                                trailing: MoatTheme.Spacing.large
                            )
                        )
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                }

                Section {
                    if viewModel.transactions.isEmpty {
                        emptyTransactions
                            .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
                            .listRowSeparator(.hidden)
                            .listRowBackground(MoatTheme.ColorToken.surface)
                    } else if viewModel.filters.isChronologicalSort {
                        ForEach(groupTransactionsByDay(viewModel.transactions)) { dayGroup in
                            TransactionDayBand(
                                title: dayGroup.title,
                                dayNet: dayGroup.dayNet
                            )
                            .id("day-band-\(dayGroup.id.timeIntervalSince1970)")

                            ForEach(dayGroup.transactions) { transaction in
                                transactionListRow(for: transaction, showsDate: false)
                            }
                        }
                    } else {
                        ForEach(viewModel.transactions) { transaction in
                            transactionListRow(for: transaction, showsDate: true)
                        }
                    }
                }

                if !viewModel.transactions.isEmpty {
                    Section {
                        paginationFooter
                            .listRowInsets(
                                EdgeInsets(
                                    top: MoatTheme.Spacing.small,
                                    leading: MoatTheme.Spacing.large,
                                    bottom: 112,
                                    trailing: MoatTheme.Spacing.large
                                )
                            )
                            .listRowSeparator(.hidden)
                            .listRowBackground(Color.clear)
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .modifier(TransactionsListSectionSpacing())
            .moatPageBackground()
            .refreshable { await viewModel.refresh() }
            .overlay(alignment: .top) {
                VStack(spacing: MoatTheme.Spacing.small) {
                    if viewModel.isBulkEditing {
                        BulkSelectionBar(
                            selectedCount: viewModel.selectedTransactionIds.count,
                            visibleCount: viewModel.transactions.count,
                            onSelectVisible: viewModel.selectVisibleTransactions,
                            onClear: viewModel.clearSelection,
                            onDone: viewModel.endBulkEditing,
                            onActions: { activeSheet = .bulkActions }
                        )
                        .padding(.horizontal, MoatTheme.Spacing.large)
                    }
                }
                .padding(.top, MoatTheme.Spacing.small)
            }
            .onChange(of: viewModel.transactions.map(\.id)) { _ in
                restorePendingScrollPosition(using: proxy)
            }
            .onChange(of: visibleTransactionIDs) { ids in
                viewModel.expandStats(forVisibleIDs: ids)
            }
        }
    }

    private var transactionsSearchBar: some View {
        HStack(spacing: MoatTheme.Spacing.small) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)

            TextField("Search transactions", text: $viewModel.searchText)
                .textFieldStyle(.plain)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused($isSearchFieldFocused)
                .onSubmit {
                    Task { await viewModel.applySearch() }
                }

            Button {
                closeSearch()
            } label: {
                Image(systemName: "xmark")
                    .foregroundStyle(.secondary)
            }
            .accessibilityLabel("Close search")
        }
        .padding(.horizontal, MoatTheme.Spacing.medium)
        .padding(.vertical, 10)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                .strokeBorder(MoatTheme.ColorToken.softBorder, lineWidth: 1)
        }
        .moatInputFocusRing(isFocused: isSearchFieldFocused, cornerRadius: MoatTheme.Radius.medium)
    }

    private var currentScrollAnchorID: String? {
        viewModel.transactions.first { visibleTransactionIDs.contains($0.id) }?.id
    }

    private func applyPendingTransactionReview() async {
        guard let review = navigation.transactionsPendingReview else { return }
        var filters = TransactionFilterState()
        filters.type = review == .expenses ? .expense : .income
        filters.sortField = .amount
        filters.sortDescending = true
        await viewModel.applyFilters(filters)
        navigation.transactionsPendingReview = nil
    }

    private func openSearch() {
        guard !isSearchPresented else {
            isSearchFieldFocused = true
            return
        }

        isSearchPresented = true
        DispatchQueue.main.async {
            isSearchFieldFocused = true
        }
    }

    private func closeSearch() {
        let anchorID = currentScrollAnchorID
        isSearchFieldFocused = false
        isSearchPresented = false

        let trimmedSearchText = viewModel.searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        let appliedSearch = viewModel.filters.search.trimmingCharacters(in: .whitespacesAndNewlines)

        if !appliedSearch.isEmpty {
            pendingScrollRestoreID = anchorID
        }

        if trimmedSearchText.isEmpty {
            if !appliedSearch.isEmpty {
                Task { await viewModel.applySearch() }
            }
            return
        }

        viewModel.searchText = ""
    }

    private func restorePendingScrollPosition(using proxy: ScrollViewProxy) {
        guard let pendingScrollRestoreID else { return }
        guard viewModel.transactions.contains(where: { $0.id == pendingScrollRestoreID }) else {
            self.pendingScrollRestoreID = nil
            return
        }

        let targetID = pendingScrollRestoreID
        self.pendingScrollRestoreID = nil
        DispatchQueue.main.async {
            withAnimation(.easeInOut(duration: 0.2)) {
                proxy.scrollTo(targetID, anchor: .top)
            }
        }
    }

    private func handleTransactionLongPress(_ transaction: TransactionItem) {
        if viewModel.isBulkEditing {
            selectTransactionIfNeeded(transaction)
            return
        }

        HapticFeedback.multiSelectBegan()
        viewModel.startBulkEditing(selecting: transaction)
    }

    private func handleTransactionTap(_ transaction: TransactionItem) {
        if viewModel.isBulkEditing {
            toggleTransactionSelection(transaction)
            return
        }

        activeSheet = .edit(transaction)
    }

    private func selectTransactionIfNeeded(_ transaction: TransactionItem) {
        guard !viewModel.selectedTransactionIds.contains(transaction.id) else { return }
        viewModel.startBulkEditing(selecting: transaction)
        HapticFeedback.selectionChanged()
    }

    private func toggleTransactionSelection(_ transaction: TransactionItem) {
        viewModel.toggleSelection(for: transaction)
        HapticFeedback.selectionChanged()
    }

    private func openSwipeRuleEditor(for transaction: TransactionItem) async {
        do {
            let result = try await viewModel.prepareSwipeRuleEditor(for: transaction)
            swipeRulePresentation = SwipeRuleEditorPresentation(
                prompt: result.prompt,
                context: result.context
            )
        } catch {
            if error.isCancellation { return }
            bulkActionErrorMessage = error.localizedDescription
        }
    }

    private func hideFromSwipe(_ transaction: TransactionItem) async {
        do {
            let prompt = try await viewModel.hide(transaction)
            activeSheet = prompt.map(TransactionSheet.rulePrompt)
        } catch {
            if error.isCancellation { return }
            bulkActionErrorMessage = error.localizedDescription
        }
    }

    private func unhideFromSwipe(_ transaction: TransactionItem) async {
        do {
            try await viewModel.unhide(transaction)
        } catch {
            if error.isCancellation { return }
            bulkActionErrorMessage = error.localizedDescription
        }
    }

    private func transactionListRow(for transaction: TransactionItem, showsDate: Bool) -> some View {
        TransactionListRow(
            transaction: transaction,
            showsDate: showsDate,
            isSelected: viewModel.selectedTransactionIds.contains(transaction.id),
            swipeActionsEnabled: !viewModel.isBulkEditing,
            onTap: { handleTransactionTap(transaction) },
            onLongPress: { handleTransactionLongPress(transaction) },
            onRule: { Task { await openSwipeRuleEditor(for: transaction) } },
            onHide: { Task { await hideFromSwipe(transaction) } },
            onUnhide: { Task { await unhideFromSwipe(transaction) } }
        )
        .id(transaction.id)
        .onAppear {
            visibleTransactionIDs.insert(transaction.id)
        }
        .onDisappear {
            visibleTransactionIDs.remove(transaction.id)
        }
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: MoatTheme.Spacing.small) {
                FilterChip(
                    title: viewModel.filters.type?.title ?? "All types",
                    systemImage: "arrow.up.arrow.down",
                    isActive: viewModel.filters.type != nil
                ) {
                    activeSheet = .filters(.type)
                }

                FilterChip(
                    title: viewModel.filters.categoryChipTitle,
                    systemImage: "folder",
                    isActive: viewModel.filters.hasCategoryFilter
                ) {
                    activeSheet = .filters(.category)
                }

                FilterChip(
                    title: viewModel.filters.hashtag.map { "#\($0)" } ?? "Hashtag",
                    systemImage: "number",
                    isActive: viewModel.filters.hashtag != nil
                ) {
                    activeSheet = .filters(.hashtag)
                }

                FilterChip(
                    title: viewModel.filters.dateRangeTitle,
                    systemImage: "calendar",
                    isActive: viewModel.filters.startDate != nil || viewModel.filters.endDate != nil
                ) {
                    activeSheet = .filters(.dateRange)
                }

                FilterChip(
                    title: viewModel.filters.sortTitle,
                    systemImage: "arrow.up.arrow.down",
                    isActive: viewModel.filters.sortField != .date || !viewModel.filters.sortDescending
                ) {
                    activeSheet = .filters(.sort)
                }

                if viewModel.filters.hasActiveFilters {
                    FilterChip(title: "Clear", systemImage: "xmark", isActive: true) {
                        Task { await viewModel.clearFilters() }
                    }
                }
            }
        }
    }

    private var emptyTransactions: some View {
        VStack(spacing: MoatTheme.Spacing.medium) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("No transactions found")
                .font(.headline)
            Text("Try changing the search or filters.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, MoatTheme.Spacing.xxLarge)
    }

    @ViewBuilder
    private var paginationFooter: some View {
        Group {
            if viewModel.isLoadingMore {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, MoatTheme.Spacing.large)
            } else if viewModel.nextCursor != nil {
                Color.clear
                    .frame(height: 1)
                    .onAppear {
                        Task { await viewModel.loadNextPage() }
                    }
            } else {
                Text("End of transactions")
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, MoatTheme.Spacing.large)
            }
        }
    }

}

enum TransactionFilterSheetFocus: String, Identifiable, Equatable {
    case type
    case category
    case hashtag
    case dateRange
    case sort

    var id: String { rawValue }

    var title: String {
        switch self {
        case .type: "Type"
        case .category: "Category"
        case .hashtag: "Hashtag"
        case .dateRange: "Date range"
        case .sort: "Sort"
        }
    }
}

enum TransactionSheet: Identifiable {
    case edit(TransactionItem)
    case filters(TransactionFilterSheetFocus?)
    case bulkActions
    case rulePrompt(TransactionRulePrompt)

    var id: String {
        switch self {
        case .edit(let transaction): "edit-\(transaction.id)"
        case .filters(let focus): "filters-\(focus?.rawValue ?? "all")"
        case .bulkActions: "bulk-actions"
        case .rulePrompt(let prompt): "rule-prompt-\(prompt.id)"
        }
    }
}

private struct SwipeRuleEditorPresentation: Identifiable {
    let id = UUID()
    let prompt: TransactionRulePrompt
    let context: TransactionRuleEditorContext
}

private struct TransactionDayBand: View {
    let title: String
    let dayNet: Double

    var body: some View {
        HStack(alignment: .center, spacing: MoatTheme.Spacing.medium) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .lineLimit(1)

            Spacer(minLength: MoatTheme.Spacing.small)

            Text(CurrencyFormatter.format(dayNet))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .padding(.horizontal, MoatTheme.Spacing.medium)
        .padding(.vertical, MoatTheme.Spacing.small)
        .frame(maxWidth: .infinity, alignment: .leading)
        .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
        .listRowBackground(MoatTheme.ColorToken.appBackground)
        .listRowSeparator(.hidden)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title), \(CurrencyFormatter.format(dayNet))")
    }
}

private struct TransactionListRow: View {
    let transaction: TransactionItem
    let showsDate: Bool
    let isSelected: Bool
    let swipeActionsEnabled: Bool
    let onTap: () -> Void
    let onLongPress: () -> Void
    let onRule: () -> Void
    let onHide: () -> Void
    let onUnhide: () -> Void

    @State private var didLongPress = false

    var body: some View {
        Button {
            if didLongPress {
                didLongPress = false
                return
            }
            onTap()
        } label: {
            TransactionRow(
                transaction: transaction,
                showsDate: showsDate,
                isSelected: isSelected
            )
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
        .listRowBackground(MoatTheme.ColorToken.surface)
        .simultaneousGesture(
            LongPressGesture(minimumDuration: 0.5).onEnded { _ in
                didLongPress = true
                onLongPress()
            }
        )
        .modifier(
            TransactionRowSwipeActionsModifier(
                isEnabled: swipeActionsEnabled,
                isHidden: transaction.isHiddenTransaction,
                onRule: onRule,
                onHide: onHide,
                onUnhide: onUnhide
            )
        )
    }
}

private struct TransactionRowSwipeActionsModifier: ViewModifier {
    let isEnabled: Bool
    let isHidden: Bool
    let onRule: () -> Void
    let onHide: () -> Void
    let onUnhide: () -> Void

    @ViewBuilder
    func body(content: Content) -> some View {
        if isEnabled {
            content
                .swipeActions(edge: .leading, allowsFullSwipe: true) {
                    Button(action: onRule) {
                        Label("Rule", systemImage: "wand.and.stars")
                    }
                    .tint(MoatTheme.ColorToken.accent)
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    if isHidden {
                        Button(action: onUnhide) {
                            Label("Unhide", systemImage: "eye")
                        }
                        .tint(MoatTheme.ColorToken.accent)
                    } else {
                        Button(action: onHide) {
                            Label("Hide", systemImage: "eye.slash")
                        }
                        .tint(MoatTheme.ColorToken.swipeNeutral)
                    }
                }
        } else {
            content
        }
    }
}

private struct TransactionsSummaryGrid: View {
    let summary: TransactionSummary
    let totalCount: Int

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: MoatTheme.Spacing.medium) {
            MetricTile(title: "Income", value: CurrencyFormatter.formatCompact(summary.incomeSum), systemImage: "arrow.down", tint: MoatTheme.ColorToken.positive)
            MetricTile(title: "Expenses", value: CurrencyFormatter.formatCompact(summary.expenseSum), systemImage: "arrow.up", tint: MoatTheme.ColorToken.destructive)
            MetricTile(title: "Net", value: CurrencyFormatter.formatCompact(summary.net), systemImage: "equal", tint: summary.net >= 0 ? MoatTheme.ColorToken.positive : MoatTheme.ColorToken.warning)
            MetricTile(title: "Items", value: "\(totalCount)", systemImage: "list.bullet", tint: MoatTheme.ColorToken.accent)
        }
    }
}

struct TransactionRulePromptSheet: View {
    let prompt: TransactionRulePrompt
    let hashtags: [HashtagSummary]
    let onDismiss: () -> Void
    let onPrepareEditor: () async throws -> TransactionRuleEditorContext
    let onSaveRule: (EditableRuleDraft, Bool) async throws -> Void
    let onFetchPreview: (EditableRuleDraft) async throws -> RuleDraftPreview

    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var isRuleEditorPresented = false
    @State private var editorContext: TransactionRuleEditorContext?

    var body: some View {
        MoatFittedGlassSheet(title: prompt.title) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                    Text(prompt.summaryTitle)
                        .font(.headline)
                    Text(prompt.originalDescription)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                Text(message)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(MoatTheme.ColorToken.destructive)
                }
            }
        } footer: {
            MoatSheetActionBar {
                Button {
                    onDismiss()
                } label: {
                    Text("Not now").frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatSecondary)
                .disabled(isWorking)

                Button {
                    Task { await openEditor() }
                } label: {
                    if isWorking {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Label(actionTitle, systemImage: "wand.and.stars").frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.moatPrimary)
                .disabled(isWorking)
            }
        }
        .sheet(isPresented: $isRuleEditorPresented) {
            if let editorContext {
                RuleEditorSheet(
                    mode: editorContext.existingRule.map { .edit($0) } ?? .create,
                    title: prompt.editorTitle,
                    initialDraft: editorContext.draft,
                    hashtags: hashtags,
                    onSave: { draft, applyToHistorical in
                        try await onSaveRule(draft, applyToHistorical)
                        isRuleEditorPresented = false
                    },
                    onFetchPreview: onFetchPreview,
                    onDelete: {}
                )
            }
        }
    }

    private var message: String {
        switch prompt.mode {
        case .create:
            return "Save this as a rule so similar future transactions are updated automatically."
        case .update:
            return "Add this edit to the rule already linked to the transaction."
        }
    }

    private var actionTitle: String {
        prompt.editorTitle
    }

    private func openEditor() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            editorContext = try await onPrepareEditor()
            isRuleEditorPresented = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct MetricTile: View {
    let title: String
    let value: String
    let systemImage: String
    let tint: Color

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                Image(systemName: systemImage)
                    .font(.title3)
                    .foregroundStyle(tint)
                Text(value)
                    .font(.title3.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct TransactionRow: View {
    let transaction: TransactionItem
    let showsDate: Bool
    let isSelected: Bool

    var body: some View {
        HStack(alignment: .center, spacing: MoatTheme.Spacing.medium) {
            transactionTypeOrSelectionIcon

            VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                HStack(alignment: .center, spacing: MoatTheme.Spacing.medium) {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(alignment: .center, spacing: MoatTheme.Spacing.xSmall) {
                            Text(transaction.displayTitle)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.primary)
                                .lineLimit(1)

                            if transaction.isPendingTransaction {
                                Text("PENDING")
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(MoatTheme.ColorToken.elevatedSurface)
                                    .clipShape(Capsule())
                                    .fixedSize(horizontal: true, vertical: false)
                                    .accessibilityLabel("Pending")
                            }

                            if transaction.isHiddenTransaction {
                                Image(systemName: "eye.slash")
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(MoatTheme.ColorToken.elevatedSurface)
                                    .clipShape(Capsule())
                                    .fixedSize(horizontal: true, vertical: false)
                                    .accessibilityLabel("Hidden")
                            }
                        }

                        if showsDate {
                            Text(transaction.displaySubtitle)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                    .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)

                    Text(CurrencyFormatter.format(transaction.signedAmount))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(transaction.type == .income ? MoatTheme.ColorToken.positive : MoatTheme.ColorToken.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }

                HStack(spacing: MoatTheme.Spacing.xSmall) {
                    if transaction.hasExistingSplit {
                        Label("Split", systemImage: "scissors")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(MoatTheme.ColorToken.elevatedSurface)
                            .clipShape(Capsule())
                    }
                    Text(transaction.displayCategory)
                        .font(.caption2.weight(.medium))
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(MoatTheme.ColorToken.elevatedSurface)
                        .clipShape(Capsule())
                    ForEach(transaction.hashtagNames, id: \.self) { hashtag in
                        Text("#\(hashtag)")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .fixedSize(horizontal: true, vertical: false)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, MoatTheme.Spacing.medium)
        .padding(.vertical, MoatTheme.Spacing.medium + 1)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .opacity(transaction.isHiddenTransaction ? 0.45 : 1)
        .background(isSelected ? MoatTheme.ColorToken.accent.opacity(0.12) : Color.clear)
    }

    @ViewBuilder
    private var transactionTypeOrSelectionIcon: some View {
        if isSelected {
            ZStack {
                Circle()
                    .fill(MoatTheme.ColorToken.accent)
                Image(systemName: "checkmark")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 38, height: 38)
        } else {
            ZStack {
                Circle()
                    .fill(MoatTheme.ColorToken.mutedSurface)
                Image(systemName: transaction.displayCategorySystemImage)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(MoatTheme.ColorToken.ink)
            }
            .frame(width: 38, height: 38)
            .accessibilityLabel(transaction.displayCategory)
        }
    }
}

private struct BulkSelectionBar: View {
    let selectedCount: Int
    let visibleCount: Int
    let onSelectVisible: () -> Void
    let onClear: () -> Void
    let onDone: () -> Void
    let onActions: () -> Void

    private var hasSelection: Bool {
        selectedCount > 0
    }

    var body: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                HStack {
                    Label("\(selectedCount) selected", systemImage: "checkmark")
                        .font(.subheadline.weight(.semibold))

                    Spacer()

                    Button("Done", action: onDone)
                        .font(.subheadline.weight(.semibold))
                }

                HStack(spacing: MoatTheme.Spacing.small) {
                    Button(hasSelection ? "Deselect all" : "Select all") {
                        if hasSelection {
                            onClear()
                        } else {
                            onSelectVisible()
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .buttonStyle(.moatSecondarySmall)
                    .disabled(visibleCount == 0)

                    Button {
                        onActions()
                    } label: {
                        Text("Actions")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatPrimarySmall)
                    .disabled(selectedCount == 0)
                }
            }
        }
    }
}

private struct TransactionFilterSheet: View {
    let categories: [String]
    let hashtags: [HashtagSummary]
    let focus: TransactionFilterSheetFocus?
    let onApply: (TransactionFilterState) async -> Void
    let onClear: () async -> Void

    @State private var draft: TransactionFilterState
    @State private var startDateEnabled: Bool
    @State private var endDateEnabled: Bool
    @State private var startDate: Date
    @State private var endDate: Date
    @State private var isWorking = false

    init(
        filters: TransactionFilterState,
        categories: [String],
        hashtags: [HashtagSummary],
        focus: TransactionFilterSheetFocus? = nil,
        onApply: @escaping (TransactionFilterState) async -> Void,
        onClear: @escaping () async -> Void
    ) {
        self.categories = categories
        self.hashtags = hashtags
        self.focus = focus
        self.onApply = onApply
        self.onClear = onClear
        _draft = State(initialValue: filters)
        _startDateEnabled = State(initialValue: filters.startDate != nil)
        _endDateEnabled = State(initialValue: filters.endDate != nil)
        _startDate = State(initialValue: filters.startDate ?? Calendar.current.date(byAdding: .month, value: -1, to: Date()) ?? Date())
        _endDate = State(initialValue: filters.endDate ?? Date())
    }

    private var sheetTitle: String {
        focus?.title ?? "Filter transactions"
    }

    private var showsActionFooter: Bool {
        switch focus {
        case .type, .category, .hashtag:
            return false
        case .dateRange, .sort, nil:
            return true
        }
    }

    var body: some View {
        Group {
            if showsActionFooter {
                MoatGlassSheet(title: sheetTitle) {
                    sheetContent
                } footer: {
                    actionFooter
                }
            } else {
                MoatGlassSheet(title: sheetTitle) {
                    sheetContent
                }
            }
        }
        .interactiveDismissDisabled(isWorking)
    }

    @ViewBuilder
    private var sheetContent: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
            if let focus {
                focusedContent(focus)
            } else {
                fullContent
            }
        }
    }

    private var actionFooter: some View {
        MoatSheetActionBar {
            Button {
                Task { await clear() }
            } label: {
                Label("Clear", systemImage: "xmark").frame(maxWidth: .infinity)
            }
            .buttonStyle(.moatSecondary)
            .disabled(isWorking)

            Button {
                Task { await apply() }
            } label: {
                if isWorking {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Label("Apply", systemImage: "checkmark").frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.moatPrimary)
            .disabled(isWorking)
        }
    }

    @ViewBuilder
    private var fullContent: some View {
        filterSection("Search") {
            MoatTextField(placeholder: "Search transactions", text: $draft.search)
        }

        filterSection("Filters") {
            typePicker
            categoryMenu
            hashtagMenu
        }

        filterSection("Date range") {
            dateRangeControls
        }

        filterSection("Sort") {
            sortControls
        }
    }

    @ViewBuilder
    private func focusedContent(_ focus: TransactionFilterSheetFocus) -> some View {
        switch focus {
        case .type:
            focusedOptionList(
                clearTitle: "All types",
                isClearSelected: draft.type == nil,
                onClear: {
                    draft.type = nil
                    Task { await apply() }
                },
                options: TransactionKind.allCases.map { (title: $0.title, value: $0.rawValue) },
                selectedValue: draft.type?.rawValue,
                onSelect: { rawValue in
                    draft.type = TransactionKind(rawValue: rawValue)
                    Task { await apply() }
                }
            )
        case .category:
            focusedOptionList(
                clearTitle: "All categories",
                isClearSelected: !draft.hasCategoryFilter,
                onClear: {
                    draft.category = nil
                    draft.categories = []
                    Task { await apply() }
                },
                options: categories.map { (title: $0, value: $0) },
                selectedValue: draft.categories.count > 1 ? nil : (draft.categories.first ?? draft.category),
                onSelect: { category in
                    draft.category = category
                    draft.categories = []
                    Task { await apply() }
                }
            )
        case .hashtag:
            focusedOptionList(
                clearTitle: "All hashtags",
                isClearSelected: draft.hashtag == nil,
                onClear: {
                    draft.hashtag = nil
                    Task { await apply() }
                },
                options: hashtags.map { (title: "#\($0.name)", value: $0.normalizedName ?? $0.name) },
                selectedValue: draft.hashtag,
                onSelect: { hashtag in
                    draft.hashtag = hashtag
                    Task { await apply() }
                }
            )
        case .dateRange:
            focusedPanel {
                dateRangeControls
            }
        case .sort:
            focusedPanel {
                sortControls
            }
        }
    }

    private func focusedPanel<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            content()
        }
        .padding(MoatTheme.Spacing.medium)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }

    private var typePicker: some View {
        Picker("Type", selection: $draft.type) {
            Text("All").tag(nil as TransactionKind?)
            ForEach(TransactionKind.allCases) { kind in
                Text(kind.title).tag(kind as TransactionKind?)
            }
        }
        .pickerStyle(.segmented)
    }

    private var categoryMenu: some View {
        Menu {
            Button("All categories") {
                draft.category = nil
                draft.categories = []
            }
            ForEach(categories, id: \.self) { category in
                Button(category) {
                    draft.category = category
                    draft.categories = []
                }
            }
        } label: {
            sheetMenuLabel(
                title: draft.hasCategoryFilter ? draft.categoryChipTitle : "All categories",
                systemImage: "folder"
            )
        }
    }

    private var hashtagMenu: some View {
        Menu {
            Button("All hashtags") { draft.hashtag = nil }
            ForEach(hashtags) { hashtag in
                Button("#\(hashtag.name)") { draft.hashtag = hashtag.normalizedName ?? hashtag.name }
            }
        } label: {
            sheetMenuLabel(title: draft.hashtag.map { "#\($0)" } ?? "All hashtags", systemImage: "number")
        }
    }

    private func focusedOptionList(
        clearTitle: String,
        isClearSelected: Bool,
        onClear: @escaping () -> Void,
        options: [(title: String, value: String)],
        selectedValue: String?,
        onSelect: @escaping (String) -> Void
    ) -> some View {
        VStack(spacing: 0) {
            focusedOptionRow(title: clearTitle, isSelected: isClearSelected, action: onClear)

            if options.isEmpty {
                Divider()
                    .padding(.horizontal, MoatTheme.Spacing.medium)
                Text("No options available")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(MoatTheme.Spacing.medium)
            } else {
                ForEach(options, id: \.value) { option in
                    Divider()
                        .padding(.horizontal, MoatTheme.Spacing.medium)
                    focusedOptionRow(
                        title: option.title,
                        isSelected: selectedValue?.caseInsensitiveCompare(option.value) == .orderedSame,
                        action: { onSelect(option.value) }
                    )
                }
            }
        }
        .background(MoatTheme.ColorToken.surface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
    }

    private func focusedOptionRow(title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: MoatTheme.Spacing.medium) {
                Text(title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(MoatTheme.ColorToken.accent)
                }
            }
            .padding(.horizontal, MoatTheme.Spacing.medium)
            .padding(.vertical, MoatTheme.Spacing.large)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var dateRangeControls: some View {
        Toggle("Start date", isOn: $startDateEnabled)
            .moatToggleStyle()
        if startDateEnabled {
            DatePicker("From", selection: $startDate, displayedComponents: .date)
        }

        Toggle("End date", isOn: $endDateEnabled)
            .moatToggleStyle()
        if endDateEnabled {
            DatePicker("To", selection: $endDate, displayedComponents: .date)
        }
    }

    @ViewBuilder
    private var sortControls: some View {
        Picker("Sort by", selection: $draft.sortField) {
            ForEach(TransactionSortField.allCases) { field in
                Text(field.title).tag(field)
            }
        }
        Picker("Direction", selection: $draft.sortDescending) {
            Text("Descending").tag(true)
            Text("Ascending").tag(false)
        }
        .pickerStyle(.segmented)
    }

    private func apply() async {
        isWorking = true
        defer { isWorking = false }
        draft.startDate = startDateEnabled ? Calendar.current.startOfDay(for: startDate) : nil
        draft.endDate = endDateEnabled ? endDate : nil
        await onApply(draft)
    }

    private func clear() async {
        isWorking = true
        defer { isWorking = false }

        guard let focus else {
            await onClear()
            return
        }

        clearFocusedField(focus)
        draft.startDate = startDateEnabled ? Calendar.current.startOfDay(for: startDate) : nil
        draft.endDate = endDateEnabled ? endDate : nil
        await onApply(draft)
    }

    private func clearFocusedField(_ focus: TransactionFilterSheetFocus) {
        switch focus {
        case .type:
            draft.type = nil
        case .category:
            draft.category = nil
            draft.categories = []
        case .hashtag:
            draft.hashtag = nil
        case .dateRange:
            startDateEnabled = false
            endDateEnabled = false
            draft.startDate = nil
            draft.endDate = nil
        case .sort:
            draft.sortField = .date
            draft.sortDescending = true
        }
    }
}

private struct BulkTransactionsSheet: View {
    let selectedCount: Int
    let allHashtags: [HashtagSummary]
    let onChangeCategory: (String) async throws -> Void
    let onAddHashtags: ([String]) async throws -> Void
    let onHide: () async throws -> Void

    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var selectedHashtags: [String] = []
    @State private var newHashtagText = ""
    @State private var isCategoryPickerPresented = false

    private var hashtagSuggestions: [HashtagSummary] {
        HashtagSuggestions.matching(
            from: allHashtags,
            excluding: selectedHashtags,
            query: newHashtagText
        )
    }

    var body: some View {
        MoatGlassSheet(title: "Bulk actions") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                Text("\(selectedCount) transactions selected")
                    .font(.headline)
                Text("Change the category, add hashtags, or hide the selected transactions.")
                    .font(.body)
                    .foregroundStyle(.secondary)

                Button {
                    isCategoryPickerPresented = true
                } label: {
                    sheetMenuLabel(title: "Change Category", systemImage: "folder")
                }
                .buttonStyle(.plain)
                .disabled(isWorking)

                HashtagEditor(
                    selected: $selectedHashtags,
                    newHashtag: $newHashtagText,
                    suggestions: hashtagSuggestions
                )

                if isWorking {
                    ProgressView().frame(maxWidth: .infinity)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(MoatTheme.ColorToken.destructive)
                }
            }
        } footer: {
            MoatSheetActionBar {
                Button {
                    Task { await perform { try await onHide() } }
                } label: {
                    Label("Hide", systemImage: "eye.slash")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatSecondary)
                .disabled(isWorking)
                .accessibilityLabel("Hide selected transactions")

                Button {
                    Task { await perform { try await onAddHashtags(hashtagsToApply()) } }
                } label: {
                    Label("Apply changes", systemImage: "checkmark")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatPrimary)
                .disabled(isWorking || hashtagsToApply().isEmpty)
            }
        }
        .sheet(isPresented: $isCategoryPickerPresented) {
            CategoryPickerSheet(selectedCategoryName: nil) { category in
                isCategoryPickerPresented = false
                Task { await perform { try await onChangeCategory(category) } }
            }
        }
    }

    private func hashtagsToApply() -> [String] {
        let pending = newHashtagText
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
        var tags = selectedHashtags
        if !pending.isEmpty, !tags.contains(where: { $0.lowercased() == pending.lowercased() }) {
            tags.append(pending)
        }
        return tags
    }

    private func perform(_ operation: () async throws -> Void) async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await operation()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private enum TransactionCategoryPickerTarget: Identifiable, Equatable {
    case main
    case split(Int)

    var id: String {
        switch self {
        case .main:
            return "main"
        case .split(let index):
            return "split-\(index)"
        }
    }
}

struct TransactionDetailSheet: View {
    @SwiftUI.Environment(\.dismiss) private var dismiss

    let transaction: TransactionItem
    let allHashtags: [HashtagSummary]
    let allTransactions: [TransactionItem]
    let onSave: (String, Double?, String, TransactionKind, [String]) async throws -> Void
    let onSplit: (String, Double, Double, String, String, TransactionKind, [String]) async throws -> Void
    let onUnsplit: () async throws -> Void
    let onHide: () async throws -> Void
    let onUnhide: () async throws -> Void
    let onPrepareRuleEditor: () async throws -> (prompt: TransactionRulePrompt, context: TransactionRuleEditorContext)
    let onSaveRule: (TransactionRulePrompt, EditableRuleDraft, Bool) async throws -> Void
    let onFetchRulePreview: (TransactionRulePrompt, EditableRuleDraft) async throws -> RuleDraftPreview
    let onResolveManageRuleTitle: () async -> String
    var onShowMoreCommunityTips: ((String) -> Void)? = nil

    @State private var draftName: String
    @State private var draftCategory: String
    @State private var draftHashtags: [String]
    @State private var isEditingName = false
    @State private var hasSelectedNameOnEdit = false
    @State private var isHideConfirmationPresented = false
    @State private var isHashtagPickerPresented = false
    @State private var categoryPickerTarget: TransactionCategoryPickerTarget?
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var isSplitEnabled = false
    @State private var splitOriginalTotal: Double
    @State private var draftOriginalAmount: String
    @State private var draftSplits: [SplitDraft] = []
    @State private var communityTipRecommendations: [CommunityTipTransactionRecommendation] = []
    @State private var showCommunityTipsOnTransactions = true
    @State private var communityTipsSettingsLoaded = false
    @State private var selectedTipIdForDetail: String?
    @State private var ruleEditorPresentation: SwipeRuleEditorPresentation?
    @State private var manageRuleTitle: String

    @FocusState private var nameFieldFocused: Bool
    @FocusState private var isOriginalAmountFocused: Bool

    private static let shortDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return f
    }()

    init(
        transaction: TransactionItem,
        allHashtags: [HashtagSummary],
        allTransactions: [TransactionItem],
        onSave: @escaping (String, Double?, String, TransactionKind, [String]) async throws -> Void,
        onSplit: @escaping (String, Double, Double, String, String, TransactionKind, [String]) async throws -> Void,
        onUnsplit: @escaping () async throws -> Void,
        onHide: @escaping () async throws -> Void,
        onUnhide: @escaping () async throws -> Void,
        onPrepareRuleEditor: @escaping () async throws -> (prompt: TransactionRulePrompt, context: TransactionRuleEditorContext),
        onSaveRule: @escaping (TransactionRulePrompt, EditableRuleDraft, Bool) async throws -> Void,
        onFetchRulePreview: @escaping (TransactionRulePrompt, EditableRuleDraft) async throws -> RuleDraftPreview,
        onResolveManageRuleTitle: @escaping () async -> String,
        onShowMoreCommunityTips: ((String) -> Void)? = nil
    ) {
        self.transaction = transaction
        self.allHashtags = allHashtags
        self.allTransactions = allTransactions
        self.onSave = onSave
        self.onSplit = onSplit
        self.onUnsplit = onUnsplit
        self.onHide = onHide
        self.onUnhide = onUnhide
        self.onPrepareRuleEditor = onPrepareRuleEditor
        self.onSaveRule = onSaveRule
        self.onFetchRulePreview = onFetchRulePreview
        self.onResolveManageRuleTitle = onResolveManageRuleTitle
        self.onShowMoreCommunityTips = onShowMoreCommunityTips
        _draftName = State(initialValue: transaction.description ?? transaction.displayTitle)
        _draftCategory = State(initialValue: transaction.displayCategory)
        _draftHashtags = State(initialValue: transaction.hashtagNames)
        _splitOriginalTotal = State(initialValue: transaction.splitOriginalAmount ?? transaction.amount)
        _draftOriginalAmount = State(initialValue: TransactionAmountInput.format(transaction.amount))
        _manageRuleTitle = State(
            initialValue: transaction.appliedRuleId == nil ? "Create a rule" : "Update rule"
        )
    }

    private var metadataText: String {
        let dateText = Self.shortDateFormatter.string(from: transaction.postedDate ?? transaction.date)
        var parts: [String] = []
        if let account = transaction.account, !account.isEmpty {
            parts.append(account)
        } else {
            parts.append("No account")
        }
        parts.append(dateText)
        return parts.joined(separator: " • ")
    }

    private var memoText: String {
        let trimmed = transaction.originalDescription?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? "N/A" : trimmed
    }

    private var accountText: String {
        let trimmed = transaction.account?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? "—" : trimmed
    }

    private var splitSiblings: [TransactionItem] {
        transaction.splitSiblings(in: allTransactions)
    }

    private var existingSplitAmountText: String {
        guard let sibling = splitSiblings.first else { return "--" }
        return CurrencyFormatter.format(sibling.signedAmount)
    }

    private var existingSplitCategoryText: String {
        splitSiblings.first?.displayCategory ?? "Part of a split"
    }

    private var canStartSplit: Bool {
        !transaction.hasExistingSplit && !transaction.isPendingPlaidTransaction && !isSplitEnabled
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
            // X / checkmark toolbar
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(.primary)
                        .frame(width: 42, height: 42)
                        .background(Color(.tertiarySystemFill))
                        .clipShape(Circle())
                }
                Spacer()
                Button {
                    HapticFeedback.saveOrSubmit()
                    Task { await performSave() }
                } label: {
                    if isWorking {
                        ProgressView()
                            .frame(width: 42, height: 42)
                    } else {
                        Image(systemName: "checkmark")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 42, height: 42)
                            .background(MoatTheme.ColorToken.accent)
                            .clipShape(Circle())
                    }
                }
                .disabled(isWorking)
            }
            .padding(.horizontal, MoatTheme.Spacing.large)
            .padding(.top, MoatTheme.Spacing.medium)
            .padding(.bottom, MoatTheme.Spacing.small)

            ScrollView {
                VStack(spacing: 0) {
                    // Amount — read-only, prominent, centered
                    Text(CurrencyFormatter.format(transaction.signedAmount))
                        .font(.system(size: 38, weight: .bold))
                        .foregroundStyle(transaction.type == .income ? MoatTheme.ColorToken.positive : MoatTheme.ColorToken.textPrimary)
                        .frame(maxWidth: .infinity)
                        .multilineTextAlignment(.center)
                        .padding(.top, MoatTheme.Spacing.large)
                        .padding(.bottom, MoatTheme.Spacing.xSmall)

                    if isEditingName {
                        TextField("Transaction description", text: $draftName)
                            .textFieldStyle(.plain)
                            .font(.title3.weight(.semibold))
                            .multilineTextAlignment(.center)
                            .focused($nameFieldFocused)
                            .onChange(of: nameFieldFocused) { focused in
                                guard focused, !hasSelectedNameOnEdit else { return }
                                hasSelectedNameOnEdit = true
                                selectAllFocusedText()
                            }
                            .submitLabel(.done)
                            .onSubmit {
                                isEditingName = false
                                hasSelectedNameOnEdit = false
                            }
                            .padding(.horizontal, MoatTheme.Spacing.large)
                            .padding(.bottom, MoatTheme.Spacing.xSmall)
                    } else {
                        Button {
                            hasSelectedNameOnEdit = false
                            isEditingName = true
                            nameFieldFocused = true
                        } label: {
                            HStack(spacing: 6) {
                                Text(draftName.isEmpty ? "Transaction description" : draftName)
                                    .font(.title3.weight(.semibold))
                                    .foregroundStyle(draftName.isEmpty ? Color.secondary : Color.primary)
                                    .multilineTextAlignment(.center)
                                Image(systemName: "pencil")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.horizontal, MoatTheme.Spacing.large)
                            .padding(.vertical, MoatTheme.Spacing.xSmall)
                        }
                        .buttonStyle(.plain)
                    }

                    heroMetadata
                        .padding(.top, MoatTheme.Spacing.xSmall)
                        .padding(.bottom, MoatTheme.Spacing.xLarge)

                    VStack(spacing: MoatTheme.Spacing.medium) {
                        detailsCard

                        if isSplitEnabled {
                            splitEditorSection
                        }

                        if transaction.hasExistingSplit && !isSplitEnabled {
                            existingSplitSection
                        }

                        actionsCard
                    }
                    .padding(.horizontal, MoatTheme.Spacing.large)

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(MoatTheme.ColorToken.destructive)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, MoatTheme.Spacing.large)
                            .padding(.top, MoatTheme.Spacing.medium)
                    }

                    if shouldShowCommunityTipsCard {
                        CommunityTipRecommendationCard(
                            recommendations: communityTipRecommendations,
                            showCommunityTips: $showCommunityTipsOnTransactions,
                            onShowCommunityTipsChange: { enabled in
                                Task { await setCommunityTipsPreference(enabled) }
                            },
                            onOpen: { tipId in selectedTipIdForDetail = tipId },
                            onShowMore: { searchQuery in
                                onShowMoreCommunityTips?(searchQuery)
                            }
                        )
                        .padding(.horizontal, MoatTheme.Spacing.large)
                        .padding(.top, MoatTheme.Spacing.medium)
                    }
                }
                .padding(.bottom, MoatTheme.Spacing.xxxLarge)
            }
            }
            .background(MoatTheme.ColorToken.appBackground)
            .toolbar(.hidden, for: .navigationBar)
            .moatKeyboardDismissToolbar()
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .transactionSheetCornerRadius(32)
        .task {
            await loadCommunityTipRecommendations()
            manageRuleTitle = await onResolveManageRuleTitle()
        }
        .sheet(item: $selectedTipIdForDetail) { tipId in
            NavigationStack {
                CommunityTipDetailView(tipId: tipId)
            }
        }
        .sheet(item: $categoryPickerTarget) { target in
            CategoryPickerSheet(selectedCategoryName: selectedCategoryName(for: target)) { category in
                applyCategorySelection(category, for: target)
                categoryPickerTarget = nil
            }
        }
        .sheet(isPresented: $isHashtagPickerPresented) {
            HashtagPickerSheet(
                selectedNames: $draftHashtags,
                allHashtags: allHashtags
            )
        }
        .sheet(isPresented: $isHideConfirmationPresented) {
            MoatGlassSheet(title: "Hide transaction") {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                    Text(transaction.displayTitle)
                        .font(.headline)
                    Text("This hides the transaction from budgets and charts. It stays in your list as Hidden.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
            } footer: {
                MoatSheetActionBar {
                    Button {
                        isHideConfirmationPresented = false
                    } label: {
                        Text("Cancel").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.moatSecondary)

                    Button(role: .destructive) {
                        Task { await performHide() }
                    } label: {
                        if isWorking {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Label("Hide", systemImage: "eye.slash").frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.moatDestructive)
                    .disabled(isWorking)
                }
            }
        }
        .sheet(item: $ruleEditorPresentation) { presentation in
            RuleEditorSheet(
                mode: presentation.context.existingRule.map { .edit($0) } ?? .create,
                title: presentation.prompt.editorTitle,
                initialDraft: presentation.context.draft,
                hashtags: allHashtags,
                onSave: { draft, applyToHistorical in
                    try await onSaveRule(presentation.prompt, draft, applyToHistorical)
                    ruleEditorPresentation = nil
                    dismiss()
                },
                onFetchPreview: { draft in
                    try await onFetchRulePreview(presentation.prompt, draft)
                },
                onDelete: {}
            )
        }
    }

    private var heroMetadata: some View {
        HStack(spacing: 6) {
            Text(metadataText)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if transaction.isPendingTransaction {
                TransactionEditMetadataBadge(title: "Pending")
            }
            if transaction.isHiddenTransaction {
                TransactionEditMetadataBadge(title: "Hidden")
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var detailsCard: some View {
        TransactionEditGroupedCard {
            TransactionEditDetailRow(
                systemImage: "square.on.square",
                label: "Category",
                interactive: true,
                action: { categoryPickerTarget = .main }
            ) {
                TransactionEditCategoryValue(categoryName: draftCategory)
            }

            Divider()

            TransactionEditDetailRow(
                systemImage: "number",
                label: "Hashtags",
                interactive: true,
                action: { isHashtagPickerPresented = true }
            ) {
                TransactionEditHashtagValue(names: draftHashtags)
            }

            Divider()

            TransactionEditDetailRow(
                systemImage: "building.columns",
                label: "Account"
            ) {
                Text(accountText)
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .lineLimit(1)
            }

            Divider()

            TransactionEditDetailRow(
                systemImage: "doc.text",
                label: "Memo"
            ) {
                Text(memoText)
                    .font(.subheadline)
                    .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.trailing)
            }
        }
    }

    private var actionsCard: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            TransactionEditGroupedCard {
                TransactionEditActionRow(
                    systemImage: "scissors",
                    label: transaction.hasExistingSplit ? "Already split" : "Split transaction",
                    disabled: isWorking || !canStartSplit,
                    action: startSplit
                )

                Divider()

                TransactionEditActionRow(
                    systemImage: transaction.isHiddenTransaction ? "eye" : "eye.slash",
                    label: transaction.isHiddenTransaction ? "Unhide transaction" : "Hide transaction",
                    disabled: isWorking,
                    action: {
                        if transaction.isHiddenTransaction {
                            Task { await performUnhide() }
                        } else {
                            isHideConfirmationPresented = true
                        }
                    }
                )

                Divider()

                TransactionEditActionRow(
                    systemImage: "sparkles",
                    label: manageRuleTitle,
                    disabled: isWorking,
                    action: { Task { await openRuleEditor() } }
                )
            }

            if transaction.isPendingPlaidTransaction {
                Text("Pending Plaid transactions can be split once they post.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, MoatTheme.Spacing.xSmall)
            }
        }
    }

    private var splitEditorSection: some View {
        VStack(spacing: 0) {
                HStack(spacing: MoatTheme.Spacing.medium) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("This transaction")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.secondary)
                        Text(draftCategory)
                            .font(.body.weight(.medium))
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    TextField("0.00", text: $draftOriginalAmount)
                        .textFieldStyle(.plain)
                        .font(.body.monospacedDigit())
                        .multilineTextAlignment(.trailing)
                        .keyboardType(.decimalPad)
                        .frame(width: 112)
                        .focused($isOriginalAmountFocused)
                        .onChange(of: draftOriginalAmount) { newValue in
                            updateOriginalAmount(newValue)
                        }
                        .padding(MoatTheme.Spacing.small)
                        .background(MoatTheme.ColorToken.mutedSurface)
                        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                                .strokeBorder(MoatTheme.ColorToken.softBorder, lineWidth: 1)
                        }
                        .moatInputFocusRing(isFocused: isOriginalAmountFocused, cornerRadius: MoatTheme.Radius.small)
                }
                .padding(MoatTheme.Spacing.medium)

                ForEach(Array(draftSplits.enumerated()), id: \.element.id) { index, _ in
                    Divider()
                        .padding(.horizontal, MoatTheme.Spacing.medium)

                    splitEditorRow(index: index)
                        .padding(MoatTheme.Spacing.medium)
                }

                Divider()
                    .padding(.horizontal, MoatTheme.Spacing.medium)

                HStack {
                    Spacer()
                    Button {
                        addSplitRow()
                    } label: {
                        Label("Add split", systemImage: "plus")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(MoatTheme.ColorToken.accent)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, MoatTheme.Spacing.medium)
                .padding(.vertical, MoatTheme.Spacing.medium)
        }
        .background(MoatTheme.ColorToken.mutedSurface.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                .strokeBorder(MoatTheme.ColorToken.border, lineWidth: 1)
        }
    }

    private func splitEditorRow(index: Int) -> some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            Button {
                categoryPickerTarget = .split(index)
            } label: {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.xSmall) {
                    Text("Split category")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)

                    HStack(spacing: MoatTheme.Spacing.small) {
                        Image(systemName: CategoryItem.systemImage(forName: draftSplits[index].category))
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(MoatTheme.ColorToken.textSecondary)

                        Text(draftSplits[index].category)
                            .font(.body.weight(.medium))
                            .lineLimit(1)
                            .foregroundStyle(.primary)

                        Image(systemName: "chevron.right")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)

            TransactionCompactAmountField(
                text: Binding(
                    get: { draftSplits[index].amount },
                    set: { updateSplitAmount(at: index, value: $0) }
                )
            )

            Button {
                removeSplitRow(at: index)
            } label: {
                Image(systemName: "xmark")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 32, height: 32)
                    .background(Color(.tertiarySystemFill))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove split")
        }
    }

    private func selectedCategoryName(for target: TransactionCategoryPickerTarget) -> String? {
        switch target {
        case .main:
            return draftCategory
        case .split(let index):
            guard draftSplits.indices.contains(index) else { return nil }
            return draftSplits[index].category
        }
    }

    private func applyCategorySelection(_ category: String, for target: TransactionCategoryPickerTarget) {
        switch target {
        case .main:
            draftCategory = category
        case .split(let index):
            guard draftSplits.indices.contains(index) else { return }
            draftSplits[index].category = category
        }
    }

    private var existingSplitSection: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            if splitSiblings.isEmpty {
                existingSplitRow(
                    category: existingSplitCategoryText,
                    amount: existingSplitAmountText
                )
            } else {
                ForEach(splitSiblings) { sibling in
                    existingSplitRow(
                        category: sibling.displayCategory,
                        amount: CurrencyFormatter.format(sibling.signedAmount)
                    )
                }
            }

            HStack {
                Spacer()
                Button {
                    Task { await performUnsplit() }
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 32, height: 32)
                        .background(Color(.tertiarySystemFill))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove split")
                .disabled(isWorking)
            }
        }
        .padding(MoatTheme.Spacing.medium)
        .background(MoatTheme.ColorToken.mutedSurface.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous)
                .strokeBorder(MoatTheme.ColorToken.border, lineWidth: 1)
        }
    }

    private func existingSplitRow(category: String, amount: String) -> some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            Text(category)
                .font(.body.weight(.medium))
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(MoatTheme.Spacing.medium)
                .background(MoatTheme.ColorToken.surface)
                .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                        .strokeBorder(MoatTheme.ColorToken.border, lineWidth: 1)
                }

            Text(amount)
                .font(.body.monospacedDigit().weight(.medium))
                .frame(width: 96)
                .padding(MoatTheme.Spacing.medium)
                .background(MoatTheme.ColorToken.surface)
                .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                        .strokeBorder(MoatTheme.ColorToken.border, lineWidth: 1)
                }
        }
    }

    private func startSplit() {
        isSplitEnabled = true
        splitOriginalTotal = transaction.amount
        draftOriginalAmount = TransactionAmountInput.format(transaction.amount)
        draftSplits = [SplitDraft(category: draftCategory)]
    }

    private func cancelSplit() {
        isSplitEnabled = false
        draftOriginalAmount = TransactionAmountInput.format(splitOriginalTotal)
        draftSplits = []
    }

    private func addSplitRow() {
        draftSplits.append(SplitDraft(category: draftCategory))
    }

    private func removeSplitRow(at index: Int) {
        if draftSplits.count == 1 {
            cancelSplit()
            return
        }

        draftSplits.remove(at: index)
        recalculateOriginalAmount()
    }

    private func recalculateOriginalAmount() {
        draftOriginalAmount = TransactionAmountInput.originalAmount(
            total: splitOriginalTotal,
            splitAmounts: draftSplits.map(\.amount)
        )
    }

    private func updateSplitAmount(at index: Int, value: String) {
        let otherAmounts = draftSplits.enumerated()
            .filter { $0.offset != index }
            .map(\.element.amount)
        draftSplits[index].amount = TransactionAmountInput.clampSplitAmount(
            value,
            total: splitOriginalTotal,
            otherSplitAmounts: otherAmounts
        )
        recalculateOriginalAmount()
    }

    private func updateOriginalAmount(_ value: String) {
        let formatted = AmountInputFormatter.formatTyping(value, fractionDigits: 2)
        let parsed = TransactionAmountInput.parse(formatted)
        let clampedOriginal = min(parsed, splitOriginalTotal)
        draftOriginalAmount = parsed > splitOriginalTotal
            ? TransactionAmountInput.format(clampedOriginal)
            : formatted

        guard !draftSplits.isEmpty else { return }

        let remainder = max(splitOriginalTotal - clampedOriginal, 0)
        let lastIndex = draftSplits.count - 1
        let otherTotal = draftSplits.enumerated()
            .filter { $0.offset != lastIndex }
            .reduce(0.0) { $0 + TransactionAmountInput.parse($1.element.amount) }
        let lastAmount = max(remainder - otherTotal, 0)
        draftSplits[lastIndex].amount = TransactionAmountInput.format(lastAmount)
    }

    private var shouldShowCommunityTipsCard: Bool {
        guard communityTipsSettingsLoaded else { return false }
        if !showCommunityTipsOnTransactions { return true }
        return !communityTipRecommendations.isEmpty
    }

    private func loadCommunityTipRecommendations() async {
        guard !transaction.id.isEmpty else { return }
        do {
            let settings = try await CommunityTipsService().getSettings()
            showCommunityTipsOnTransactions = settings.showCommunityTipsOnTransactions
            communityTipsSettingsLoaded = true
            guard settings.showCommunityTipsOnTransactions else {
                communityTipRecommendations = []
                return
            }
            let recommendations = try await CommunityTipsService().listForTransaction(
                transactionId: transaction.id,
                limit: 3
            )
            communityTipRecommendations = recommendations
        } catch {
            AppLogger.warn(
                "Failed to load community tip recommendations",
                metadata: ["transactionId": transaction.id, "error": error.localizedDescription]
            )
        }
    }

    private func setCommunityTipsPreference(_ enabled: Bool) async {
        do {
            _ = try await CommunityTipsService().setSettings(
                showCommunityTipsOnTransactions: enabled
            )
            showCommunityTipsOnTransactions = enabled
            if enabled {
                let recommendations = try await CommunityTipsService().listForTransaction(
                    transactionId: transaction.id,
                    limit: 3
                )
                communityTipRecommendations = recommendations
            } else {
                communityTipRecommendations = []
            }
        } catch {
            showCommunityTipsOnTransactions = !enabled
            AppLogger.warn(
                "Failed to save community tip settings",
                metadata: ["error": error.localizedDescription]
            )
        }
    }

    private func performSave() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            if isSplitEnabled {
                let originalAmount = TransactionAmountInput.parse(draftOriginalAmount)
                let filledSplits = draftSplits.filter { TransactionAmountInput.parse($0.amount) > 0 }
                guard originalAmount > 0, !filledSplits.isEmpty else {
                    errorMessage = "Split amounts must be greater than zero"
                    return
                }
                guard filledSplits.count == 1 else {
                    errorMessage = "Saving multiple splits isn't supported yet"
                    return
                }
                let split = filledSplits[0]
                let splitAmount = TransactionAmountInput.parse(split.amount)
                let trimmedCategory = draftCategory.trimmingCharacters(in: .whitespacesAndNewlines)
                let trimmedSplitCategory = split.category.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmedCategory.isEmpty, !trimmedSplitCategory.isEmpty else {
                    errorMessage = "Both split categories are required"
                    return
                }

                try await onSplit(
                    draftName,
                    originalAmount,
                    splitAmount,
                    trimmedCategory,
                    trimmedSplitCategory,
                    transaction.type,
                    draftHashtags
                )
                dismiss()
                return
            }

            try await onSave(draftName, nil, draftCategory, transaction.type, draftHashtags)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func openRuleEditor() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            let result = try await onPrepareRuleEditor()
            ruleEditorPresentation = SwipeRuleEditorPresentation(
                prompt: result.prompt,
                context: result.context
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func performHide() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onHide()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
            isHideConfirmationPresented = false
        }
    }

    private func performUnhide() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onUnhide()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func performUnsplit() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onUnsplit()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private extension View {
    @ViewBuilder
    func transactionSheetCornerRadius(_ radius: CGFloat) -> some View {
        if #available(iOS 16.4, *) {
            presentationCornerRadius(radius)
        } else {
            self
        }
    }
}

private func selectAllFocusedText() {
    DispatchQueue.main.async {
        UIApplication.shared.sendAction(
            #selector(UIResponder.selectAll(_:)),
            to: nil,
            from: nil,
            for: nil
        )
    }
}

private func filterSection<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
        Text(title)
            .font(.headline)
        content()
    }
    .padding(MoatTheme.Spacing.medium)
    .background(MoatTheme.ColorToken.surface)
    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
}

private func sheetMenuLabel(title: String, systemImage: String) -> some View {
    HStack {
        Label(title, systemImage: systemImage)
        Spacer()
        Image(systemName: "chevron.up.chevron.down")
            .font(.caption)
            .foregroundStyle(.secondary)
    }
    .padding(MoatTheme.Spacing.medium)
    .frame(maxWidth: .infinity, alignment: .leading)
    .contentShape(Rectangle())
    .background(MoatTheme.ColorToken.elevatedSurface)
    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.medium, style: .continuous))
}

private struct TransactionCompactAmountField: View {
    @Binding var text: String

    @FocusState private var isFocused: Bool

    var body: some View {
        TextField("0.00", text: $text)
            .textFieldStyle(.plain)
            .font(.body.monospacedDigit())
            .multilineTextAlignment(.trailing)
            .keyboardType(.decimalPad)
            .frame(width: 112)
            .focused($isFocused)
            .onChange(of: text) { newValue in
                let formatted = AmountInputFormatter.formatTyping(newValue, fractionDigits: 2)
                if formatted != newValue {
                    text = formatted
                }
            }
            .padding(MoatTheme.Spacing.small)
            .background(MoatTheme.ColorToken.mutedSurface)
            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                    .strokeBorder(MoatTheme.ColorToken.softBorder, lineWidth: 1)
            }
            .moatInputFocusRing(isFocused: isFocused, cornerRadius: MoatTheme.Radius.small)
    }
}

private struct HashtagEditor: View {
    @Binding var selected: [String]
    @Binding var newHashtag: String
    let suggestions: [HashtagSummary]

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
            Text("Hashtags")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            if !selected.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(selected, id: \.self) { tag in
                        HStack(spacing: 4) {
                            Text("#\(tag)")
                                .font(.caption.weight(.medium))
                            Button {
                                selected.removeAll { $0 == tag }
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(MoatTheme.ColorToken.accent.opacity(0.14))
                        .clipShape(Capsule())
                    }
                }
            }

            HStack {
                Image(systemName: "number")
                    .foregroundStyle(.secondary)
                TextField("Add hashtag", text: $newHashtag)
                    .textFieldStyle(.plain)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($isFocused)
                    .onSubmit { commit() }
                if !newHashtag.isEmpty {
                    Button("Add") { commit() }
                        .font(.caption.weight(.semibold))
                }
            }
            .padding(MoatTheme.Spacing.small)
            .background(MoatTheme.ColorToken.surface)
            .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                    .strokeBorder(MoatTheme.ColorToken.softBorder, lineWidth: 1)
            }
            .moatInputFocusRing(isFocused: isFocused, cornerRadius: MoatTheme.Radius.small)

            if !suggestions.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(suggestions.prefix(12)) { hashtag in
                            Button {
                                addTag(hashtag.name)
                            } label: {
                                Text("#\(hashtag.name)")
                                    .font(.caption.weight(.medium))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(MoatTheme.ColorToken.elevatedSurface)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    private func commit() {
        let normalized = newHashtag
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
        addTag(normalized)
        newHashtag = ""
    }

    private func addTag(_ name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard !selected.contains(where: { $0.lowercased() == trimmed.lowercased() }) else { return }
        selected.append(trimmed)
    }
}

/// A simple flow layout for wrapping rows of chips.
private struct FlowLayout: Layout {
    var spacing: CGFloat = 4

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        let result = arrange(subviews: subviews, in: maxWidth)
        return CGSize(width: result.size.width, height: result.size.height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(subviews: subviews, in: bounds.width)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y), proposal: .unspecified)
        }
    }

    private func arrange(subviews: Subviews, in maxWidth: CGFloat) -> (positions: [CGPoint], size: CGSize) {
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var lineHeight: CGFloat = 0
        var totalWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0
                y += lineHeight + spacing
                lineHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
            totalWidth = max(totalWidth, x)
        }

        return (positions, CGSize(width: totalWidth, height: y + lineHeight))
    }
}

private struct FilterChip: View {
    let title: String
    let systemImage: String
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            FilterChipLabel(title: title, systemImage: systemImage, isActive: isActive)
        }
        .buttonStyle(.plain)
    }
}

private struct FilterChipLabel: View {
    let title: String
    let systemImage: String
    let isActive: Bool

    var body: some View {
        Label(title, systemImage: systemImage)
            .font(.caption.weight(.semibold))
            .foregroundStyle(isActive ? MoatTheme.ColorToken.inkInverse : MoatTheme.ColorToken.textPrimary)
            .lineLimit(1)
            .padding(.horizontal, MoatTheme.Spacing.medium)
            .padding(.vertical, MoatTheme.Spacing.small)
            .background(isActive ? MoatTheme.ColorToken.ink : MoatTheme.ColorToken.surface)
            .clipShape(Capsule())
            .overlay {
                if !isActive {
                    Capsule().strokeBorder(MoatTheme.ColorToken.border, lineWidth: 1)
                }
            }
    }
}

private struct TransactionsListSectionSpacing: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            content.listSectionSpacing(MoatTheme.Spacing.small)
        } else {
            content
        }
    }
}

#Preview {
    NavigationStack {
        TransactionsView()
    }
}
