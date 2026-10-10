import SwiftUI
import UIKit

enum InstitutionLogoURL {
    private static let logoDevBase = "https://img.logo.dev"

    static var publishableKey: String? {
        Environment.logoDevPublishableKey
    }

    static func candidateURLs(
        name: String,
        domain: String? = nil,
        logoUrl: String? = nil,
        size: Int = 72
    ) -> [URL] {
        var urls: [URL] = []

        if let logoUrl,
           !logoUrl.hasPrefix("data:"),
           let providerURL = URL(string: logoUrl) {
            urls.append(providerURL)
        }

        if let domainURL = logoDevDomainURL(domain: domain, size: size) {
            urls.append(domainURL)
        }

        if let nameURL = logoDevNameURL(name: name, size: size) {
            urls.append(nameURL)
        }

        return urls
    }

    static func url(
        name: String,
        domain: String? = nil,
        logoUrl: String? = nil,
        size: Int = 72
    ) -> URL? {
        candidateURLs(name: name, domain: domain, logoUrl: logoUrl, size: size).first
    }

    static func logoDevDomainURL(domain: String?, size: Int) -> URL? {
        guard let domain,
              let normalized = normalizeDomain(domain),
              !normalized.isEmpty else {
            return nil
        }

        return logoDevURL(path: normalized, size: size)
    }

    static func logoDevNameURL(name: String, size: Int) -> URL? {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return nil }

        let encodedName = encodeURIComponent(trimmedName)
        return logoDevURL(path: "name/\(encodedName)", size: size)
    }

    static func normalizeDomain(_ domain: String) -> String? {
        var normalized = domain.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        normalized = normalized.replacingOccurrences(of: "^https?://", with: "", options: .regularExpression)
        normalized = normalized.replacingOccurrences(of: "^www\\.", with: "", options: .regularExpression)

        if let slashIndex = normalized.firstIndex(of: "/") {
            normalized = String(normalized[..<slashIndex])
        }
        if let queryIndex = normalized.firstIndex(of: "?") {
            normalized = String(normalized[..<queryIndex])
        }

        return normalized.isEmpty ? nil : normalized
    }

    private static func logoDevURL(path: String, size: Int) -> URL? {
        guard let token = publishableKey, !token.isEmpty else {
            return nil
        }

        var components = URLComponents(string: "\(logoDevBase)/\(path)")
        components?.queryItems = [
            URLQueryItem(name: "token", value: token),
            URLQueryItem(name: "size", value: String(size)),
            URLQueryItem(name: "format", value: "png"),
            URLQueryItem(name: "retina", value: "true"),
            URLQueryItem(name: "fallback", value: "404"),
        ]
        return components?.url
    }

    private static func encodeURIComponent(_ value: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~!'()*")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}

struct InstitutionLogoView: View {
    let name: String
    let domain: String?
    let logoUrl: String?
    let size: CGFloat

    @State private var loadedImage: UIImage?
    @State private var isLoading = false

    init(
        name: String,
        domain: String? = nil,
        logoUrl: String? = nil,
        size: CGFloat = 36
    ) {
        self.name = name
        self.domain = domain
        self.logoUrl = logoUrl
        self.size = size
    }

    var body: some View {
        Group {
            if let loadedImage {
                Image(uiImage: loadedImage)
                    .resizable()
                    .scaledToFit()
            } else if isLoading {
                ProgressView()
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .background(MoatTheme.ColorToken.elevatedSurface)
        .clipShape(RoundedRectangle(cornerRadius: MoatTheme.Radius.small, style: .continuous))
        .task(id: loadIdentity) {
            await loadLogo()
        }
    }

    private var loadIdentity: String {
        [
            name,
            domain ?? "",
            logoUrl ?? "",
            String(Int(size * 2)),
        ].joined(separator: "|")
    }

    private var candidateURLs: [URL] {
        InstitutionLogoURL.candidateURLs(
            name: name,
            domain: domain,
            logoUrl: logoUrl,
            size: Int(size * 2)
        )
    }

    private var fallback: some View {
        Text(initial)
            .font(.system(size: max(10, size * 0.4), weight: .semibold))
            .foregroundStyle(MoatTheme.ColorToken.textSecondary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var initial: String {
        String(name.trimmingCharacters(in: .whitespacesAndNewlines).prefix(1)).uppercased()
    }

    @MainActor
    private func loadLogo() async {
        loadedImage = nil

        let candidates = candidateURLs
        guard !candidates.isEmpty else { return }

        isLoading = true
        defer { isLoading = false }

        for url in candidates {
            if Task.isCancelled { return }

            if let image = await InstitutionLogoImageLoader.load(from: url) {
                loadedImage = image
                return
            }
        }
    }
}

private enum InstitutionLogoImageLoader {
    static func load(from url: URL) async -> UIImage? {
        var request = URLRequest(url: url)
        request.cachePolicy = .returnCacheDataElseLoad

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200 ... 299).contains(httpResponse.statusCode),
                  let image = UIImage(data: data) else {
                return nil
            }

            return image
        } catch {
            return nil
        }
    }
}
