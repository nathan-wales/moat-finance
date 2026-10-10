import SwiftUI

struct NotificationsView: View {
    @State private var rules: [NotificationRule] = []
    @State private var inbox: [NotificationInboxItem] = []
    @State private var suggestions: [NotificationSuggestion] = []
    @State private var preferences: NotificationPreferences?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var showSettings = false
    @State private var expandedHistoryId: String?

    private let service = NotificationRulesService()

    var body: some View {
        List {
            Section {
                Text("Notifications")
                    .font(.largeTitle.bold())
                Text("Alerts, summaries, and financial monitoring")
                    .foregroundStyle(.secondary)
            }

            if let preferences {
                Section("Weekly money summary") {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(preferences.weeklySummaryEnabled ? "Enabled" : "Paused")
                            .font(.headline)
                        Text(weeklySummaryScheduleLabel(preferences))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text("Previous Monday–Sunday")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }

            Section("Active notifications") {
                if isLoading {
                    ProgressView()
                } else if rules.isEmpty {
                    Text("No notification rules yet.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(rules) { rule in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(rule.name)
                                    .font(.headline)
                                if rule.isPaused || !rule.isActive {
                                    Text("Paused")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            if let summary = rule.plainLanguageSummary {
                                Text(summary)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            Text(rule.channels.map(\.rawValue).joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if let attribution = rule.sourceAttribution {
                                Text(attribution)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                        .swipeActions {
                            Button(rule.isPaused ? "Resume" : "Pause") {
                                Task { await pause(rule) }
                            }
                        }
                    }
                }
            }

            if !suggestions.isEmpty {
                Section("Suggested notifications") {
                    ForEach(suggestions) { suggestion in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(suggestion.title)
                                .font(.headline)
                            Text(suggestion.description)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Button("Dismiss") {
                                Task { await dismiss(suggestion) }
                            }
                            .font(.caption)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }

            Section("History") {
                if inbox.isEmpty && !isLoading {
                    Text("Nothing delivered yet.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(inbox) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(item.title)
                                .font(.headline)
                            Text(item.body)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            if let explanation = item.explanation {
                                Text("Why: \(explanation.summary)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                if expandedHistoryId == item.id {
                                    ForEach(explanation.facts, id: \.self) { fact in
                                        Text("\(fact.label): \(fact.value)")
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                            HStack(spacing: 12) {
                                Button(expandedHistoryId == item.id ? "Hide why" : "Why") {
                                    expandedHistoryId = expandedHistoryId == item.id ? nil : item.id
                                }
                                .font(.caption)
                                if item.readAt == nil {
                                    Button("Mark read") {
                                        Task { await markRead(item) }
                                    }
                                    .font(.caption)
                                }
                                if item.resolutionStatus == nil || item.resolutionStatus == "UNRESOLVED" {
                                    Button("Resolve") {
                                        Task { await resolve(item, status: "RESOLVED") }
                                    }
                                    .font(.caption)
                                    Button("Snooze") {
                                        Task { await snooze(item) }
                                    }
                                    .font(.caption)
                                    Button("Mute") {
                                        Task { await resolve(item, status: "MUTED") }
                                    }
                                    .font(.caption)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
        .navigationTitle("Notifications")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Settings") {
                    showSettings = true
                }
            }
        }
        .refreshable {
            await refresh()
        }
        .sheet(isPresented: $showSettings) {
            if let preferences {
                NotificationSettingsView(
                    preferences: preferences,
                    onSaved: { updated in
                        self.preferences = updated
                        showSettings = false
                    }
                )
            }
        }
        .task {
            await load()
        }
        .alert("Unable to load notifications", isPresented: .constant(errorMessage != nil)) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func weeklySummaryScheduleLabel(_ preferences: NotificationPreferences) -> String {
        let days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        let day = days[safe: preferences.weeklySummaryDayOfWeek] ?? "Mon"
        let channels = (preferences.weeklySummaryChannels ?? [.email, .inApp])
            .map(\.rawValue)
            .joined(separator: " + ")
        return "Every \(day) · \(channels) · checked once daily"
    }

    @MainActor
    private func load() async {
        isLoading = true
        defer { isLoading = false }
        await fetchNotifications()
    }

    @MainActor
    private func refresh() async {
        await fetchNotifications()
    }

    @MainActor
    private func fetchNotifications() async {
        do {
            async let loadedRules = service.listRules()
            async let loadedInbox = service.listInbox()
            async let loadedPrefs = service.getPreferences()
            async let loadedSuggestions = service.listSuggestions()
            rules = try await loadedRules
            inbox = try await loadedInbox
            preferences = try await loadedPrefs
            suggestions = (try? await loadedSuggestions) ?? []
        } catch {
            if error.isCancellation { return }
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func pause(_ rule: NotificationRule) async {
        do {
            try await service.pause(id: rule.id, paused: !rule.isPaused)
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func dismiss(_ suggestion: NotificationSuggestion) async {
        do {
            try await service.dismissSuggestion(id: suggestion.id)
            suggestions.removeAll { $0.id == suggestion.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func markRead(_ item: NotificationInboxItem) async {
        do {
            try await service.markRead(id: item.id)
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func resolve(_ item: NotificationInboxItem, status: String) async {
        do {
            try await service.resolve(id: item.id, status: status)
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func snooze(_ item: NotificationInboxItem) async {
        let until = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        let formatter = ISO8601DateFormatter()
        do {
            try await service.resolve(
                id: item.id,
                status: "SNOOZED",
                snoozedUntilIso: formatter.string(from: until)
            )
            await load()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct NotificationSettingsView: View {
    @State var preferences: NotificationPreferences
    let onSaved: (NotificationPreferences) -> Void
    @State private var errorMessage: String?
    @State private var isSaving = false
    private let service = NotificationRulesService()

    var body: some View {
        NavigationStack {
            Form {
                Section("Channels") {
                    Toggle("Email", isOn: bindingBool(\.emailEnabled))
                        .moatToggleStyle()
                    Toggle("Push", isOn: bindingBool(\.pushEnabled))
                        .moatToggleStyle()
                    Toggle("In-app", isOn: bindingBool(\.inAppEnabled))
                        .moatToggleStyle()
                }

                Section("Weekly summary") {
                    Toggle("Enabled", isOn: bindingBool(\.weeklySummaryEnabled))
                        .moatToggleStyle()
                }

                Section("Push privacy") {
                    Picker("Privacy", selection: bindingString(\.pushPrivacyLevel)) {
                        Text("Hide financial details").tag("hide_details")
                        Text("Show general details").tag("general_details")
                        Text("Show amounts and account names").tag("show_amounts")
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                }
            }
            .navigationTitle("Notification settings")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await save() }
                    }
                    .disabled(isSaving)
                }
            }
        }
    }

    private func bindingBool(_ keyPath: WritableKeyPath<NotificationPreferences, Bool>) -> Binding<Bool> {
        Binding(
            get: { preferences[keyPath: keyPath] },
            set: { preferences[keyPath: keyPath] = $0 }
        )
    }

    private func bindingString(_ keyPath: WritableKeyPath<NotificationPreferences, String>) -> Binding<String> {
        Binding(
            get: { preferences[keyPath: keyPath] },
            set: { preferences[keyPath: keyPath] = $0 }
        )
    }

    @MainActor
    private func save() async {
        isSaving = true
        defer { isSaving = false }
        do {
            let updated = try await service.updatePreferences([
                "emailEnabled": .bool(preferences.emailEnabled),
                "pushEnabled": .bool(preferences.pushEnabled),
                "inAppEnabled": .bool(preferences.inAppEnabled),
                "weeklySummaryEnabled": .bool(preferences.weeklySummaryEnabled),
                "pushPrivacyLevel": .string(preferences.pushPrivacyLevel),
            ])
            onSaved(updated)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
