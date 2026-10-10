import Foundation

actor CategoriesService {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func load() async throws -> [CategoryItem] {
        try await apiClient.get(path: "/api/v1/category/list")
    }

    func create(name: String, icon: String? = nil, parentCategory: CategoryParent? = .flexible) async throws -> CategoryItem {
        var body: [String: JSONValue] = ["name": .string(name)]
        if let icon {
            body["icon"] = .string(icon)
        } else {
            body["icon"] = .null
        }
        if let parentCategory {
            body["parentCategory"] = .string(parentCategory.rawValue)
        }
        return try await apiClient.post(
            path: "/api/v1/category/create",
            body: .object(body)
        )
    }

    func update(id: String, name: String, icon: String? = nil, parentCategory: CategoryParent? = nil) async throws -> CategoryItem {
        var body: [String: JSONValue] = [
            "id": .string(id),
            "name": .string(name),
            "icon": icon.map(JSONValue.string) ?? .null
        ]
        if let parentCategory {
            body["parentCategory"] = .string(parentCategory.rawValue)
        }
        return try await apiClient.post(
            path: "/api/v1/category/update",
            body: .object(body)
        )
    }

    func delete(id: String) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/category/delete",
            body: .object(["id": .string(id)])
        )
    }

    func toggleHidden(id: String, isHidden: Bool) async throws {
        let _: EmptyResponse = try await apiClient.post(
            path: "/api/v1/category/toggleHidden",
            body: .object([
                "id": .string(id),
                "isHidden": .bool(isHidden)
            ])
        )
    }
}
