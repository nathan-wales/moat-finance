import Foundation

struct TopInstitution: Identifiable, Equatable {
    let name: String
    let domain: String

    var id: String { domain }
}

enum TopInstitutions {
    static let all: [TopInstitution] = [
        TopInstitution(name: "Chase", domain: "chase.com"),
        TopInstitution(name: "Bank of America", domain: "bankofamerica.com"),
        TopInstitution(name: "Wells Fargo", domain: "wellsfargo.com"),
        TopInstitution(name: "Citi", domain: "citi.com"),
        TopInstitution(name: "Capital One", domain: "capitalone.com"),
        TopInstitution(name: "U.S. Bank", domain: "usbank.com"),
        TopInstitution(name: "PNC Bank", domain: "pnc.com"),
        TopInstitution(name: "Truist", domain: "truist.com"),
        TopInstitution(name: "TD Bank", domain: "td.com"),
        TopInstitution(name: "American Express", domain: "americanexpress.com"),
        TopInstitution(name: "Discover", domain: "discover.com"),
        TopInstitution(name: "Navy Federal", domain: "navyfederal.org"),
        TopInstitution(name: "USAA", domain: "usaa.com"),
        TopInstitution(name: "Fidelity", domain: "fidelity.com"),
        TopInstitution(name: "Charles Schwab", domain: "schwab.com"),
        TopInstitution(name: "Vanguard", domain: "vanguard.com"),
        TopInstitution(name: "E*TRADE", domain: "etrade.com"),
        TopInstitution(name: "Robinhood", domain: "robinhood.com"),
        TopInstitution(name: "PayPal", domain: "paypal.com"),
        TopInstitution(name: "Venmo", domain: "venmo.com"),
        TopInstitution(name: "Coinbase", domain: "coinbase.com"),
        TopInstitution(name: "Ally Bank", domain: "ally.com"),
        TopInstitution(name: "SoFi", domain: "sofi.com"),
        TopInstitution(name: "Synchrony Bank", domain: "synchrony.com"),
        TopInstitution(name: "TIAA", domain: "tiaa.org"),
    ]
}
