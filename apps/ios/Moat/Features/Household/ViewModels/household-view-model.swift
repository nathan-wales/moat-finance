import Foundation

@MainActor
final class HouseholdViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var household: HouseholdState?
    @Published private(set) var actionMessage: HouseholdActionMessage?

    private let service: HouseholdService

    init(service: HouseholdService = HouseholdService()) {
        self.service = service
    }

    var canInvite: Bool {
        guard let household else { return false }
        return household.canManage && household.membership == nil && household.pendingInvite == nil
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false, showRefreshing: true)
    }

    func invite(name: String, email: String) async {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        guard !trimmedName.isEmpty else {
            actionMessage = HouseholdActionMessage(
                title: "Couldn't invite",
                message: HouseholdValidationError.emptyName.localizedDescription
            )
            return
        }

        guard trimmedEmail.contains("@"), trimmedEmail.contains(".") else {
            actionMessage = HouseholdActionMessage(
                title: "Couldn't invite",
                message: HouseholdValidationError.invalidEmail.localizedDescription
            )
            return
        }

        await performAction(title: "Invite sent") {
            let response = try await service.createInvite(name: trimmedName, email: trimmedEmail)
            return "\(response.invite.inviteeName) has until \(DateFormatterProvider.fullDate(response.invite.expiresAt)) to accept."
        }
        await refresh()
    }

    func resendInvite() async {
        guard let invite = household?.pendingInvite else { return }
        await performAction(title: "Invite resent") {
            let response = try await service.resendInvite(id: invite.id)
            return "Sent to \(response.invite.inviteeEmail)."
        }
        await refresh()
    }

    func revokeInvite() async {
        guard let invite = household?.pendingInvite else { return }
        await performAction(title: "Invite revoked") {
            try await service.revokeInvite(id: invite.id)
            return "The pending invite was revoked."
        }
        await refresh()
    }

    func removeMember() async {
        guard let membership = household?.membership else { return }
        await performAction(title: "Access removed") {
            try await service.removeMember(id: membership.id)
            return "\(membership.member.displayName) no longer has access to your dashboard."
        }
        await refresh()
    }

    func clearActionMessage() {
        actionMessage = nil
    }

    private func reload(showLoading: Bool, showRefreshing: Bool = true) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            household = try await service.load()
            state = .loaded
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

    private func performAction(title: String, operation: () async throws -> String) async {
        state = .refreshing

        do {
            let message = try await operation()
            actionMessage = HouseholdActionMessage(title: title, message: message)
            state = .loaded
        } catch {
            actionMessage = HouseholdActionMessage(
                title: "Something went wrong",
                message: error.localizedDescription
            )
            state = .loaded
        }
    }
}