import Foundation
import SwiftUI

enum CategoryParent: String, Codable, CaseIterable, Identifiable {
    case fixed = "FIXED"
    case flexible = "FLEXIBLE"
    case nonMonthly = "NON_MONTHLY"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .fixed: "Fixed"
        case .flexible: "Flexible"
        case .nonMonthly: "Non-monthly"
        }
    }
}

enum CategoryViewMode: String, CaseIterable, Identifiable {
    case category
    case parent

    var id: String { rawValue }

    var title: String {
        switch self {
        case .category: "Category"
        case .parent: "Parent"
        }
    }
}

enum CategoryViewStorageKey {
    static let insightsNetIncome = "insights-net-income-category-view"
    static let insightsSpending = "insights-spending-category-view"
    static let categoriesList = "categories-list-view"
    static let budget = "budget-category-view"
}

struct CategoryViewPicker: View {
    @Binding var selection: String

    var body: some View {
        Picker("View", selection: $selection) {
            ForEach(CategoryViewMode.allCases) { mode in
                Text(mode.title).tag(mode.rawValue)
            }
        }
        .pickerStyle(.segmented)
        .frame(maxWidth: 180)
        .accessibilityLabel("Category view")
    }
}

struct ParentSpendRow: Identifiable {
    let parent: CategoryParent
    let amount: Double
    let monthlyAvg: Double
    let categories: [String]
    let percentage: Double
    let percentOfTop: Double

    var id: String { parent.rawValue }
    var label: String { parent.title }
}

func rollupSpendByParent(
    rows: [(category: String, amount: Double, parent: CategoryParent?, monthlyAvg: Double)]
) -> [ParentSpendRow] {
    var groups: [CategoryParent: (amount: Double, monthlyAvg: Double, categories: [String])] = [:]
    for parent in CategoryParent.allCases {
        groups[parent] = (0, 0, [])
    }
    for row in rows {
        guard let parent = row.parent else { continue }
        var group = groups[parent] ?? (0, 0, [])
        group.amount += row.amount
        group.monthlyAvg += row.monthlyAvg
        group.categories.append(row.category)
        groups[parent] = group
    }
    let rolled = CategoryParent.allCases.map { parent in
        let group = groups[parent] ?? (0, 0, [])
        return (parent: parent, amount: group.amount, monthlyAvg: group.monthlyAvg, categories: group.categories)
    }
    let total = rolled.reduce(0) { $0 + $1.amount }
    let top = rolled.map(\.amount).max() ?? 0
    return rolled.map { row in
        ParentSpendRow(
            parent: row.parent,
            amount: row.amount,
            monthlyAvg: row.monthlyAvg,
            categories: row.categories,
            percentage: total > 0 ? (row.amount / total) * 100 : 0,
            percentOfTop: top > 0 ? (row.amount / top) * 100 : 0
        )
    }
}

struct CategoryItem: Decodable, Identifiable, Equatable {
    let id: String
    let userId: String?
    let name: String
    let icon: String?
    let isDefault: Bool
    let isHidden: Bool
    let sortOrder: Int
    let isRemoved: Bool
    let canDelete: Bool
    let canHide: Bool
    let parentCategory: CategoryParent?

    var isUserOwned: Bool { userId != nil }
    var canToggleHidden: Bool { canHide }
    var canEditParent: Bool { !isDefault || parentCategory != nil }

    enum CodingKeys: String, CodingKey {
        case id, userId, name, icon, isDefault, isHidden, sortOrder
        case isRemoved, canDelete, canHide, parentCategory
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        userId = try container.decodeIfPresent(String.self, forKey: .userId)
        name = try container.decode(String.self, forKey: .name)
        icon = try container.decodeIfPresent(String.self, forKey: .icon)
        isDefault = try container.decode(Bool.self, forKey: .isDefault)
        isHidden = try container.decode(Bool.self, forKey: .isHidden)
        sortOrder = try container.decode(Int.self, forKey: .sortOrder)
        isRemoved = try container.decodeIfPresent(Bool.self, forKey: .isRemoved) ?? false
        let userOwned = userId != nil
        canDelete = try container.decodeIfPresent(Bool.self, forKey: .canDelete) ?? userOwned
        canHide = try container.decodeIfPresent(Bool.self, forKey: .canHide) ?? true
        parentCategory = try container.decodeIfPresent(CategoryParent.self, forKey: .parentCategory)
    }

    var systemImage: String {
        if let catalogImage = CategoryIconCatalog.systemImage(forKey: icon) {
            return catalogImage
        }
        return Self.systemImage(forName: name)
    }

    static func systemImage(forName name: String) -> String {
        switch name {
        case "Salary": "wallet.pass.fill"
        case "Reimbursement", "Taxes": "receipt.fill"
        case "Eating Out": "fork.knife"
        case "Groceries": "cart.fill"
        case "Mortgage & Rent", "Home": "house.fill"
        case "Bills & Utilities": "bolt.fill"
        case "Insurance": "shield.fill"
        case "Auto & Transport", "Cars": "car.fill"
        case "Gas": "fuelpump.fill"
        case "Travel", "Flights": "airplane"
        case "Shopping": "bag.fill"
        case "Clothing": "tshirt.fill"
        case "Entertainment": "film.fill"
        case "Sports & Fitness": "figure.run"
        case "Subscriptions": "arrow.clockwise"
        case "Health & Medical": "cross.case.fill"
        case "Kids": "figure.and.child.holdinghands"
        case "Pets": "pawprint.fill"
        case "Education": "graduationcap.fill"
        case "Gifts & Donations": "gift.fill"
        case "Business Services": "briefcase.fill"
        case "Investments": "chart.line.uptrend.xyaxis"
        case "Loans": "banknote.fill"
        case "Fees": "creditcard.fill"
        case "Transfer": "arrow.left.arrow.right"
        case "Uncategorized": "questionmark"
        default: "tag.fill"
        }
    }
}

struct CategoryActionMessage: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
    var isError = false
}
