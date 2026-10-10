import SwiftUI

enum RuleEditorMode: Identifiable {
    case create
    case edit(TransactionRule)

    var id: String {
        switch self {
        case .create:
            return "create-rule"
        case .edit(let rule):
            return rule.id
        }
    }

    var rule: TransactionRule? {
        if case .edit(let rule) = self { return rule }
        return nil
    }
}

struct RuleEditorSheet: View {
    let mode: RuleEditorMode
    let title: String
    let hashtags: [HashtagSummary]
    let onSave: (EditableRuleDraft, Bool) async throws -> Void
    let onFetchPreview: (EditableRuleDraft) async throws -> RuleDraftPreview
    let onDelete: () async throws -> Void

    @AppStorage("moat-apply-to-historical") private var applyToHistorical = true
    @State private var draft: EditableRuleDraft
    @State private var isDeleteConfirmationPresented = false
    @State private var isWorking = false
    @State private var preview: RuleDraftPreview?
    @State private var isPreviewLoading = false
    @State private var errorMessage: String?
    @State private var committedConditions: [EditableRuleConditionDraft] = []
    @State private var commitTask: Task<Void, Never>?
    @State private var previewTask: Task<Void, Never>?
    @State private var focusedHashtagActionId: String?
    @State private var hashtagKeyboardSuggestions: [String] = []
    @State private var hashtagSuggestionTask: Task<Void, Never>?

    init(
        mode: RuleEditorMode,
        title: String? = nil,
        initialDraft: EditableRuleDraft? = nil,
        hashtags: [HashtagSummary] = [],
        onSave: @escaping (EditableRuleDraft, Bool) async throws -> Void,
        onFetchPreview: @escaping (EditableRuleDraft) async throws -> RuleDraftPreview,
        onDelete: @escaping () async throws -> Void
    ) {
        self.mode = mode
        self.title = title ?? (mode.rule == nil ? "New rule" : "Edit rule")
        self.hashtags = hashtags
        self.onSave = onSave
        self.onFetchPreview = onFetchPreview
        self.onDelete = onDelete
        _draft = State(initialValue: initialDraft ?? EditableRuleDraft(rule: mode.rule))
    }

    var body: some View {
        MoatGlassSheet(
            title: title,
            keyboardSuggestions: hashtagKeyboardSuggestions,
            onSelectKeyboardSuggestion: applyHashtagSuggestion
        ) {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                ruleNameField
                conditionsActionsCard
                historicalPreviewSection
                errorSection
            }
        } footer: {
            footerButtons
        }
        .onAppear {
            commitConditionsImmediately()
        }
        .onChange(of: draft.groups) { _ in
            scheduleConditionCommit()
        }
        .onChange(of: draft.actions) { _ in
            scheduleHashtagSuggestionRefresh()
        }
        .onChange(of: focusedHashtagActionId) { _ in
            scheduleHashtagSuggestionRefresh(immediate: true)
        }
        .onChange(of: committedConditions) { _ in
            schedulePreviewFetch()
        }
        .onChange(of: applyToHistorical) { _ in
            schedulePreviewFetch()
        }
        .onDisappear {
            commitTask?.cancel()
            previewTask?.cancel()
            hashtagSuggestionTask?.cancel()
        }
        .sheet(isPresented: $isDeleteConfirmationPresented) {
            deleteConfirmationSheet
        }
    }

    private var ruleNameField: some View {
        MoatTextField(placeholder: "Rule name", text: $draft.name)
    }

    private var conditionsActionsCard: some View {
        MoatCard {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.xxLarge) {
                conditionsSection
                actionsSection
            }
        }
    }

    private var conditionsSection: some View {
        let showCards = draft.groups.count > 1
        let headerMatch = showCards ? draft.match : (draft.groups.first?.match ?? .all)

        return ruleSection("") {
            matchHeader(match: headerMatch, showGroups: showCards) { next in
                if showCards {
                    draft.match = next
                } else if !draft.groups.isEmpty {
                    draft.groups[0].match = next
                    draft.match = next
                }
            }

            VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
                ForEach(Array(draft.groups.enumerated()), id: \.element.id) { groupIndex, group in
                    if groupIndex > 0 {
                        Text(draft.match.connector)
                            .font(.caption)
                            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }

                    groupBlock(groupId: group.id, showCard: showCards)
                }
            }

            Button {
                if draft.groups.count == 1 {
                    draft.match = .any
                }
                draft.groups.append(EditableRuleConditionGroupDraft())
                commitConditionsImmediately()
            } label: {
                Label("Group", systemImage: "plus")
                    .font(.caption)
            }
            .buttonStyle(.plain)
            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            .padding(.top, MoatTheme.Spacing.medium)
        }
    }

    @ViewBuilder
    private func matchHeader(
        match: RuleMatch,
        showGroups: Bool,
        onChange: @escaping (RuleMatch) -> Void
    ) -> some View {
        HStack(spacing: MoatTheme.Spacing.xSmall) {
            Text("IF —")
                .font(.caption.weight(.semibold))
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            Menu {
                Button("ALL") { onChange(.all) }
                Button("ANY") { onChange(.any) }
            } label: {
                HStack(spacing: 2) {
                    Text(match.rawValue)
                        .font(.caption.weight(.semibold))
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption2)
                }
                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
            }
            Text(showGroups ? match.groupsHeaderSuffix : match.conditionsHeaderSuffix)
                .font(.caption.weight(.semibold))
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .textCase(.uppercase)
        }
    }

    @ViewBuilder
    private func groupBlock(groupId: String, showCard: Bool) -> some View {
        let groupIndex = draft.groups.firstIndex(where: { $0.id == groupId })
        let group = groupIndex.map { draft.groups[$0] }

        if let groupIndex, let group {
            let content = VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                if showCard {
                    matchHeader(match: group.match, showGroups: false) { next in
                        draft.groups[groupIndex].match = next
                    }
                }

                ForEach(Array(group.conditions.enumerated()), id: \.element.id) { conditionIndex, condition in
                    RuleConditionSentence(
                        condition: $draft.groups[groupIndex].conditions[conditionIndex],
                        showsLeadingConnector: conditionIndex > 0,
                        connector: group.match.connector,
                        canDelete: draft.groups.count > 1 || group.conditions.count > 1,
                        onDelete: { removeCondition(groupId: groupId, conditionId: condition.id) },
                        onCommit: commitConditionsImmediately
                    )
                }

                Button {
                    draft.groups[groupIndex].conditions.append(EditableRuleConditionDraft())
                    commitConditionsImmediately()
                } label: {
                    Label("Add condition", systemImage: "plus")
                        .font(.caption)
                }
                .buttonStyle(.plain)
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            }

            if showCard {
                content
                    .padding(MoatTheme.Spacing.medium)
                    .background(MoatTheme.ColorToken.mutedSurface)
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
            } else {
                content
            }
        }
    }

    private var actionsSection: some View {
        ruleSection("THEN — apply these actions") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                ForEach($draft.actions) { $action in
                    RuleActionSentence(
                        action: $action,
                        canDelete: draft.actions.count > 1,
                        onDelete: { removeAction(action.id) },
                        onHashtagFocusChange: { isFocused in
                            handleHashtagFocusChange(actionId: action.id, isFocused: isFocused)
                        }
                    )
                }
            }

            Button {
                draft.actions.append(EditableRuleActionDraft())
            } label: {
                Label("Add action", systemImage: "plus")
                    .font(.caption)
            }
            .buttonStyle(.plain)
            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            .padding(.top, MoatTheme.Spacing.medium)
        }
    }

    private var historicalPreviewSection: some View {
        MoatCard {
            RuleHistoricalPreviewSection(
                isEditing: mode.rule != nil,
                hasCommittedConditions: !committedConditions.isEmpty,
                applyToHistorical: $applyToHistorical,
                totalCount: preview?.totalCount ?? 0,
                previewRows: preview?.preview ?? [],
                actions: draft.actions,
                isLoading: isPreviewLoading
            )
        }
    }

    @ViewBuilder
    private var errorSection: some View {
        if let errorMessage {
            Text(errorMessage)
                .font(.footnote)
                .foregroundStyle(MoatTheme.ColorToken.destructive)
        }
    }

    private var footerButtons: some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            if mode.rule != nil {
                Button(role: .destructive) {
                    isDeleteConfirmationPresented = true
                } label: {
                    Label("Delete", systemImage: "trash").frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatDestructive)
            }

            Button {
                HapticFeedback.saveOrSubmit()
                Task { await performSave() }
            } label: {
                if isWorking {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Label("Save", systemImage: "checkmark").frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.moatPrimary)
            .disabled(isWorking)
        }
    }

    private var deleteConfirmationSheet: some View {
        MoatGlassSheet(title: "Delete rule") {
            VStack(alignment: .leading, spacing: MoatTheme.Spacing.large) {
                Text(mode.rule?.name ?? "Rule")
                    .font(.headline)
                Text("This removes the automation rule. Transactions already edited by the rule stay as they are.")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
        } footer: {
            MoatSheetActionBar {
                Button {
                    isDeleteConfirmationPresented = false
                } label: {
                    Text("Cancel").frame(maxWidth: .infinity)
                }
                .buttonStyle(.moatSecondary)

                Button(role: .destructive) {
                    Task { await performDelete() }
                } label: {
                    if isWorking {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Label("Delete", systemImage: "trash").frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.moatDestructive)
                .disabled(isWorking)
            }
        }
    }

    private func removeCondition(groupId: String, conditionId: String) {
        draft.groups = draft.groups.compactMap { group in
            guard group.id == groupId else { return group }
            var next = group
            next.conditions.removeAll { $0.id == conditionId }
            return next.conditions.isEmpty ? nil : next
        }
        if draft.groups.isEmpty {
            draft.groups = [EditableRuleConditionGroupDraft()]
            draft.match = .all
        } else if draft.groups.count == 1 {
            draft.match = draft.groups[0].match
        }
        commitConditionsImmediately()
    }

    private func removeAction(_ id: String) {
        guard draft.actions.count > 1 else { return }
        draft.actions.removeAll { $0.id == id }
        if focusedHashtagActionId == id {
            focusedHashtagActionId = nil
            hashtagKeyboardSuggestions = []
        }
    }

    private func handleHashtagFocusChange(actionId: String, isFocused: Bool) {
        if isFocused {
            focusedHashtagActionId = actionId
            return
        }
        if focusedHashtagActionId == actionId {
            focusedHashtagActionId = nil
            hashtagKeyboardSuggestions = []
        }
    }

    private func scheduleHashtagSuggestionRefresh(immediate: Bool = false) {
        hashtagSuggestionTask?.cancel()

        guard let focusedHashtagActionId,
              let action = draft.actions.first(where: { $0.id == focusedHashtagActionId }),
              action.actionType == .addHashtag
        else {
            hashtagKeyboardSuggestions = []
            return
        }

        let query = action.actionText
        let excluded = draft.actions
            .filter { $0.id != focusedHashtagActionId && $0.actionType == .addHashtag }
            .map(\.actionText)
        let availableHashtags = hashtags

        if immediate {
            hashtagKeyboardSuggestions = HashtagSuggestions.keyboardSuggestions(
                from: availableHashtags,
                excluding: excluded,
                query: query
            )
            return
        }

        hashtagSuggestionTask = Task {
            try? await Task.sleep(nanoseconds: 150_000_000)
            guard !Task.isCancelled else { return }
            let suggestions = HashtagSuggestions.keyboardSuggestions(
                from: availableHashtags,
                excluding: excluded,
                query: query
            )
            await MainActor.run {
                hashtagKeyboardSuggestions = suggestions
            }
        }
    }

    private func applyHashtagSuggestion(_ suggestion: String) {
        guard let focusedHashtagActionId,
              let index = draft.actions.firstIndex(where: { $0.id == focusedHashtagActionId })
        else { return }

        draft.actions[index].actionText = suggestion
        hashtagKeyboardSuggestions = HashtagSuggestions.keyboardSuggestions(
            from: hashtags,
            excluding: draft.actions
                .filter { $0.id != focusedHashtagActionId && $0.actionType == .addHashtag }
                .map(\.actionText),
            query: suggestion
        )
    }

    private func commitConditionsImmediately() {
        commitTask?.cancel()
        committedConditions = RulePreviewHelpers.committedConditions(from: draft.conditions)
    }

    private func scheduleConditionCommit() {
        commitTask?.cancel()
        commitTask = Task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                committedConditions = RulePreviewHelpers.committedConditions(from: draft.conditions)
            }
        }
    }

    private func schedulePreviewFetch() {
        previewTask?.cancel()
        previewTask = Task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard !Task.isCancelled else { return }
            await fetchPreview()
        }
    }

    private func fetchPreview() async {
        guard applyToHistorical, !committedConditions.isEmpty else {
            preview = nil
            isPreviewLoading = false
            return
        }

        isPreviewLoading = true
        defer { isPreviewLoading = false }

        do {
            preview = try await onFetchPreview(draft)
        } catch {
            preview = nil
            errorMessage = error.localizedDescription
        }
    }

    private func performSave() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onSave(draft, applyToHistorical)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func performDelete() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }

        do {
            try await onDelete()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct RuleHistoricalPreviewSection: View {
    let isEditing: Bool
    let hasCommittedConditions: Bool
    @Binding var applyToHistorical: Bool
    let totalCount: Int
    let previewRows: [RulePreviewTransaction]
    let actions: [EditableRuleActionDraft]
    let isLoading: Bool

    private var showAfter: Bool {
        RulePreviewHelpers.hasActionsSet(actions)
    }

    private var subtitle: String {
        guard hasCommittedConditions else {
            return "Add conditions above to preview affected transactions."
        }

        if isEditing {
            return "On save, actions will be re-applied to \(totalCount) associated transactions."
        }
        return "On save, this will be applied to \(totalCount) other transactions."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: MoatTheme.Spacing.medium) {
            Toggle(isOn: $applyToHistorical) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Apply to all historical transactions")
                        .font(.subheadline.weight(.semibold))
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .moatToggleStyle()

            if applyToHistorical, hasCommittedConditions {
                VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
                    HStack(spacing: MoatTheme.Spacing.xSmall) {
                        Text("PREVIEW")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        if showAfter {
                            Image(systemName: "arrow.right")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            Text("showing changes")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    VStack(spacing: 0) {
                        if isLoading {
                            RulePreviewRowSkeleton()
                            RulePreviewRowSkeleton()
                            RulePreviewRowSkeleton()
                        } else if previewRows.isEmpty {
                            Text("No matching transactions found")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, MoatTheme.Spacing.large)
                        } else {
                            ForEach(Array(previewRows.enumerated()), id: \.element.id) { index, transaction in
                                let after = RulePreviewHelpers.applyActionsToPreview(transaction, actions: actions)
                                RulePreviewDiffRow(
                                    before: transaction,
                                    after: after,
                                    showAfter: showAfter
                                )

                                if index < previewRows.count - 1 {
                                    Divider()
                                }
                            }
                        }
                    }
                    .padding(.horizontal, MoatTheme.Spacing.medium)
                    .background(MoatTheme.ColorToken.elevatedSurface.opacity(0.5))
                    .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous)
                            .stroke(MoatTheme.ColorToken.border.opacity(0.4), lineWidth: 1)
                    }
                }
            }
        }
    }
}

private struct RulePreviewDiffRow: View {
    let before: RulePreviewTransaction
    let after: RulePreviewAppliedState
    let showAfter: Bool

    private var descChanged: Bool {
        showAfter && after.description != before.description
    }

    private var categoryChanged: Bool {
        showAfter && after.category != before.category
    }

    private var typeChanged: Bool {
        showAfter && after.type != before.type
    }

    private var newTags: [String] {
        guard showAfter else { return [] }
        return after.hashtags.filter { !before.hashtags.contains($0) }
    }

    var body: some View {
        HStack(alignment: .top, spacing: MoatTheme.Spacing.medium) {
            Text(DateFormatterProvider.fullDate(before.date))
                .font(.caption2)
                .foregroundStyle(.secondary)
                .frame(width: 84, alignment: .leading)

            VStack(alignment: .leading, spacing: 2) {
                Text(before.description ?? "—")
                    .font(.caption)
                    .lineLimit(1)
                    .strikethrough(descChanged, color: .secondary)
                    .foregroundStyle(descChanged ? .secondary : .primary)

                if descChanged, let description = after.description {
                    Text(description)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(MoatTheme.ColorToken.positive)
                        .lineLimit(1)
                }

                if !before.hashtags.isEmpty || !newTags.isEmpty {
                    MoatFlowLayout(horizontalSpacing: 4, verticalSpacing: 4) {
                        ForEach(before.hashtags, id: \.self) { tag in
                            Text("#\(tag)")
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(MoatTheme.ColorToken.elevatedSurface)
                                .clipShape(Capsule())
                        }
                        ForEach(newTags, id: \.self) { tag in
                            Text("+#\(tag)")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(MoatTheme.ColorToken.positive)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(MoatTheme.ColorToken.positiveSoft)
                                .clipShape(Capsule())
                        }
                    }
                }
            }
            .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .trailing, spacing: 2) {
                Text(CurrencyFormatter.format(before.type == .expense ? -abs(before.amount) : abs(before.amount)))
                    .font(.caption.weight(.semibold))
                    .monospacedDigit()

                Text(before.type.title.lowercased())
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .strikethrough(typeChanged, color: .secondary)

                if typeChanged {
                    Text(after.type.title.lowercased())
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(MoatTheme.ColorToken.positive)
                }

                if let category = before.category {
                    Text(category)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .strikethrough(categoryChanged, color: .secondary)
                }

                if categoryChanged, let category = after.category {
                    Text(category)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(MoatTheme.ColorToken.positive)
                        .lineLimit(1)
                }
            }
            .frame(width: 88, alignment: .trailing)
        }
        .padding(.vertical, MoatTheme.Spacing.small)
    }
}

private struct RulePreviewRowSkeleton: View {
    var body: some View {
        HStack(spacing: MoatTheme.Spacing.medium) {
            RoundedRectangle(cornerRadius: 4)
                .fill(MoatTheme.ColorToken.elevatedSurface)
                .frame(width: 72, height: 10)
            RoundedRectangle(cornerRadius: 4)
                .fill(MoatTheme.ColorToken.elevatedSurface)
                .frame(maxWidth: .infinity, maxHeight: 10)
            RoundedRectangle(cornerRadius: 4)
                .fill(MoatTheme.ColorToken.elevatedSurface)
                .frame(width: 48, height: 10)
        }
        .padding(.vertical, MoatTheme.Spacing.small)
        .redacted(reason: .placeholder)
    }
}

private func ruleSection<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: MoatTheme.Spacing.small) {
        if !title.isEmpty {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                .textCase(.uppercase)
        }
        content()
    }
}
