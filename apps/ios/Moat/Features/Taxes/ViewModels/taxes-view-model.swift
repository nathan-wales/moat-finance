import Foundation

@MainActor
final class TaxesViewModel: ObservableObject {
    enum ViewState {
        case idle
        case loading
        case loaded
        case refreshing
        case error(Error)
    }

    @Published private(set) var state: ViewState = .idle
    @Published private(set) var years: TaxYearsResponse?
    @Published private(set) var overview: TaxOverview?
    @Published private(set) var documents: [TaxDocument] = []
    @Published private(set) var facts: [TaxFact] = []
    @Published private(set) var selectedDocument: TaxDocumentDetail?
    @Published private(set) var documentLoadFailed = false
    @Published var actionError: String?
    @Published var taxYear: Int
    @Published var selectedTab: TaxesTab = .overview

    private let service: TaxesService
    private var didTrackView = false

    init(service: TaxesService = TaxesService()) {
        self.service = service
        self.taxYear = Calendar(identifier: .gregorian).component(.year, from: Date())
    }

    func load() async {
        guard case .idle = state else { return }
        await reload(showLoading: true)
    }

    func refresh() async {
        await reload(showLoading: false, showRefreshing: true)
    }

    func changeYear(_ year: Int) {
        taxYear = year
        Task { await reload(showLoading: false, showRefreshing: true) }
    }

    func changeTab(_ tab: TaxesTab) {
        selectedTab = tab
        Analytics.capture("tax_tab_viewed", properties: [
            "tab": tab.rawValue
        ])
    }

    func openDocument(id: String) async {
        documentLoadFailed = false
        do {
            selectedDocument = try await service.getDocument(id: id)
        } catch {
            if error.isCancellation { return }
            selectedDocument = nil
            documentLoadFailed = true
            actionError = "Couldn't load that tax document."
        }
    }

    func retrySelectedDocument() async {
        guard let id = selectedDocument?.id else { return }
        do {
            _ = try await service.reprocessDocument(id: id)
            selectedDocument = try await service.getDocument(id: id)
            await reload(showLoading: false, showRefreshing: true)
        } catch {
            if error.isCancellation { return }
            actionError = "Couldn't reprocess that document."
        }
    }

    func confirmFact(id: String, confirmed: Bool) async {
        do {
            _ = try await service.confirmFact(id: id, confirmed: confirmed)
            if let documentId = selectedDocument?.id {
                selectedDocument = try await service.getDocument(id: documentId)
            }
            await reload(showLoading: false, showRefreshing: true)
        } catch {
            if error.isCancellation { return }
            actionError = "Couldn't update that tax fact."
        }
    }

    private func reload(showLoading: Bool, showRefreshing: Bool = true) async {
        if showLoading {
            state = .loading
        } else if showRefreshing {
            state = .refreshing
        }

        do {
            let yearsResponse = try await service.listYears()
            years = yearsResponse
            if yearsResponse.years.contains(where: { $0.taxYear == taxYear }) == false {
                taxYear = yearsResponse.defaultYear
            }
            async let overviewTask = service.getOverview(taxYear: taxYear)
            async let documentsTask = service.listDocuments(taxYear: taxYear)
            async let factsTask = service.listFacts(taxYear: taxYear)
            overview = try await overviewTask
            documents = try await documentsTask
            facts = try await factsTask
            state = .loaded
            if didTrackView == false {
                didTrackView = true
                Analytics.capture("tax_page_viewed", properties: [
                    "tab": selectedTab.rawValue,
                    "hasDocuments": overview?.hasAnyDocuments ?? false
                ])
            }
        } catch {
            if error.isCancellation {
                if case .refreshing = state { state = .loaded }
                return
            }
            state = .error(error)
        }
    }
}
