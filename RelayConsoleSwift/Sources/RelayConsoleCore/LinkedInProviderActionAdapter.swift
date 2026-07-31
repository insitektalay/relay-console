import Foundation

public struct LinkedInProviderActionClientResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var redactionStatus: String

    public init(result: JSONRecord, redactionStatus: String = "private-state-excluded") {
        self.result = result
        self.redactionStatus = redactionStatus
    }
}

public protocol LinkedInProviderActionClient: Sendable {
    func executeLinkedInAction(request: MarketplaceProviderActionAdapterRequest) throws -> LinkedInProviderActionClientResult
}

public struct LinkedInProviderHTTPRequest: Sendable, Equatable {
    public var method: String
    public var url: URL
    public var headers: [String: String]
    public var body: Data?

    public init(method: String, url: URL, headers: [String: String] = [:], body: Data? = nil) {
        self.method = method
        self.url = url
        self.headers = headers
        self.body = body
    }
}

public struct LinkedInProviderHTTPResponse: Sendable, Equatable {
    public var statusCode: Int
    public var headers: [String: String]
    public var body: Data

    public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) {
        self.statusCode = statusCode
        self.headers = headers
        self.body = body
    }

    public func header(_ name: String) -> String? {
        let lowercased = name.lowercased()
        return headers.first { $0.key.lowercased() == lowercased }?.value
    }
}

public protocol LinkedInProviderHTTPClient: Sendable {
    func send(_ request: LinkedInProviderHTTPRequest) throws -> LinkedInProviderHTTPResponse
}

public struct URLSessionLinkedInProviderHTTPClient: LinkedInProviderHTTPClient {
    private let timeoutSeconds: TimeInterval

    public init(timeoutSeconds: TimeInterval = 30) {
        self.timeoutSeconds = timeoutSeconds
    }

    public func send(_ request: LinkedInProviderHTTPRequest) throws -> LinkedInProviderHTTPResponse {
        var urlRequest = URLRequest(url: request.url)
        urlRequest.httpMethod = request.method
        urlRequest.timeoutInterval = timeoutSeconds
        urlRequest.httpBody = request.body
        for (key, value) in request.headers {
            urlRequest.setValue(value, forHTTPHeaderField: key)
        }
        let semaphore = DispatchSemaphore(value: 0)
        var responseData: Data?
        var responseHeaders: [String: String] = [:]
        var responseStatusCode: Int?
        var responseError: Error?
        let task = URLSession.shared.dataTask(with: urlRequest) { data, response, error in
            responseData = data
            if let http = response as? HTTPURLResponse {
                responseStatusCode = http.statusCode
                responseHeaders = http.allHeaderFields.reduce(into: [String: String]()) { partial, element in
                    guard let key = element.key as? String else { return }
                    partial[key] = String(describing: element.value)
                }
            }
            responseError = error
            semaphore.signal()
        }
        task.resume()
        if semaphore.wait(timeout: .now() + timeoutSeconds) == .timedOut {
            task.cancel()
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_http_timeout",
                message: "LinkedIn API request timed out.",
                detail: ["urlHost": .string(request.url.host ?? "api.linkedin.com")]
            )
        }
        if let responseError {
            throw responseError
        }
        return LinkedInProviderHTTPResponse(
            statusCode: responseStatusCode ?? 0,
            headers: responseHeaders,
            body: responseData ?? Data()
        )
    }
}

public struct MissingLinkedInProviderActionClient: LinkedInProviderActionClient {
    public init() {}

    public func executeLinkedInAction(request: MarketplaceProviderActionAdapterRequest) throws -> LinkedInProviderActionClientResult {
        throw MarketplaceProviderActionAdapterFailure(
            code: "linkedin_live_adapter_missing",
            message: "Not posted to LinkedIn: live LinkedIn publishing is not configured in this runtime.",
            detail: [
                "actionKey": .string(request.definition.actionKey),
                "liveAdapterMissing": .bool(true),
                "notPosted": .bool(true)
            ]
        )
    }
}

public final class LiveLinkedInProviderActionClient: LinkedInProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService
    private let secrets: SecretService
    private let httpClient: any LinkedInProviderHTTPClient
    private let now: @Sendable () -> Date

    public init(
        data: LocalDataService,
        secrets: SecretService,
        httpClient: any LinkedInProviderHTTPClient = URLSessionLinkedInProviderHTTPClient(),
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.data = data
        self.secrets = secrets
        self.httpClient = httpClient
        self.now = now
    }

    public func executeLinkedInAction(request: MarketplaceProviderActionAdapterRequest) throws -> LinkedInProviderActionClientResult {
        switch request.definition.actionKey {
        case "linkedin_profile_get":
            return try readProfile(request: request)
        case "linkedin_text_post_create":
            return try createPost(request: request)
        default:
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_live_action_not_implemented",
                message: "Live LinkedIn provider execution does not support this action yet."
            )
        }
    }

    private func readProfile(request: MarketplaceProviderActionAdapterRequest) throws -> LinkedInProviderActionClientResult {
        let connection = try connection(for: request)
        try requireReady(connection: connection, actionKey: request.definition.actionKey, requiredScopes: ["openid", "profile"])
        let token = try accessToken(for: connection)
        let profile = try getSignedInUser(accessToken: token)
        return LinkedInProviderActionClientResult(result: baseResult(request: request).merging([
            "clientMode": .string("live-linkedin-api"),
            "liveCredentialsUsed": .bool(true),
            "profile": .object(profile.redactedProfileResult)
        ]) { _, new in new })
    }

    private func createPost(request: MarketplaceProviderActionAdapterRequest) throws -> LinkedInProviderActionClientResult {
        let text = try Self.requiredText(request: request)
        let connection = try connection(for: request)
        try requireReady(connection: connection, actionKey: request.definition.actionKey, requiredScopes: ["w_member_social"])
        let token = try accessToken(for: connection)
        let profile = try getSignedInUser(accessToken: token)
        let response = try postTextShare(request: request, accessToken: token, authorUrn: profile.memberUrn, text: text)
        guard let postUrn = response.header("x-restli-id")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !postUrn.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_post_response_missing_id",
                message: "LinkedIn accepted the post request but did not return X-RestLi-Id.",
                detail: ["statusCode": .number(Double(response.statusCode))]
            )
        }
        return LinkedInProviderActionClientResult(result: baseResult(request: request).merging([
            "clientMode": .string("live-linkedin-api"),
            "liveCredentialsUsed": .bool(true),
            "actionFamily": .string("public-social-text"),
            "postId": .string(postUrn),
            "postUrn": .string(postUrn),
            "postUrl": .string(Self.feedURL(for: postUrn)),
            "published": .bool(true),
            "textCharacterCount": .number(Double(text.count))
        ]) { _, new in new })
    }

    private func postTextShare(
        request: MarketplaceProviderActionAdapterRequest,
        accessToken: String,
        authorUrn: String,
        text: String
    ) throws -> LinkedInProviderHTTPResponse {
        guard request.payload["visibility"] == nil || request.payload["visibility"]?.string?.uppercased() == "PUBLIC" else {
            throw MarketplaceProviderActionAdapterFailure(code: "linkedin_visibility_not_supported", message: "LinkedIn V1 permits public text posts only.")
        }
        let body: JSONRecord = [
            "author": .string(authorUrn),
            "lifecycleState": .string("PUBLISHED"),
            "commentary": .string(text),
            "visibility": .string("PUBLIC"),
            "distribution": .object([
                "feedDistribution": .string("MAIN_FEED"),
                "targetEntities": .array([]),
                "thirdPartyDistributionChannels": .array([])
            ]),
            "isReshareDisabledByAuthor": .bool(false)
        ]
        let response = try postJSON(
            path: "/rest/posts",
            body: body,
            accessToken: accessToken,
            extraHeaders: ["X-Restli-Protocol-Version": "2.0.0", "Linkedin-Version": "202603"]
        )
        guard response.statusCode == 201 else {
            throw Self.httpFailure(code: "linkedin_post_rejected", response: response)
        }
        return response
    }

    private func getSignedInUser(accessToken: String) throws -> (sub: String, memberUrn: String, redactedProfileResult: JSONRecord) {
        let response = try getJSONResponse(path: "/v2/userinfo", query: [:], accessToken: accessToken)
        guard (200..<300).contains(response.statusCode) else {
            throw Self.httpFailure(code: "linkedin_userinfo_rejected", response: response)
        }
        let record = try Self.parseJSONBody(response)
        guard let sub = record["sub"]?.string?.nilIfEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_userinfo_missing_sub",
                message: "LinkedIn userinfo did not return the member subject."
            )
        }
        var profile: JSONRecord = [
            "subject": .string(sub),
            "name": record["name"] ?? .null,
            "givenName": record["given_name"] ?? .null,
            "familyName": record["family_name"] ?? .null,
            "emailAndPictureExcluded": .bool(true),
            "redactionStatus": .string("private-state-excluded")
        ]
        if let locale = record["locale"] {
            profile["locale"] = locale
        }
        return (sub: sub, memberUrn: "urn:li:person:\(sub)", redactedProfileResult: profile)
    }

    private func getJSONResponse(path: String, query: [String: String], accessToken: String) throws -> LinkedInProviderHTTPResponse {
        let url = try Self.linkedInAPIURL(path: path, query: query)
        return try httpClient.send(LinkedInProviderHTTPRequest(
            method: "GET",
            url: url,
            headers: [
                "Authorization": "Bearer \(accessToken)",
                "Accept": "application/json"
            ]
        ))
    }

    private func postJSON(
        path: String,
        body: JSONRecord,
        accessToken: String,
        extraHeaders: [String: String] = [:]
    ) throws -> LinkedInProviderHTTPResponse {
        let url = try Self.linkedInAPIURL(path: path, query: [:])
        let bodyData = try jsonEncoder.encode(JSONValue.object(body))
        var headers = [
            "Authorization": "Bearer \(accessToken)",
            "Accept": "application/json",
            "Content-Type": "application/json"
        ]
        extraHeaders.forEach { headers[$0.key] = $0.value }
        return try httpClient.send(LinkedInProviderHTTPRequest(method: "POST", url: url, headers: headers, body: bodyData))
    }

    private func connection(for request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderConnection {
        guard let connectionId = request.auditIdentity.connectionId?.nilIfEmpty,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appId == request.app.id,
              connection.appSlug == request.app.slug else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_connection_missing",
                message: "LinkedIn execution requires a Relay Marketplace provider connection."
            )
        }
        return connection
    }

    private func requireReady(
        connection: MarketplaceProviderConnection,
        actionKey: String,
        requiredScopes: [String]
    ) throws {
        guard connection.status == .connected, connection.health.state == .ready,
              connection.credentialOwnership == .relayOwned,
              connection.requiredScopes == ProviderConnectionService.linkedInRelayOwnedOAuthScopes,
              connection.grantedScopes == ProviderConnectionService.linkedInRelayOwnedOAuthScopes,
              connection.health.diagnostics["memberVerified"]?.bool == true,
              connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
              connection.health.diagnostics["emailScopeEnabled"]?.bool == false,
              connection.health.diagnostics["memberSocialReadEnabled"]?.bool == false,
              connection.health.diagnostics["commentsLikesEnabled"]?.bool == false,
              connection.health.diagnostics["mediaOrganizationEnabled"]?.bool == false,
              connection.health.diagnostics["searchScrapingEnabled"]?.bool == false,
              connection.health.diagnostics["rawToolsEnabled"]?.bool == false else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_connection_not_ready",
                message: "The LinkedIn provider connection is not ready.",
                detail: ["connectionStatus": .string(connection.status.rawValue)]
            )
        }
        if let expiresAt = tokenExpiry(from: connection), expiresAt <= now() {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_token_expired",
                message: "The saved LinkedIn access token is expired. Replace the LinkedIn token in Marketplace.",
                detail: ["actionKey": .string(actionKey)]
            )
        }
        let granted = Set(connection.grantedScopes.map { $0.lowercased() })
        let missing = requiredScopes.filter { !granted.contains($0.lowercased()) }
        guard missing.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_missing_scope",
                message: "The saved LinkedIn token is missing required scope(s): \(missing.joined(separator: ", ")).",
                detail: [
                    "actionKey": .string(actionKey),
                    "missingScopes": .array(missing.map(JSONValue.string))
                ]
            )
        }
    }

    private func accessToken(for connection: MarketplaceProviderConnection) throws -> String {
        guard let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == "linkedin_oauth_access_token" })?.secretReferenceId else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_credentials_missing",
                message: "The LinkedIn provider connection is missing a Keychain access token reference."
            )
        }
        do {
            return try secrets.getSecretValue(secretId)
        } catch {
            markCredentialUnavailable(connection: connection)
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_credentials_unavailable",
                message: "Relay could not read the saved LinkedIn credential from the OS secret store. Replace the LinkedIn token in Marketplace."
            )
        }
    }

    private func markCredentialUnavailable(connection: MarketplaceProviderConnection) {
        var updated = connection
        updated.status = .healthError
        updated.authorizationState = .error
        updated.reauthorizeRequired = true
        updated.lastCheckedAt = nowIso()
        updated.lastError = "Saved LinkedIn credential is unavailable in the OS secret store. Replace the LinkedIn token in Marketplace."
        updated.health = ProviderConnectorHealth(
            state: .error,
            message: updated.lastError ?? "Saved LinkedIn credential is unavailable.",
            lastCheckedAt: updated.lastCheckedAt,
            missingScopes: [],
            unavailableTools: ["linkedin_profile_get", "linkedin_text_post_create", "linkedin_comment_create"],
            diagnostics: [
                "provider": .string("linkedin"),
                "reasonCode": .string("linkedin_credentials_unavailable"),
                "redactionStatus": .string("private-state-excluded")
            ],
            redactionStatus: "private-state-excluded"
        )
        updated.credentialRequirements = updated.credentialRequirements.map { requirement in
            var copy = requirement
            if copy.fieldKey == "linkedin_oauth_access_token" {
                copy.status = .unavailable
            }
            return copy
        }
        DispatchQueue.global(qos: .utility).async { [data] in
            _ = try? data.saveProviderConnection(updated)
        }
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "adapterBoundary": .string("linkedin-provider-action-adapter"),
            "clientMode": .string("live-linkedin-api"),
            "provider": .string("linkedin"),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "fakeAdapter": .bool(false),
            "liveCredentialsUsed": .bool(false),
            "simulated": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private static func requiredText(request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let text = request.payload["text"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_missing_text",
                message: "LinkedIn text actions require non-empty text."
            )
        }
        guard text.count <= 3000 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_text_too_long",
                message: "LinkedIn text actions are limited to 3000 characters."
            )
        }
        return text
    }

    private static func parseJSONBody(_ response: LinkedInProviderHTTPResponse) throws -> JSONRecord {
        guard !response.body.isEmpty else {
            return [:]
        }
        guard let json = try JSONSerialization.jsonObject(with: response.body) as? [String: Any] else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_invalid_json",
                message: "LinkedIn API returned a non-object JSON response.",
                providerStatusCode: response.statusCode
            )
        }
        return jsonRecord(from: json)
    }

    private static func httpFailure(code: String, response: LinkedInProviderHTTPResponse) -> MarketplaceProviderActionAdapterFailure {
        let body = bodySnippet(response.body)
        let mappedCode: String
        let message: String
        switch response.statusCode {
        case 401:
            mappedCode = "linkedin_token_expired"
            message = "LinkedIn rejected the saved access token. Replace the LinkedIn token in Marketplace."
        case 403:
            mappedCode = "linkedin_missing_scope"
            message = "LinkedIn rejected the request because the token lacks required access or product approval."
        default:
            mappedCode = code
            message = "LinkedIn API returned HTTP \(response.statusCode)."
        }
        return MarketplaceProviderActionAdapterFailure(
            code: mappedCode,
            message: message,
            providerStatusCode: response.statusCode,
            detail: body.isEmpty ? [:] : ["body": .string(body)]
        )
    }

    private static func linkedInAPIURL(path: String, query: [String: String]) throws -> URL {
        var components = URLComponents()
        components.scheme = "https"
        components.host = "api.linkedin.com"
        components.path = path
        components.queryItems = query.isEmpty ? nil : query.sorted { $0.key < $1.key }.map {
            URLQueryItem(name: $0.key, value: $0.value)
        }
        guard let url = components.url else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_invalid_url",
                message: "Could not build the LinkedIn API URL."
            )
        }
        return url
    }

    private static func bodySnippet(_ body: Data) -> String {
        guard !body.isEmpty else { return "" }
        let text = String(data: body, encoding: .utf8) ?? "<non-utf8 body>"
        return String(text.prefix(500))
    }

    private static func feedURL(for urn: String) -> String {
        "https://www.linkedin.com/feed/update/\(urn)"
    }

    private func tokenExpiry(from connection: MarketplaceProviderConnection) -> Date? {
        guard let raw = connection.health.diagnostics["tokenExpiresAt"]?.string?.nilIfEmpty,
              raw != "user-managed" else {
            return nil
        }
        return ISO8601DateFormatter.relayConsole.date(from: raw)
            ?? ISO8601DateFormatter().date(from: raw)
    }
}

public struct LinkedInProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowlistedActionKeys: Set<String> = [
        "linkedin_profile_get",
        "linkedin_post_draft",
        "linkedin_text_post_create",
        
    ]

    private let client: any LinkedInProviderActionClient

    public init(client: any LinkedInProviderActionClient = MissingLinkedInProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "linkedin" else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_adapter_wrong_provider",
                message: "LinkedIn adapter can only execute LinkedIn provider actions."
            )
        }
        guard Self.allowlistedActionKeys.contains(request.definition.actionKey) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_action_not_allowlisted",
                message: "The requested LinkedIn action is not in the V1 adapter allowlist."
            )
        }

        if request.definition.actionKey == "linkedin_post_draft" {
            let text = try Self.requiredText(request: request)
            return MarketplaceProviderActionAdapterResult(result: baseResult(request: request).merging([
                "draftId": .string("linkedin-draft-\(Self.stableSuffix(text + request.idempotencyKey))"),
                "localOnly": .bool(true),
                "providerCallMade": .bool(false),
                "published": .bool(false),
                "text": .string(text),
                "characterCount": .number(Double(text.count)),
                "textCharacterCount": .number(Double(text.count))
            ]) { _, new in new })
        }

        let output = try client.executeLinkedInAction(request: request)
        return MarketplaceProviderActionAdapterResult(
            result: output.result,
            error: nil,
            redactionStatus: output.redactionStatus
        )
    }

    private func baseResult(request: MarketplaceProviderActionAdapterRequest) -> JSONRecord {
        [
            "adapterBoundary": .string("linkedin-provider-action-adapter"),
            "clientMode": .string("local-linkedin-draft"),
            "provider": .string("linkedin"),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "fakeAdapter": .bool(false),
            "liveCredentialsUsed": .bool(false),
            "simulated": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private static func requiredText(request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let text = request.payload["text"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_missing_text",
                message: "LinkedIn text actions require non-empty text."
            )
        }
        guard text.count <= 3000 else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_text_too_long",
                message: "LinkedIn text actions are limited to 3000 characters."
            )
        }
        return text
    }

    private static func stableSuffix(_ value: String) -> String {
        var hash: UInt64 = 1469598103934665603
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1099511628211
        }
        let hex = String(hash, radix: 16)
        return String(hex.suffix(10))
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
