import SwiftUI

struct SetupGuideEditSheet: View {
    @SwiftUI.Environment(\.dismiss) private var dismiss
    @State private var selected: Set<String>
    let onSave: ([String]) async -> Void

    init(selectedGoals: [String], onSave: @escaping ([String]) async -> Void) {
        _selected = State(initialValue: Set(selectedGoals))
        self.onSave = onSave
    }

    private var options: [OnboardingGoalOption] {
        if ProductFlags.taxesEnabled {
            return OnboardingGoalOption.all
        }
        return OnboardingGoalOption.all.filter { $0.id != "taxes" }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(options) { goal in
                    Button {
                        toggle(goal.id)
                    } label: {
                        HStack(spacing: MoatTheme.Spacing.medium) {
                            Image(systemName: selected.contains(goal.id) ? "checkmark.square.fill" : "square")
                                .foregroundStyle(MoatTheme.ColorToken.accent)
                            Image(systemName: goal.systemImage)
                                .foregroundStyle(MoatTheme.ColorToken.textSecondary)
                            Text(goal.label)
                                .foregroundStyle(MoatTheme.ColorToken.textPrimary)
                            Spacer()
                        }
                    }
                    .listRowBackground(MoatTheme.ColorToken.surface)
                }
            }
            .navigationTitle("What do you want to do with Moat?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            await onSave(Array(selected))
                            dismiss()
                        }
                    }
                }
            }
        }
    }

    private func toggle(_ id: String) {
        if selected.contains(id) {
            selected.remove(id)
        } else {
            selected.insert(id)
        }
    }
}
