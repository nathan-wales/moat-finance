import Foundation

@MainActor
final class PromptCreateViewModel: ObservableObject {
    enum Step {
        case choice
        case aiGate
        case aiBuilder
        case manual
    }

    @Published var step: Step = .choice
    @Published var goal = ""
    @Published var financialData = ""
    @Published var responseInclude = ""
    @Published var title = ""
    @Published var description = ""
    @Published var body = ""
    @Published var categorySlug = "budgeting"
    @Published var tags = ""
    @Published var submitForReview = false
    @Published var isSubmitting = false
    @Published var isGenerating = false
    @Published var errorMessage: String?

    func reset() {
        step = .choice
        goal = ""
        financialData = ""
        responseInclude = ""
        title = ""
        description = ""
        body = ""
        categorySlug = "budgeting"
        tags = ""
        submitForReview = false
        isSubmitting = false
        isGenerating = false
        errorMessage = nil
    }

    func applyDraft(_ draft: GeneratePromptDraftResponse) {
        title = draft.title
        description = draft.description
        body = draft.body
        categorySlug = draft.suggestedCategorySlug
        tags = draft.suggestedTags.joined(separator: ", ")
        step = .manual
    }

    func buildCreateRequest() -> CreateUserPromptRequest {
        CreateUserPromptRequest(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? nil
                : description.trimmingCharacters(in: .whitespacesAndNewlines),
            body: body.trimmingCharacters(in: .whitespacesAndNewlines),
            categorySlug: categorySlug,
            tags: tags
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty },
            submitForReview: submitForReview ? true : nil
        )
    }

    func loadFromPrompt(_ prompt: UserPromptDetail) {
        title = prompt.title
        description = prompt.description ?? ""
        body = prompt.body
        categorySlug = prompt.categorySlug ?? "budgeting"
        tags = prompt.tags.joined(separator: ", ")
        submitForReview = false
        errorMessage = nil
    }

    func buildUpdateRequest(promptId: String) -> UpdateUserPromptRequest {
        UpdateUserPromptRequest(
            promptId: promptId,
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                ? nil
                : description.trimmingCharacters(in: .whitespacesAndNewlines),
            body: body.trimmingCharacters(in: .whitespacesAndNewlines),
            categorySlug: categorySlug,
            tags: tags
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty },
            confirmWithdrawFromReview: nil
        )
    }
}
