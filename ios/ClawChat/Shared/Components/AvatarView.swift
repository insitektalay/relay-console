// AvatarView.swift
// ClawChat

import SwiftUI

// MARK: - Size enum

enum AvatarSize {
    case mini    // 22pt
    case small   // 28pt
    case medium  // 44pt
    case large   // 72pt
    case xlarge  // 96pt

    var dimension: CGFloat {
        switch self {
        case .mini:   return 22
        case .small:  return 28
        case .medium: return 44
        case .large:  return 72
        case .xlarge: return 96
        }
    }

    var cornerRadius: CGFloat {
        dimension / 2
    }

    var fontSize: CGFloat {
        switch self {
        case .mini:   return 9
        case .small:  return 11
        case .medium: return 17
        case .large:  return 26
        case .xlarge: return 34
        }
    }

    var statusDotSize: CGFloat {
        switch self {
        case .mini:   return 7
        case .small:  return 8
        case .medium: return 12
        case .large:  return 16
        case .xlarge: return 20
        }
    }

    var statusDotOffset: CGFloat {
        dimension * 0.07
    }
}

// MARK: - Deterministic background colour

private extension String {
    /// Returns a deterministic avatar background colour derived from the string hash.
    var avatarBackgroundColor: Color {
        let palette: [Color] = [
            Color(hex: "#0A84FF"),
            Color(hex: "#30D158"),
            Color(hex: "#FF9F0A"),
            Color(hex: "#BF5AF2"),
            Color(hex: "#40C8E0"),
            Color(hex: "#FF453A"),
            Color(hex: "#FFD60A"),
            Color(hex: "#32ADE6"),
            Color(hex: "#AC8E68"),
            Color(hex: "#FF6961"),
        ]
        var hash = 0
        for scalar in unicodeScalars {
            hash = Int(scalar.value) &+ ((hash << 5) &- hash)
        }
        let index = abs(hash) % palette.count
        return palette[index]
    }

    /// Returns one or two initials from a display name.
    var initials: String {
        let parts = components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
        if parts.count >= 2,
           let f = parts[0].first,
           let l = parts[1].first {
            return "\(f)\(l)".uppercased()
        } else if let first = parts.first?.first {
            return String(first).uppercased()
        }
        return "?"
    }
}

// MARK: - Data URL image cache (process-level, avoids re-decoding on every re-render)

private final class DataURLImageCache: @unchecked Sendable {
    static let shared = DataURLImageCache()
    private var cache: [Int: UIImage] = [:]
    private let lock = NSLock()

    func image(forKey key: Int) -> UIImage? {
        lock.lock(); defer { lock.unlock() }
        return cache[key]
    }

    func store(_ image: UIImage, forKey key: Int) {
        lock.lock(); defer { lock.unlock() }
        cache[key] = image
    }
}

@MainActor
private final class RemoteAvatarImageRepository {
    static let shared = RemoteAvatarImageRepository()
    private let cache = NSCache<NSURL, UIImage>()
    private var inFlight: [URL: _Concurrency.Task<UIImage, Error>] = [:]

    func image(for url: URL) async throws -> UIImage {
        if let cached = cache.object(forKey: url as NSURL) {
            return cached
        }

        if let existingTask = inFlight[url] {
            return try await existingTask.value
        }

        // Rows containing the same agent can appear many times in a LazyVStack.
        // Keep one independent request alive even if an individual row disappears,
        // then share its decoded result with every avatar using this URL.
        let task = _Concurrency.Task<UIImage, Error> {
            try await AvatarImageLoader.load(from: url)
        }
        inFlight[url] = task

        do {
            let image = try await task.value
            cache.setObject(image, forKey: url as NSURL)
            inFlight[url] = nil
            return image
        } catch {
            inFlight[url] = nil
            throw error
        }
    }
}

enum AvatarImageLoader {
    static func request(for url: URL) -> URLRequest {
        // A previously missing web asset may have left a cached 404 behind. Xcode
        // rebuilds preserve that cache, so avatar loads must re-check the origin.
        URLRequest(
            url: url,
            cachePolicy: .reloadIgnoringLocalCacheData,
            timeoutInterval: 20
        )
    }

    static func load(from url: URL) async throws -> UIImage {
        let (data, response) = try await URLSession.shared.data(for: request(for: url))
        guard let response = response as? HTTPURLResponse,
              (200..<300).contains(response.statusCode) else {
            throw URLError(.badServerResponse)
        }
        guard let image = UIImage(data: data) else {
            throw URLError(.cannotDecodeContentData)
        }
        return image
    }
}

// MARK: - AvatarView

struct RelayAvatar: View {
    let name: String
    let imageUrl: String?
    var size: AvatarSize = .medium
    var status: AgentStatus? = nil
    var showRing: Bool = false
    var ringColor: Color = ClawColors.accent

    /// Holds the decoded UIImage for data: URLs — populated once asynchronously.
    @State private var decodedImage: UIImage? = nil
    @State private var remoteImage: UIImage? = nil
    @State private var remoteImageFailed: Bool = false

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            avatarContent
                .frame(width: size.dimension, height: size.dimension)
                .clipShape(Circle())
                .overlay(ringOverlay)

            if let status {
                statusDot(for: status)
                    .offset(x: size.statusDotOffset, y: size.statusDotOffset)
            }
        }
        .frame(width: size.dimension, height: size.dimension)
        .accessibilityLabel("\(name) avatar")
        .accessibilityAddTraits(.isImage)
        .task(id: imageUrl) {
            decodedImage = nil
            remoteImage = nil
            remoteImageFailed = false

            guard let urlString = imageUrl else {
                return
            }

            if urlString.hasPrefix("data:") {
                let key = urlString.hashValue
                if let cached = DataURLImageCache.shared.image(forKey: key) {
                    decodedImage = cached
                    return
                }
                // Decode on a background thread so main thread is never blocked
                let decoded = await _Concurrency.Task.detached(priority: .userInitiated) {
                    Self.decodeDataURL(urlString)
                }.value
                guard !_Concurrency.Task.isCancelled else { return }
                if let decoded {
                    DataURLImageCache.shared.store(decoded, forKey: key)
                }
                decodedImage = decoded
                return
            }

            guard !urlString.hasPrefix("asset://"),
                  Self.bundledAvatarImage(for: urlString) == nil,
                  let url = resolvedAvatarURL(urlString) else {
                return
            }

            do {
                let image = try await RemoteAvatarImageRepository.shared.image(for: url)
                guard !_Concurrency.Task.isCancelled else { return }
                remoteImage = image
            } catch {
                guard !_Concurrency.Task.isCancelled else { return }
                remoteImageFailed = true
            }
        }
    }

    // MARK: - Sub-views

    @ViewBuilder
    private var avatarContent: some View {
        if let urlString = imageUrl {
            if urlString.hasPrefix("data:") {
                if let image = decodedImage {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                } else {
                    initialsView
                }
            } else if urlString.hasPrefix("asset://") {
                let assetName = String(urlString.dropFirst("asset://".count))
                if let image = UIImage(named: assetName) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                } else {
                    initialsView
                }
            } else if let image = builtInAvatarImage(for: urlString) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else if resolvedAvatarURL(urlString) != nil {
                if let remoteImage {
                    Image(uiImage: remoteImage)
                        .resizable()
                        .scaledToFill()
                } else if remoteImageFailed {
                    initialsView
                } else {
                    initialsView
                        .shimmer()
                }
            } else {
                initialsView
            }
        } else {
            initialsView
        }
    }

    private nonisolated static func decodeDataURL(_ dataURL: String) -> UIImage? {
        guard let commaIndex = dataURL.firstIndex(of: ",") else { return nil }
        let base64String = String(dataURL[dataURL.index(after: commaIndex)...])
        guard let data = Data(base64Encoded: base64String, options: .ignoreUnknownCharacters) else { return nil }
        return UIImage(data: data)
    }

    private func builtInAvatarImage(for value: String) -> UIImage? {
        guard let assetName = Self.builtInAvatarAssetName(for: value) else { return nil }
        if let image = Self.bundledAvatarImage(for: value) {
            return image
        }

        Self.logMissingBuiltInAvatar(name: name, path: value, assetName: assetName)
        return nil
    }

    private static func bundledAvatarImage(for value: String) -> UIImage? {
        guard let assetName = builtInAvatarAssetName(for: value) else { return nil }
        return UIImage(named: assetName)
    }

    static func builtInAvatarAssetName(for value: String) -> String? {
        let path = avatarPath(from: value)
        let lowercasedPath = path.lowercased()

        if lowercasedPath.hasPrefix("api/mission-control/agent-image/") ||
            lowercasedPath.contains("/api/mission-control/agent-image/") {
            let slug = lastPathComponent(from: path)
            let knownAgentImageAssets: [String: String] = [
                "claude-code": "Avatar_cluadecode",
                "codex": "Avatar_codex",
                "elliot-page": "Avatar_Elliot_Page",
                "execution-optimizer": "Avatar_Execution_Optimizer",
                "gapminer": "Avatar_GapMiner",
                "gapminer-auditor": "Avatar_GapMiner_Auditor",
                "gapminer-orchestrator": "Avatar_GapMiner_Orchestrator",
                "nathan-guide": "Avatar_Nathan_Guide",
                "rs-onpage-optimizer": "Avatar_RS_OnPage_Optimizer",
                "targeting-maintenance": "Avatar_Targeting___Maintenance",
            ]

            return knownAgentImageAssets[slug] ?? "Avatar_\(sanitizedAssetComponent(slug))"
        }

        if lowercasedPath.hasPrefix("avatars/") || lowercasedPath.contains("/avatars/") {
            let filename = lastPathComponent(from: path)
            let stem = filename
                .split(separator: ".")
                .dropLast()
                .joined(separator: ".")
            let component = stem.isEmpty ? filename : stem
            return "Avatar_\(sanitizedAssetComponent(component))"
        }

        return nil
    }

    private static func avatarPath(from value: String) -> String {
        if let components = URLComponents(string: value), !components.path.isEmpty {
            return components.path
        }

        return value.components(separatedBy: "?").first ?? value
    }

    private static func lastPathComponent(from path: String) -> String {
        path.split(separator: "/").last.map(String.init) ?? path
    }

    private static func sanitizedAssetComponent(_ value: String) -> String {
        String(value.unicodeScalars.map { scalar in
            CharacterSet.alphanumerics.contains(scalar) || scalar == "_" ? Character(scalar) : "_"
        })
    }

    private static func logMissingBuiltInAvatar(name: String, path: String, assetName: String) {
#if DEBUG
        print("Relay Console avatar warning: missing built-in avatar asset id=\(assetName) name=\(name) path=\(path)")
#endif
    }

    private func resolvedAvatarURL(_ value: String) -> URL? {
        let trimmedValue = value.trimmingCharacters(in: .whitespacesAndNewlines)

        if let absolute = URL(string: trimmedValue), absolute.scheme != nil {
            return absolute
        }

        // Web stores some built-in avatars as root-relative public asset paths.
        // Relay Console Swift normalizes the same paths without the leading slash,
        // so accept both forms when an asset is not included in the app bundle.
        if trimmedValue.hasPrefix("/") ||
            trimmedValue.hasPrefix("avatars/") ||
            trimmedValue.hasPrefix("api/") {
            let normalizedPath = trimmedValue.hasPrefix("/") ? String(trimmedValue.dropFirst()) : trimmedValue
            if normalizedPath.hasPrefix("avatars/"),
               let avatarBaseURL = AppRuntimeConfig.avatarAssetBaseURL {
                return avatarBaseURL.appendingPathComponent(String(normalizedPath.dropFirst("avatars/".count)))
            }
            let rootRelativeValue = trimmedValue.hasPrefix("/") ? trimmedValue : "/\(trimmedValue)"
            return URL(string: rootRelativeValue, relativeTo: AppRuntimeConfig.webAssetBaseURL)?.absoluteURL
        }

        return nil
    }

    private var initialsView: some View {
        ZStack {
            name.avatarBackgroundColor
            Text(name.initials)
                .font(.system(size: size.fontSize, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.white)
        }
    }

    @ViewBuilder
    private var ringOverlay: some View {
        if showRing {
            Circle()
                .strokeBorder(ringColor, lineWidth: 2)
        }
    }

    private func statusDot(for status: AgentStatus) -> some View {
        Circle()
            .fill(Color.agentStatusColor(status))
            .frame(width: size.statusDotSize, height: size.statusDotSize)
            .overlay(
                Circle()
                    .stroke(ClawColors.backgroundPrimary, lineWidth: 2)
            )
            .accessibilityLabel("Status: \(status.rawValue.replacingOccurrences(of: "_", with: " "))")
    }
}

typealias AvatarView = RelayAvatar

// MARK: - Preview

#Preview {
    VStack(spacing: ClawSpacing.xl) {
        HStack(spacing: ClawSpacing.lg) {
            AvatarView(name: "Alice Zhang", imageUrl: nil, size: .small)
            AvatarView(name: "Bob Martinez", imageUrl: nil, size: .medium)
            AvatarView(name: "Carol White", imageUrl: nil, size: .large)
            AvatarView(name: "Dave Lee", imageUrl: nil, size: .xlarge)
        }

        HStack(spacing: ClawSpacing.lg) {
            AvatarView(name: "Alice Zhang", imageUrl: nil, size: .medium, status: .onDuty)
            AvatarView(name: "Bob Martinez", imageUrl: nil, size: .medium, status: .busy)
            AvatarView(name: "Carol White", imageUrl: nil, size: .medium, status: .paused)
            AvatarView(name: "Dave Lee", imageUrl: nil, size: .medium, status: .error)
            AvatarView(name: "Eve Turner", imageUrl: nil, size: .medium, status: .idle)
        }

        AvatarView(name: "Frank Ops", imageUrl: nil, size: .large, showRing: true, ringColor: ClawColors.accent)
    }
    .padding()
    .background(ClawColors.backgroundPrimary)
}
