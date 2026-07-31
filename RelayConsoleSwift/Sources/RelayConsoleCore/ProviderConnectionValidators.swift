import Foundation

public enum ExaAPIKeyValidationStatus: String, Sendable {
  case ready
  case invalidKey = "invalid_key"
  case billingUnavailable = "billing_unavailable"
  case rateLimited = "rate_limited"
  case serviceUnavailable = "service_unavailable"
  case networkError = "network_error"
}

public enum PostHogTokenValidationStatus: String, Sendable {
  case ready
  case invalidToken = "invalid_token"
  case forbidden
  case projectUnavailable = "project_unavailable"
  case rateLimited = "rate_limited"
  case serviceUnavailable = "service_unavailable"
  case networkError = "network_error"
}

public struct PostHogTokenValidationResult: Sendable, Equatable {
  public var status: PostHogTokenValidationStatus
  public var message: String
  public var httpStatusCode: Int?
  public var baseURL: String?
  public var organizationId: String?
  public var organizationName: String?
  public var projectId: String?
  public var projectName: String?
  public var projectCount: Int

  public init(
    status: PostHogTokenValidationStatus,
    message: String,
    httpStatusCode: Int? = nil,
    baseURL: String? = nil,
    organizationId: String? = nil,
    organizationName: String? = nil,
    projectId: String? = nil,
    projectName: String? = nil,
    projectCount: Int = 0
  ) {
    self.status = status
    self.message = message
    self.httpStatusCode = httpStatusCode
    self.baseURL = baseURL
    self.organizationId = organizationId
    self.organizationName = organizationName
    self.projectId = projectId
    self.projectName = projectName
    self.projectCount = projectCount
  }

  public var isReady: Bool {
    status == .ready
  }
}

public protocol PostHogTokenValidating: Sendable {
  func validate(personalAPIKey: String, baseURL: String, projectId: String?) async
    -> PostHogTokenValidationResult
}

public final class URLSessionPostHogTokenValidator: PostHogTokenValidating, @unchecked Sendable {
  public init() {}

  public func validate(personalAPIKey: String, baseURL: String, projectId: String?) async
    -> PostHogTokenValidationResult
  {
    let trimmedKey = personalAPIKey.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedKey.isEmpty else {
      return PostHogTokenValidationResult(
        status: .invalidToken,
        message: "Enter a PostHog personal API key before checking the connection.")
    }
    guard let normalizedBaseURL = Self.normalizedBaseURL(baseURL) else {
      return PostHogTokenValidationResult(
        status: .serviceUnavailable, message: "Enter a valid PostHog private API base URL.")
    }
    let trimmedProjectId = projectId?.providerConnectionNilIfEmpty
    let path = trimmedProjectId.map { "/api/projects/\(Self.pathEncode($0))/" } ?? "/api/projects/"
    var components = URLComponents(string: normalizedBaseURL.absoluteString + path)
    if trimmedProjectId == nil {
      components?.queryItems = [URLQueryItem(name: "limit", value: "10")]
    }
    guard let url = components?.url else {
      return PostHogTokenValidationResult(
        status: .serviceUnavailable, message: "PostHog health-check URL could not be built.",
        baseURL: normalizedBaseURL.absoluteString)
    }
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.timeoutInterval = 15
    request.setValue("Bearer \(trimmedKey)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse else {
        return PostHogTokenValidationResult(
          status: .networkError, message: "PostHog returned an unexpected response.",
          baseURL: normalizedBaseURL.absoluteString)
      }
      switch http.statusCode {
      case 200..<300:
        let record = Self.parseJSONBody(data)
        let projectRecord = Self.projectRecord(from: record, requestedProjectId: trimmedProjectId)
        let count = Int(record["count"]?.number ?? Double(projectRecord == nil ? 0 : 1))
        let projectName =
          projectRecord?["name"]?.string?.providerConnectionNilIfEmpty
          ?? projectRecord?["display_name"]?.string?.providerConnectionNilIfEmpty
        let resolvedProjectId =
          projectRecord?["id"]?.string?.providerConnectionNilIfEmpty
          ?? projectRecord?["id"]?.number.map { String(Int($0)) }
          ?? trimmedProjectId
        return PostHogTokenValidationResult(
          status: .ready,
          message: "PostHog personal API key verified with a bounded project read.",
          httpStatusCode: http.statusCode,
          baseURL: normalizedBaseURL.absoluteString,
          organizationId: projectRecord?["organization_id"]?.string?.providerConnectionNilIfEmpty,
          organizationName: Self.organizationName(from: projectRecord),
          projectId: resolvedProjectId,
          projectName: projectName,
          projectCount: max(count, projectRecord == nil ? 0 : 1)
        )
      case 401:
        return PostHogTokenValidationResult(
          status: .invalidToken, message: "PostHog rejected this personal API key.",
          httpStatusCode: http.statusCode, baseURL: normalizedBaseURL.absoluteString)
      case 403:
        return PostHogTokenValidationResult(
          status: .forbidden,
          message:
            "PostHog accepted the key format but denied the project read. Confirm read scopes and project access.",
          httpStatusCode: http.statusCode, baseURL: normalizedBaseURL.absoluteString)
      case 404:
        return PostHogTokenValidationResult(
          status: .projectUnavailable,
          message: "PostHog could not find the selected project for this key and base URL.",
          httpStatusCode: http.statusCode, baseURL: normalizedBaseURL.absoluteString)
      case 429:
        return PostHogTokenValidationResult(
          status: .rateLimited,
          message: "PostHog rate-limited the connection check. Try again shortly.",
          httpStatusCode: http.statusCode, baseURL: normalizedBaseURL.absoluteString)
      default:
        return PostHogTokenValidationResult(
          status: .serviceUnavailable,
          message: "PostHog returned HTTP \(http.statusCode) during the connection check.",
          httpStatusCode: http.statusCode, baseURL: normalizedBaseURL.absoluteString)
      }
    } catch {
      return PostHogTokenValidationResult(
        status: .networkError, message: "Could not reach PostHog: \(error.localizedDescription)",
        baseURL: normalizedBaseURL.absoluteString)
    }
  }

  private static func normalizedBaseURL(_ value: String) -> URL? {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(
      in: CharacterSet(charactersIn: "/"))
    guard !trimmed.isEmpty else { return URL(string: "https://us.posthog.com") }
    guard var components = URLComponents(string: trimmed) else { return nil }
    if components.scheme == nil {
      components.scheme = "https"
    }
    components.path = ""
    components.query = nil
    components.fragment = nil
    guard components.scheme == "https" || components.scheme == "http" else { return nil }
    return components.url
  }

  private static func projectRecord(from record: JSONRecord, requestedProjectId: String?)
    -> JSONRecord?
  {
    if requestedProjectId != nil {
      return record
    }
    if case .array(let values)? = record["results"] {
      for value in values {
        if case .object(let object) = value {
          return object
        }
      }
    }
    return nil
  }

  private static func organizationName(from projectRecord: JSONRecord?) -> String? {
    guard case .object(let organization)? = projectRecord?["organization"] else {
      return projectRecord?["organization_name"]?.string?.providerConnectionNilIfEmpty
    }
    return organization["name"]?.string?.providerConnectionNilIfEmpty
      ?? organization["slug"]?.string?.providerConnectionNilIfEmpty
      ?? organization["id"]?.string?.providerConnectionNilIfEmpty
  }

  private static func parseJSONBody(_ body: Data) -> JSONRecord {
    guard !body.isEmpty,
      let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any]
    else {
      return [:]
    }
    return jsonRecord(from: json)
  }

  private static func pathEncode(_ value: String) -> String {
    value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
  }
}

public struct ExaAPIKeyValidationResult: Sendable, Equatable {
  public var status: ExaAPIKeyValidationStatus
  public var message: String
  public var httpStatusCode: Int?

  public init(status: ExaAPIKeyValidationStatus, message: String, httpStatusCode: Int? = nil) {
    self.status = status
    self.message = message
    self.httpStatusCode = httpStatusCode
  }

  public var isReady: Bool {
    status == .ready
  }
}

public protocol ExaAPIKeyValidating: Sendable {
  func validate(apiKey: String) async -> ExaAPIKeyValidationResult
}

public final class URLSessionExaAPIKeyValidator: ExaAPIKeyValidating, @unchecked Sendable {
  public init() {}

  public func validate(apiKey: String) async -> ExaAPIKeyValidationResult {
    let trimmed = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      return ExaAPIKeyValidationResult(
        status: .invalidKey, message: "Enter an Exa API key before testing.")
    }
    guard let url = URL(string: "https://api.exa.ai/search") else {
      return ExaAPIKeyValidationResult(
        status: .serviceUnavailable, message: "Exa Search endpoint is unavailable.")
    }
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.timeoutInterval = 20
    request.setValue(trimmed, forHTTPHeaderField: "x-api-key")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: [
      "query": "Relay Console Exa connection test",
      "numResults": 1,
    ])
    do {
      let (_, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse else {
        return ExaAPIKeyValidationResult(
          status: .networkError, message: "Exa returned an unexpected response.")
      }
      switch http.statusCode {
      case 200..<300:
        return ExaAPIKeyValidationResult(
          status: .ready, message: "Exa API key verified.", httpStatusCode: http.statusCode)
      case 401:
        return ExaAPIKeyValidationResult(
          status: .invalidKey, message: "Exa rejected this API key.",
          httpStatusCode: http.statusCode)
      case 402:
        return ExaAPIKeyValidationResult(
          status: .billingUnavailable,
          message: "Exa accepted the key, but credits or spending budget are exhausted.",
          httpStatusCode: http.statusCode)
      case 429:
        return ExaAPIKeyValidationResult(
          status: .rateLimited, message: "Exa rate-limited the test request. Try again shortly.",
          httpStatusCode: http.statusCode)
      default:
        return ExaAPIKeyValidationResult(
          status: .serviceUnavailable, message: "Exa returned HTTP \(http.statusCode).",
          httpStatusCode: http.statusCode)
      }
    } catch {
      return ExaAPIKeyValidationResult(
        status: .networkError, message: "Could not reach Exa: \(error.localizedDescription)")
    }
  }
}

public enum LinkedInTokenValidationStatus: String, Sendable {
  case ready
  case invalidToken = "invalid_token"
  case expiredToken = "expired_token"
  case missingScope = "missing_scope"
  case serviceUnavailable = "service_unavailable"
  case networkError = "network_error"
}

public struct LinkedInTokenValidationResult: Sendable, Equatable {
  public var status: LinkedInTokenValidationStatus
  public var message: String
  public var httpStatusCode: Int?
  public var grantedScopes: [String]
  public var missingScopes: [String]
  public var memberSub: String?
  public var displayName: String?
  public var email: String?
  public var expiresAt: String?

  public init(
    status: LinkedInTokenValidationStatus,
    message: String,
    httpStatusCode: Int? = nil,
    grantedScopes: [String] = [],
    missingScopes: [String] = [],
    memberSub: String? = nil,
    displayName: String? = nil,
    email: String? = nil,
    expiresAt: String? = nil
  ) {
    self.status = status
    self.message = message
    self.httpStatusCode = httpStatusCode
    self.grantedScopes = grantedScopes
    self.missingScopes = missingScopes
    self.memberSub = memberSub
    self.displayName = displayName
    self.email = email
    self.expiresAt = expiresAt
  }

  public var isReady: Bool {
    status == .ready
  }
}

public protocol LinkedInTokenValidating: Sendable {
  func validate(
    accessToken: String, clientId: String, clientSecret: String, requiredScopes: [String]
  ) async -> LinkedInTokenValidationResult
}

public final class URLSessionLinkedInTokenValidator: LinkedInTokenValidating, @unchecked Sendable {
  private let httpClient: any LinkedInProviderHTTPClient

  public init(httpClient: any LinkedInProviderHTTPClient = URLSessionLinkedInProviderHTTPClient()) {
    self.httpClient = httpClient
  }

  public func validate(
    accessToken: String, clientId: String, clientSecret: String, requiredScopes: [String]
  ) async -> LinkedInTokenValidationResult {
    let trimmed = accessToken.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedClientId = clientId.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedClientSecret = clientSecret.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      return LinkedInTokenValidationResult(
        status: .invalidToken, message: "Enter a LinkedIn access token before saving.")
    }
    guard !trimmedClientId.isEmpty, !trimmedClientSecret.isEmpty else {
      return LinkedInTokenValidationResult(
        status: .invalidToken,
        message:
          "Enter the LinkedIn app client ID and client secret so Relay can verify the token status and posting scope.",
        missingScopes: requiredScopes
      )
    }
    let introspection = await introspect(
      accessToken: trimmed,
      clientId: trimmedClientId,
      clientSecret: trimmedClientSecret,
      requiredScopes: requiredScopes
    )
    guard introspection.isReady else {
      return introspection
    }
    guard let url = URL(string: "https://api.linkedin.com/v2/userinfo") else {
      return LinkedInTokenValidationResult(
        status: .serviceUnavailable, message: "LinkedIn userinfo endpoint is unavailable.")
    }
    do {
      let response = try httpClient.send(
        LinkedInProviderHTTPRequest(
          method: "GET",
          url: url,
          headers: [
            "Authorization": "Bearer \(trimmed)",
            "Accept": "application/json",
          ]
        ))
      switch response.statusCode {
      case 200..<300:
        let record = try Self.parseJSONBody(response.body)
        guard let sub = record["sub"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
          !sub.isEmpty
        else {
          return LinkedInTokenValidationResult(
            status: .invalidToken,
            message: "LinkedIn accepted the token but did not return a member subject.",
            httpStatusCode: response.statusCode
          )
        }
        return LinkedInTokenValidationResult(
          status: .ready,
          message: "LinkedIn access token verified for member posting.",
          httpStatusCode: response.statusCode,
          grantedScopes: introspection.grantedScopes,
          missingScopes: [],
          memberSub: sub,
          displayName: record["name"]?.string,
          email: record["email"]?.string,
          expiresAt: introspection.expiresAt
        )
      case 401:
        return LinkedInTokenValidationResult(
          status: .invalidToken,
          message: "LinkedIn rejected this access token. Generate a fresh token and try again.",
          httpStatusCode: response.statusCode,
          grantedScopes: introspection.grantedScopes,
          missingScopes: requiredScopes,
          expiresAt: introspection.expiresAt
        )
      case 403:
        return LinkedInTokenValidationResult(
          status: .missingScope,
          message:
            "LinkedIn rejected the token for userinfo. Confirm the token includes openid/profile and that the app product is approved.",
          httpStatusCode: response.statusCode,
          grantedScopes: introspection.grantedScopes,
          missingScopes: ["openid", "profile"],
          expiresAt: introspection.expiresAt
        )
      default:
        return LinkedInTokenValidationResult(
          status: .serviceUnavailable,
          message: "LinkedIn returned HTTP \(response.statusCode) while validating the token.",
          httpStatusCode: response.statusCode,
          grantedScopes: introspection.grantedScopes,
          missingScopes: requiredScopes,
          expiresAt: introspection.expiresAt
        )
      }
    } catch {
      return LinkedInTokenValidationResult(
        status: .networkError, message: "Could not reach LinkedIn: \(error.localizedDescription)")
    }
  }

  private func introspect(
    accessToken: String,
    clientId: String,
    clientSecret: String,
    requiredScopes: [String]
  ) async -> LinkedInTokenValidationResult {
    guard let url = URL(string: "https://www.linkedin.com/oauth/v2/introspectToken") else {
      return LinkedInTokenValidationResult(
        status: .serviceUnavailable,
        message: "LinkedIn token introspection endpoint is unavailable.")
    }
    let form = [
      ("client_id", clientId),
      ("client_secret", clientSecret),
      ("token", accessToken),
    ]
    let body = form.map { key, value in
      "\(Self.formEncode(key))=\(Self.formEncode(value))"
    }.joined(separator: "&")
    do {
      let response = try httpClient.send(
        LinkedInProviderHTTPRequest(
          method: "POST",
          url: url,
          headers: [
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          ],
          body: Data(body.utf8)
        ))
      guard (200..<300).contains(response.statusCode) else {
        if response.statusCode == 400 || response.statusCode == 401 {
          return LinkedInTokenValidationResult(
            status: .invalidToken,
            message: response.statusCode == 400
              ? "LinkedIn rejected the app client ID or access token while inspecting the token."
              : "LinkedIn rejected the app client secret while inspecting the token.",
            httpStatusCode: response.statusCode,
            missingScopes: requiredScopes
          )
        }
        return LinkedInTokenValidationResult(
          status: .serviceUnavailable,
          message: "LinkedIn returned HTTP \(response.statusCode) while inspecting the token.",
          httpStatusCode: response.statusCode,
          missingScopes: requiredScopes
        )
      }
      let record = try Self.parseJSONBody(response.body)
      let active = record["active"]?.bool == true
      let status = record["status"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
      let scopes = Self.scopes(from: record["scope"]?.string)
      let grantedScopeSet = Set(scopes.map { $0.lowercased() })
      let missingScopes = requiredScopes.filter { !grantedScopeSet.contains($0.lowercased()) }
      let expiresAt = Self.isoTimestamp(fromEpochSeconds: record["expires_at"]?.number)
      guard active else {
        let expired = status == "expired"
        return LinkedInTokenValidationResult(
          status: expired ? .expiredToken : .invalidToken,
          message: expired
            ? "LinkedIn says this access token is expired. Generate and save a fresh token."
            : "LinkedIn says this access token is not active.",
          httpStatusCode: response.statusCode,
          grantedScopes: scopes,
          missingScopes: missingScopes.isEmpty ? requiredScopes : missingScopes,
          expiresAt: expiresAt
        )
      }
      guard missingScopes.isEmpty else {
        return LinkedInTokenValidationResult(
          status: .missingScope,
          message:
            "LinkedIn token is active but missing required scope(s): \(missingScopes.joined(separator: ", ")).",
          httpStatusCode: response.statusCode,
          grantedScopes: scopes,
          missingScopes: missingScopes,
          expiresAt: expiresAt
        )
      }
      return LinkedInTokenValidationResult(
        status: .ready,
        message: "LinkedIn token introspection verified active status and required posting scopes.",
        httpStatusCode: response.statusCode,
        grantedScopes: scopes,
        missingScopes: [],
        expiresAt: expiresAt
      )
    } catch {
      return LinkedInTokenValidationResult(
        status: .networkError,
        message: "Could not inspect LinkedIn token: \(error.localizedDescription)")
    }
  }

  private static func parseJSONBody(_ body: Data) throws -> JSONRecord {
    guard !body.isEmpty else {
      return [:]
    }
    guard let json = try JSONSerialization.jsonObject(with: body) as? [String: Any] else {
      return [:]
    }
    return jsonRecord(from: json)
  }

  private static func scopes(from raw: String?) -> [String] {
    guard let raw else { return [] }
    return
      raw
      .split { $0 == "," || $0 == " " || $0 == "\n" || $0 == "\t" }
      .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
  }

  private static func isoTimestamp(fromEpochSeconds seconds: Double?) -> String? {
    guard let seconds else { return nil }
    return ISO8601DateFormatter.relayConsole.string(from: Date(timeIntervalSince1970: seconds))
  }

  private static func formEncode(_ value: String) -> String {
    var allowed = CharacterSet.urlQueryAllowed
    allowed.remove(charactersIn: "&+=?")
    return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
  }
}

public enum NotionTokenValidationStatus: String, Sendable {
  case ready
  case invalidToken = "invalid_token"
  case missingSecret = "missing_secret"
  case secretUnavailable = "secret_unavailable"
  case restrictedResource = "restricted_resource"
  case rateLimited = "rate_limited"
  case serviceUnavailable = "service_unavailable"
  case networkError = "network_error"
}

public struct NotionTokenValidationResult: Sendable, Equatable {
  public var status: NotionTokenValidationStatus
  public var message: String
  public var httpStatusCode: Int?
  public var userId: String?
  public var userName: String?
  public var userType: String?

  public init(
    status: NotionTokenValidationStatus,
    message: String,
    httpStatusCode: Int? = nil,
    userId: String? = nil,
    userName: String? = nil,
    userType: String? = nil
  ) {
    self.status = status
    self.message = message
    self.httpStatusCode = httpStatusCode
    self.userId = userId
    self.userName = userName
    self.userType = userType
  }

  public var isReady: Bool {
    status == .ready
  }
}

public protocol NotionTokenValidating: Sendable {
  func validate(apiToken: String) async -> NotionTokenValidationResult
}

public final class URLSessionNotionTokenValidator: NotionTokenValidating, @unchecked Sendable {
  private let apiVersion = "2026-03-11"

  public init() {}

  public func validate(apiToken: String) async -> NotionTokenValidationResult {
    let trimmed = apiToken.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      return NotionTokenValidationResult(
        status: .invalidToken, message: "Enter a Notion API token before saving.")
    }
    guard let url = URL(string: "https://api.notion.com/v1/users/me") else {
      return NotionTokenValidationResult(
        status: .serviceUnavailable, message: "Notion users/me endpoint is unavailable.")
    }
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.timeoutInterval = 20
    request.setValue("Bearer \(trimmed)", forHTTPHeaderField: "Authorization")
    request.setValue(apiVersion, forHTTPHeaderField: "Notion-Version")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse else {
        return NotionTokenValidationResult(
          status: .networkError, message: "Notion returned an unexpected response.")
      }
      switch http.statusCode {
      case 200..<300:
        guard let record = try? Self.parseJSONBody(data),
          let id = record["id"]?.string?.providerConnectionNilIfEmpty
        else {
          return NotionTokenValidationResult(
            status: .serviceUnavailable,
            message: "Notion accepted the token but returned an unreadable users/me response.",
            httpStatusCode: http.statusCode
          )
        }
        return NotionTokenValidationResult(
          status: .ready,
          message: "Notion API token verified.",
          httpStatusCode: http.statusCode,
          userId: id,
          userName: record["name"]?.string,
          userType: record["type"]?.string
        )
      case 401:
        return NotionTokenValidationResult(
          status: .invalidToken,
          message:
            "Notion rejected this API token. Replace it with a current user-owned Notion token.",
          httpStatusCode: http.statusCode
        )
      case 403:
        return NotionTokenValidationResult(
          status: .restrictedResource,
          message:
            "Notion accepted the request but blocked the token from users/me. Confirm the token is active and allowed for API access.",
          httpStatusCode: http.statusCode
        )
      case 429:
        return NotionTokenValidationResult(
          status: .rateLimited,
          message: "Notion rate-limited the health check. Try again shortly.",
          httpStatusCode: http.statusCode
        )
      default:
        let providerCode = (try? Self.parseJSONBody(data))?["code"]?.string?
          .providerConnectionNilIfEmpty
        let suffix = providerCode.map { " (\($0))" } ?? ""
        return NotionTokenValidationResult(
          status: .serviceUnavailable,
          message: "Notion returned HTTP \(http.statusCode)\(suffix).",
          httpStatusCode: http.statusCode
        )
      }
    } catch {
      return NotionTokenValidationResult(
        status: .networkError, message: "Could not reach Notion: \(error.localizedDescription)")
    }
  }

  private static func parseJSONBody(_ body: Data) throws -> JSONRecord {
    guard !body.isEmpty else {
      return [:]
    }
    guard let json = try JSONSerialization.jsonObject(with: body) as? [String: Any] else {
      return [:]
    }
    return jsonRecord(from: json)
  }
}

public enum MicrosoftClarityTokenValidationStatus: String, Sendable {
  case ready
  case invalidToken = "invalid_token"
  case missingSecret = "missing_secret"
  case secretUnavailable = "secret_unavailable"
  case unauthorized
  case invalidRequest = "invalid_request"
  case quotaExceeded = "quota_exceeded"
  case serviceUnavailable = "service_unavailable"
  case providerFormatError = "provider_format_error"
  case networkError = "network_error"
}

public struct MicrosoftClarityTokenValidationResult: Sendable, Equatable {
  public var status: MicrosoftClarityTokenValidationStatus
  public var message: String
  public var httpStatusCode: Int?
  public var metricGroupCount: Int
  public var rowCount: Int

  public init(
    status: MicrosoftClarityTokenValidationStatus,
    message: String,
    httpStatusCode: Int? = nil,
    metricGroupCount: Int = 0,
    rowCount: Int = 0
  ) {
    self.status = status
    self.message = message
    self.httpStatusCode = httpStatusCode
    self.metricGroupCount = metricGroupCount
    self.rowCount = rowCount
  }

  public var isReady: Bool {
    status == .ready
  }
}

public protocol MicrosoftClarityTokenValidating: Sendable {
  func validate(apiToken: String) async -> MicrosoftClarityTokenValidationResult
}

public final class URLSessionMicrosoftClarityTokenValidator: MicrosoftClarityTokenValidating,
  @unchecked Sendable
{
  public init() {}

  public func validate(apiToken: String) async -> MicrosoftClarityTokenValidationResult {
    let trimmed = apiToken.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      return MicrosoftClarityTokenValidationResult(
        status: .invalidToken,
        message: "Enter a Microsoft Clarity Data Export API token before checking the connection.")
    }
    guard
      var components = URLComponents(
        string: "https://www.clarity.ms/export-data/api/v1/project-live-insights")
    else {
      return MicrosoftClarityTokenValidationResult(
        status: .serviceUnavailable,
        message: "Microsoft Clarity Data Export API endpoint is unavailable.")
    }
    components.queryItems = [
      URLQueryItem(name: "numOfDays", value: "1"),
      URLQueryItem(name: "dimension1", value: "OS"),
    ]
    guard let url = components.url else {
      return MicrosoftClarityTokenValidationResult(
        status: .serviceUnavailable,
        message: "Microsoft Clarity health-check URL could not be built.")
    }
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.timeoutInterval = 15
    request.setValue("Bearer \(trimmed)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse else {
        return MicrosoftClarityTokenValidationResult(
          status: .networkError, message: "Microsoft Clarity returned an unexpected response.")
      }
      switch http.statusCode {
      case 200..<300:
        guard let json = try? JSONSerialization.jsonObject(with: data) else {
          return MicrosoftClarityTokenValidationResult(
            status: .providerFormatError,
            message: "Microsoft Clarity accepted the token but returned unreadable JSON.",
            httpStatusCode: http.statusCode
          )
        }
        let summary = Self.responseSummary(from: json)
        return MicrosoftClarityTokenValidationResult(
          status: .ready,
          message:
            "Microsoft Clarity Data Export API token verified with one bounded project-live-insights request.",
          httpStatusCode: http.statusCode,
          metricGroupCount: summary.metricGroupCount,
          rowCount: summary.rowCount
        )
      case 400:
        return MicrosoftClarityTokenValidationResult(
          status: .invalidRequest,
          message: "Microsoft Clarity rejected the bounded health-check parameters.",
          httpStatusCode: http.statusCode
        )
      case 401:
        return MicrosoftClarityTokenValidationResult(
          status: .invalidToken,
          message:
            "Microsoft Clarity rejected this Data Export API token. Generate a current project admin token and reconnect.",
          httpStatusCode: http.statusCode
        )
      case 403:
        return MicrosoftClarityTokenValidationResult(
          status: .unauthorized,
          message:
            "Microsoft Clarity accepted the token format but it is not authorized for the Data Export API operation.",
          httpStatusCode: http.statusCode
        )
      case 429:
        return MicrosoftClarityTokenValidationResult(
          status: .quotaExceeded,
          message: "Microsoft Clarity daily Data Export API quota is exhausted for this project.",
          httpStatusCode: http.statusCode
        )
      default:
        return MicrosoftClarityTokenValidationResult(
          status: .serviceUnavailable,
          message: "Microsoft Clarity returned HTTP \(http.statusCode) during the health check.",
          httpStatusCode: http.statusCode
        )
      }
    } catch {
      if (error as? URLError)?.code == .timedOut {
        return MicrosoftClarityTokenValidationResult(
          status: .networkError,
          message: "Microsoft Clarity health check timed out after 15 seconds.")
      }
      return MicrosoftClarityTokenValidationResult(
        status: .networkError,
        message: "Could not reach Microsoft Clarity: \(error.localizedDescription)")
    }
  }

  private static func responseSummary(from json: Any) -> (metricGroupCount: Int, rowCount: Int) {
    if let groups = json as? [[String: Any]] {
      return (
        metricGroupCount: groups.count,
        rowCount: groups.reduce(0) { total, group in
          total + ((group["information"] as? [Any])?.count ?? 0)
        }
      )
    }
    if let object = json as? [String: Any] {
      if let groups = object["data"] as? [[String: Any]] {
        return (
          metricGroupCount: groups.count,
          rowCount: groups.reduce(0) { total, group in
            total + ((group["information"] as? [Any])?.count ?? 0)
          }
        )
      }
      return (
        metricGroupCount: object.isEmpty ? 0 : 1,
        rowCount: (object["information"] as? [Any])?.count ?? 0
      )
    }
    return (metricGroupCount: 0, rowCount: 0)
  }
}

public enum TelemetryDeckPATValidationStatus: String, Sendable {
  case ready
  case invalidToken = "invalid_token"
  case missingSecret = "missing_secret"
  case secretUnavailable = "secret_unavailable"
  case paidPlanRequired = "paid_plan_required"
  case forbidden
  case rateLimited = "rate_limited"
  case serviceUnavailable = "service_unavailable"
  case providerFormatError = "provider_format_error"
  case networkError = "network_error"
}

public struct TelemetryDeckPATValidationResult: Sendable, Equatable {
  public var status: TelemetryDeckPATValidationStatus
  public var message: String
  public var httpStatusCode: Int?
  public var userId: String?
  public var userEmail: String?
  public var organizationName: String?

  public init(
    status: TelemetryDeckPATValidationStatus,
    message: String,
    httpStatusCode: Int? = nil,
    userId: String? = nil,
    userEmail: String? = nil,
    organizationName: String? = nil
  ) {
    self.status = status
    self.message = message
    self.httpStatusCode = httpStatusCode
    self.userId = userId
    self.userEmail = userEmail
    self.organizationName = organizationName
  }

  public var isReady: Bool {
    status == .ready
  }
}

public protocol TelemetryDeckPATValidating: Sendable {
  func validate(personalAccessToken: String) async -> TelemetryDeckPATValidationResult
}

public final class URLSessionTelemetryDeckPATValidator: TelemetryDeckPATValidating,
  @unchecked Sendable
{
  public init() {}

  public func validate(personalAccessToken: String) async -> TelemetryDeckPATValidationResult {
    let trimmed = personalAccessToken.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      return TelemetryDeckPATValidationResult(
        status: .invalidToken,
        message: "Enter a TelemetryDeck Personal Access Token before checking the connection.")
    }
    guard let url = URL(string: "https://api.telemetrydeckapi.com/api/v3/users/info") else {
      return TelemetryDeckPATValidationResult(
        status: .serviceUnavailable, message: "TelemetryDeck user-info endpoint is unavailable.")
    }
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.timeoutInterval = 15
    request.setValue("Bearer \(trimmed)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse else {
        return TelemetryDeckPATValidationResult(
          status: .networkError, message: "TelemetryDeck returned an unexpected response.")
      }
      switch http.statusCode {
      case 200..<300:
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
          return TelemetryDeckPATValidationResult(
            status: .providerFormatError,
            message: "TelemetryDeck accepted the token but returned unreadable user-info JSON.",
            httpStatusCode: http.statusCode
          )
        }
        let organization = json["organization"] as? [String: Any]
        let firstName = (json["firstName"] as? String)?.trimmingCharacters(
          in: .whitespacesAndNewlines)
        let lastName = (json["lastName"] as? String)?.trimmingCharacters(
          in: .whitespacesAndNewlines)
        let nameParts = [firstName, lastName].compactMap { $0?.providerConnectionNilIfEmpty }
        let email = (json["email"] as? String)?.providerConnectionNilIfEmpty
        let organizationName = (organization?["name"] as? String)?.providerConnectionNilIfEmpty
        let identity = nameParts.isEmpty ? email : nameParts.joined(separator: " ")
        let suffix = organizationName.map { " for \($0)" } ?? ""
        let identityText = identity.map { " as \($0)" } ?? ""
        return TelemetryDeckPATValidationResult(
          status: .ready,
          message: "TelemetryDeck Personal Access Token verified\(identityText)\(suffix).",
          httpStatusCode: http.statusCode,
          userId: (json["id"] as? String)?.providerConnectionNilIfEmpty,
          userEmail: email,
          organizationName: organizationName
        )
      case 401:
        return TelemetryDeckPATValidationResult(
          status: .invalidToken, message: "TelemetryDeck rejected this Personal Access Token.",
          httpStatusCode: http.statusCode)
      case 402:
        return TelemetryDeckPATValidationResult(
          status: .paidPlanRequired,
          message: "TelemetryDeck API access requires a paid plan for Personal Access Tokens.",
          httpStatusCode: http.statusCode)
      case 403:
        return TelemetryDeckPATValidationResult(
          status: .forbidden,
          message: "TelemetryDeck accepted the token format but denied user-info access.",
          httpStatusCode: http.statusCode)
      case 429:
        return TelemetryDeckPATValidationResult(
          status: .rateLimited,
          message: "TelemetryDeck rate-limited the connection check. Try again shortly.",
          httpStatusCode: http.statusCode)
      default:
        return TelemetryDeckPATValidationResult(
          status: .serviceUnavailable,
          message: "TelemetryDeck returned HTTP \(http.statusCode) during the connection check.",
          httpStatusCode: http.statusCode)
      }
    } catch {
      if (error as? URLError)?.code == .timedOut {
        return TelemetryDeckPATValidationResult(
          status: .networkError,
          message: "TelemetryDeck connection check timed out after 15 seconds.")
      }
      return TelemetryDeckPATValidationResult(
        status: .networkError,
        message: "Could not reach TelemetryDeck: \(error.localizedDescription)")
    }
  }
}

public enum SentryTokenValidationStatus: String, Sendable {
  case ready
  case invalidToken = "invalid_token"
  case missingSecret = "missing_secret"
  case secretUnavailable = "secret_unavailable"
  case missingOrganization = "missing_organization"
  case insufficientScope = "insufficient_scope"
  case invalidBaseURL = "invalid_base_url"
  case rateLimited = "rate_limited"
  case serviceUnavailable = "service_unavailable"
  case providerFormatError = "provider_format_error"
  case networkError = "network_error"
}

public struct SentryTokenValidationResult: Sendable, Equatable {
  public var status: SentryTokenValidationStatus
  public var message: String
  public var httpStatusCode: Int?
  public var organizationSlug: String?
  public var organizationName: String?
  public var projectCount: Int
  public var baseURL: String?

  public init(
    status: SentryTokenValidationStatus,
    message: String,
    httpStatusCode: Int? = nil,
    organizationSlug: String? = nil,
    organizationName: String? = nil,
    projectCount: Int = 0,
    baseURL: String? = nil
  ) {
    self.status = status
    self.message = message
    self.httpStatusCode = httpStatusCode
    self.organizationSlug = organizationSlug
    self.organizationName = organizationName
    self.projectCount = projectCount
    self.baseURL = baseURL
  }

  public var isReady: Bool {
    status == .ready
  }
}

public protocol SentryTokenValidating: Sendable {
  func validate(authToken: String, organizationSlug: String, baseURL: String?) async
    -> SentryTokenValidationResult
}

public final class URLSessionSentryTokenValidator: SentryTokenValidating, @unchecked Sendable {
  public init() {}

  public func validate(authToken: String, organizationSlug: String, baseURL: String?) async
    -> SentryTokenValidationResult
  {
    let trimmedToken = authToken.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedOrganization = organizationSlug.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedToken.isEmpty else {
      return SentryTokenValidationResult(
        status: .invalidToken, message: "Enter a Sentry auth token before checking the connection.")
    }
    guard !trimmedOrganization.isEmpty else {
      return SentryTokenValidationResult(
        status: .missingOrganization,
        message: "Enter a Sentry organization slug or id before checking the connection.")
    }
    guard let resolvedBaseURL = Self.normalizedBaseURL(baseURL) else {
      return SentryTokenValidationResult(
        status: .invalidBaseURL,
        message: "Enter an HTTPS Sentry base URL, or leave it blank for https://sentry.io.")
    }
    let url =
      resolvedBaseURL
      .appendingPathComponent("api")
      .appendingPathComponent("0")
      .appendingPathComponent("organizations")
      .appendingPathComponent(trimmedOrganization)
      .appendingPathComponent("projects")
    guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
      return SentryTokenValidationResult(
        status: .serviceUnavailable, message: "Sentry health-check URL could not be built.")
    }
    components.queryItems = [
      URLQueryItem(name: "per_page", value: "1")
    ]
    guard let healthURL = components.url else {
      return SentryTokenValidationResult(
        status: .serviceUnavailable, message: "Sentry health-check URL could not be built.")
    }
    var request = URLRequest(url: healthURL)
    request.httpMethod = "GET"
    request.timeoutInterval = 15
    request.setValue("Bearer \(trimmedToken)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse else {
        return SentryTokenValidationResult(
          status: .networkError, message: "Sentry returned an unexpected response.")
      }
      switch http.statusCode {
      case 200..<300:
        let projectCount = Self.projectCount(from: data)
        return SentryTokenValidationResult(
          status: .ready,
          message: "Sentry auth token verified with a bounded organization projects request.",
          httpStatusCode: http.statusCode,
          organizationSlug: trimmedOrganization,
          organizationName: trimmedOrganization,
          projectCount: projectCount,
          baseURL: resolvedBaseURL.absoluteString
        )
      case 401:
        return SentryTokenValidationResult(
          status: .invalidToken,
          message:
            "Sentry rejected this auth token. Create or paste a current user-owned Sentry auth token.",
          httpStatusCode: http.statusCode,
          organizationSlug: trimmedOrganization,
          baseURL: resolvedBaseURL.absoluteString
        )
      case 403:
        return SentryTokenValidationResult(
          status: .insufficientScope,
          message:
            "Sentry accepted the token but denied organization/project access. Confirm org:read and project:read scopes and organization membership.",
          httpStatusCode: http.statusCode,
          organizationSlug: trimmedOrganization,
          baseURL: resolvedBaseURL.absoluteString
        )
      case 404:
        return SentryTokenValidationResult(
          status: .missingOrganization,
          message:
            "Sentry could not find or access that organization. Check the organization slug/id and token membership.",
          httpStatusCode: http.statusCode,
          organizationSlug: trimmedOrganization,
          baseURL: resolvedBaseURL.absoluteString
        )
      case 429:
        return SentryTokenValidationResult(
          status: .rateLimited,
          message: "Sentry rate-limited the health check. Try again shortly.",
          httpStatusCode: http.statusCode,
          organizationSlug: trimmedOrganization,
          baseURL: resolvedBaseURL.absoluteString
        )
      default:
        return SentryTokenValidationResult(
          status: .serviceUnavailable,
          message: "Sentry returned HTTP \(http.statusCode) during the health check.",
          httpStatusCode: http.statusCode,
          organizationSlug: trimmedOrganization,
          baseURL: resolvedBaseURL.absoluteString
        )
      }
    } catch {
      if (error as? URLError)?.code == .timedOut {
        return SentryTokenValidationResult(
          status: .networkError, message: "Sentry health check timed out after 15 seconds.",
          organizationSlug: trimmedOrganization, baseURL: resolvedBaseURL.absoluteString)
      }
      return SentryTokenValidationResult(
        status: .networkError, message: "Could not reach Sentry: \(error.localizedDescription)",
        organizationSlug: trimmedOrganization, baseURL: resolvedBaseURL.absoluteString)
    }
  }

  private static func normalizedBaseURL(_ raw: String?) -> URL? {
    let trimmed =
      raw?.trimmingCharacters(in: .whitespacesAndNewlines).providerConnectionNilIfEmpty
      ?? "https://sentry.io"
    guard var components = URLComponents(string: trimmed) else { return nil }
    if components.scheme == nil {
      components.scheme = "https"
    }
    guard components.scheme?.lowercased() == "https",
      components.host?.providerConnectionNilIfEmpty != nil,
      components.user == nil,
      components.password == nil
    else {
      return nil
    }
    components.path = ""
    components.query = nil
    components.fragment = nil
    return components.url
  }

  private static func projectCount(from data: Data) -> Int {
    guard !data.isEmpty,
      let json = try? JSONSerialization.jsonObject(with: data)
    else {
      return 0
    }
    if let projects = json as? [Any] {
      return projects.count
    }
    if let object = json as? [String: Any],
      let projects = object["data"] as? [Any]
    {
      return projects.count
    }
    return 0
  }
}

public enum GoogleOAuthCredentialValidationStatus: String, Sendable {
  case ready
  case missingSecret = "missing_secret"
  case secretUnavailable = "secret_unavailable"
  case invalidCredentials = "invalid_credentials"
  case missingScope = "missing_scope"
  case noProperties = "no_properties"
  case selectedPropertyUnavailable = "selected_property_unavailable"
  case rateLimited = "rate_limited"
  case serviceUnavailable = "service_unavailable"
  case networkError = "network_error"
}

public struct GoogleOAuthCredentialValidationResult: Sendable, Equatable {
  public var status: GoogleOAuthCredentialValidationStatus
  public var message: String
  public var unavailableFields: [String]
  public var grantedScopes: [String]
  public var missingScopes: [String]
  public var httpStatusCode: Int?
  public var accessibleResourceCount: Int?
  public var selectedResourceId: String?

  public init(
    status: GoogleOAuthCredentialValidationStatus,
    message: String,
    unavailableFields: [String] = [],
    grantedScopes: [String] = [],
    missingScopes: [String] = [],
    httpStatusCode: Int? = nil,
    accessibleResourceCount: Int? = nil,
    selectedResourceId: String? = nil
  ) {
    self.status = status
    self.message = message
    self.unavailableFields = unavailableFields
    self.grantedScopes = grantedScopes
    self.missingScopes = missingScopes
    self.httpStatusCode = httpStatusCode
    self.accessibleResourceCount = accessibleResourceCount
    self.selectedResourceId = selectedResourceId
  }

  public var isReady: Bool {
    status == .ready
  }
}

public protocol GoogleOAuthCredentialValidating: Sendable {
  func validateCalendarCredentials(
    clientId: String,
    clientSecret: String,
    refreshToken: String,
    requiredScopes: [String]
  ) async -> GoogleOAuthCredentialValidationResult

  func validateDocsCredentials(
    clientId: String,
    clientSecret: String,
    refreshToken: String,
    requiredScopes: [String]
  ) async -> GoogleOAuthCredentialValidationResult

  func validateSearchConsoleCredentials(
    clientId: String,
    clientSecret: String,
    refreshToken: String,
    selectedSiteUrl: String?,
    requiredScopes: [String]
  ) async -> GoogleOAuthCredentialValidationResult
}

public final class URLSessionGoogleOAuthCredentialValidator: GoogleOAuthCredentialValidating,
  @unchecked Sendable
{
  public init() {}

  public func validateCalendarCredentials(
    clientId: String,
    clientSecret: String,
    refreshToken: String,
    requiredScopes: [String]
  ) async -> GoogleOAuthCredentialValidationResult {
    let trimmedClientId = clientId.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedClientSecret = clientSecret.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedRefreshToken = refreshToken.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedClientId.isEmpty, !trimmedClientSecret.isEmpty, !trimmedRefreshToken.isEmpty
    else {
      return GoogleOAuthCredentialValidationResult(
        status: .invalidCredentials,
        message:
          "Enter the Google OAuth client ID, client secret, and refresh token before testing Google Calendar.",
        missingScopes: requiredScopes
      )
    }
    let token = await refreshAccessToken(
      providerName: "Google Calendar",
      clientId: trimmedClientId,
      clientSecret: trimmedClientSecret,
      refreshToken: trimmedRefreshToken,
      requiredScopes: requiredScopes
    )
    guard token.result.isReady, let accessToken = token.accessToken?.providerConnectionNilIfEmpty
    else {
      return token.result
    }
    let grantedScopes = token.result.grantedScopes
    let missingScopes = Self.missingScopes(
      requiredScopes: requiredScopes, grantedScopes: grantedScopes)
    if !missingScopes.isEmpty {
      return GoogleOAuthCredentialValidationResult(
        status: .missingScope,
        message:
          "Google Calendar OAuth grant is missing required scope(s): \(missingScopes.joined(separator: ", ")). Reconnect with the full Calendar scope set.",
        grantedScopes: grantedScopes,
        missingScopes: missingScopes,
        httpStatusCode: token.result.httpStatusCode
      )
    }
    return await validateCalendarListAccess(
      accessToken: accessToken,
      grantedScopes: grantedScopes,
      requiredScopes: requiredScopes
    )
  }

  public func validateDocsCredentials(
    clientId: String,
    clientSecret: String,
    refreshToken: String,
    requiredScopes: [String]
  ) async -> GoogleOAuthCredentialValidationResult {
    let trimmedClientId = clientId.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedClientSecret = clientSecret.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedRefreshToken = refreshToken.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedClientId.isEmpty, !trimmedClientSecret.isEmpty, !trimmedRefreshToken.isEmpty
    else {
      return GoogleOAuthCredentialValidationResult(
        status: .invalidCredentials,
        message:
          "Enter the Google OAuth client ID, client secret, and refresh token before testing Google Docs.",
        missingScopes: requiredScopes
      )
    }
    let token = await refreshAccessToken(
      providerName: "Google Docs",
      clientId: trimmedClientId,
      clientSecret: trimmedClientSecret,
      refreshToken: trimmedRefreshToken,
      requiredScopes: requiredScopes
    )
    guard token.result.isReady else {
      return token.result
    }
    let grantedScopes = token.result.grantedScopes
    let missingScopes = Self.missingScopes(
      requiredScopes: requiredScopes, grantedScopes: grantedScopes)
    if !missingScopes.isEmpty {
      return GoogleOAuthCredentialValidationResult(
        status: .missingScope,
        message:
          "Google Docs OAuth grant is missing required scope(s): \(missingScopes.joined(separator: ", ")). Reconnect with the full Docs scope set.",
        grantedScopes: grantedScopes,
        missingScopes: missingScopes,
        httpStatusCode: token.result.httpStatusCode
      )
    }
    return GoogleOAuthCredentialValidationResult(
      status: .ready,
      message:
        "Google Docs OAuth credentials verified with a bounded OAuth refresh and Docs scope check.",
      grantedScopes: grantedScopes,
      httpStatusCode: token.result.httpStatusCode
    )
  }

  public func validateSearchConsoleCredentials(
    clientId: String,
    clientSecret: String,
    refreshToken: String,
    selectedSiteUrl: String?,
    requiredScopes: [String]
  ) async -> GoogleOAuthCredentialValidationResult {
    let trimmedClientId = clientId.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedClientSecret = clientSecret.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedRefreshToken = refreshToken.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedSelectedSiteUrl = selectedSiteUrl?.providerConnectionNilIfEmpty
    guard !trimmedClientId.isEmpty, !trimmedClientSecret.isEmpty, !trimmedRefreshToken.isEmpty
    else {
      return GoogleOAuthCredentialValidationResult(
        status: .invalidCredentials,
        message:
          "Enter the Google OAuth client ID, client secret, and refresh token before testing Google Search Console.",
        missingScopes: requiredScopes,
        selectedResourceId: trimmedSelectedSiteUrl
      )
    }
    let token = await refreshAccessToken(
      providerName: "Google Search Console",
      clientId: trimmedClientId,
      clientSecret: trimmedClientSecret,
      refreshToken: trimmedRefreshToken,
      requiredScopes: requiredScopes
    )
    guard token.result.isReady, let accessToken = token.accessToken?.providerConnectionNilIfEmpty
    else {
      return token.result
    }
    let grantedScopes = token.result.grantedScopes
    let missingScopes = Self.missingScopes(
      requiredScopes: requiredScopes, grantedScopes: grantedScopes)
    if !missingScopes.isEmpty {
      return GoogleOAuthCredentialValidationResult(
        status: .missingScope,
        message:
          "Google Search Console OAuth grant is missing required scope(s): \(missingScopes.joined(separator: ", ")). Reconnect with webmasters.readonly.",
        grantedScopes: grantedScopes,
        missingScopes: missingScopes,
        httpStatusCode: token.result.httpStatusCode,
        selectedResourceId: trimmedSelectedSiteUrl
      )
    }
    return await validateSearchConsoleSitesAccess(
      accessToken: accessToken,
      selectedSiteUrl: trimmedSelectedSiteUrl,
      grantedScopes: grantedScopes,
      requiredScopes: requiredScopes
    )
  }

  private struct AccessTokenResult: Sendable {
    var result: GoogleOAuthCredentialValidationResult
    var accessToken: String?
  }

  private func refreshAccessToken(
    providerName: String,
    clientId: String,
    clientSecret: String,
    refreshToken: String,
    requiredScopes: [String]
  ) async -> AccessTokenResult {
    guard let url = URL(string: "https://oauth2.googleapis.com/token") else {
      return AccessTokenResult(
        result: GoogleOAuthCredentialValidationResult(
          status: .serviceUnavailable,
          message: "Google OAuth token endpoint is unavailable.",
          missingScopes: requiredScopes
        ),
        accessToken: nil
      )
    }
    let bodyFields = [
      ("client_id", clientId),
      ("client_secret", clientSecret),
      ("refresh_token", refreshToken),
      ("grant_type", "refresh_token"),
    ]
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.timeoutInterval = 15
    request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.httpBody = Data(
      bodyFields.map { "\($0.0)=\(Self.formEncode($0.1))" }.joined(separator: "&").utf8)
    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse else {
        return AccessTokenResult(
          result: GoogleOAuthCredentialValidationResult(
            status: .networkError,
            message: "Google OAuth returned an unexpected response.",
            missingScopes: requiredScopes
          ),
          accessToken: nil
        )
      }
      let record = Self.parseJSONBody(data)
      switch http.statusCode {
      case 200..<300:
        guard let accessToken = record["access_token"]?.string?.providerConnectionNilIfEmpty else {
          return AccessTokenResult(
            result: GoogleOAuthCredentialValidationResult(
              status: .serviceUnavailable,
              message: "Google OAuth refreshed the token but did not return an access token.",
              missingScopes: requiredScopes,
              httpStatusCode: http.statusCode
            ),
            accessToken: nil
          )
        }
        let grantedScopes = Self.scopes(from: record["scope"]?.string)
        return AccessTokenResult(
          result: GoogleOAuthCredentialValidationResult(
            status: .ready,
            message: "Google OAuth refresh token exchanged successfully.",
            grantedScopes: grantedScopes,
            httpStatusCode: http.statusCode
          ),
          accessToken: accessToken
        )
      case 400, 401:
        let code = Self.googleErrorCode(record) ?? "invalid_grant"
        return AccessTokenResult(
          result: GoogleOAuthCredentialValidationResult(
            status: .invalidCredentials,
            message:
              "Google rejected the OAuth credentials (\(code)). Reconnect \(providerName) with current user-owned credentials.",
            missingScopes: requiredScopes,
            httpStatusCode: http.statusCode
          ),
          accessToken: nil
        )
      case 403:
        return AccessTokenResult(
          result: GoogleOAuthCredentialValidationResult(
            status: .missingScope,
            message:
              "Google rejected the \(providerName) OAuth token exchange for insufficient permission. Reconnect with the required scopes.",
            missingScopes: requiredScopes,
            httpStatusCode: http.statusCode
          ),
          accessToken: nil
        )
      case 429:
        return AccessTokenResult(
          result: GoogleOAuthCredentialValidationResult(
            status: .rateLimited,
            message:
              "Google rate-limited the \(providerName) OAuth health check. Try again shortly.",
            missingScopes: requiredScopes,
            httpStatusCode: http.statusCode
          ),
          accessToken: nil
        )
      default:
        return AccessTokenResult(
          result: GoogleOAuthCredentialValidationResult(
            status: .serviceUnavailable,
            message:
              "Google OAuth returned HTTP \(http.statusCode) during \(providerName) health check.",
            missingScopes: requiredScopes,
            httpStatusCode: http.statusCode
          ),
          accessToken: nil
        )
      }
    } catch {
      return AccessTokenResult(
        result: GoogleOAuthCredentialValidationResult(
          status: .networkError,
          message: "Could not reach Google OAuth: \(error.localizedDescription)",
          missingScopes: requiredScopes
        ),
        accessToken: nil
      )
    }
  }

  private func validateCalendarListAccess(
    accessToken: String,
    grantedScopes: [String],
    requiredScopes: [String]
  ) async -> GoogleOAuthCredentialValidationResult {
    guard
      var components = URLComponents(
        string: "https://www.googleapis.com/calendar/v3/users/me/calendarList")
    else {
      return GoogleOAuthCredentialValidationResult(
        status: .serviceUnavailable,
        message: "Google Calendar calendarList endpoint is unavailable.",
        grantedScopes: grantedScopes,
        missingScopes: requiredScopes
      )
    }
    components.queryItems = [
      URLQueryItem(name: "maxResults", value: "1"),
      URLQueryItem(name: "minAccessRole", value: "reader"),
    ]
    guard let url = components.url else {
      return GoogleOAuthCredentialValidationResult(
        status: .serviceUnavailable,
        message: "Google Calendar health-check URL could not be built.",
        grantedScopes: grantedScopes,
        missingScopes: requiredScopes
      )
    }
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.timeoutInterval = 15
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse else {
        return GoogleOAuthCredentialValidationResult(
          status: .networkError,
          message: "Google Calendar returned an unexpected response.",
          grantedScopes: grantedScopes,
          missingScopes: requiredScopes
        )
      }
      let record = Self.parseJSONBody(data)
      switch http.statusCode {
      case 200..<300:
        return GoogleOAuthCredentialValidationResult(
          status: .ready,
          message:
            "Google Calendar OAuth credentials verified with a bounded calendar list health check.",
          grantedScopes: grantedScopes,
          httpStatusCode: http.statusCode
        )
      case 401:
        return GoogleOAuthCredentialValidationResult(
          status: .invalidCredentials,
          message:
            "Google Calendar rejected the refreshed access token. Reconnect Google Calendar.",
          grantedScopes: grantedScopes,
          missingScopes: requiredScopes,
          httpStatusCode: http.statusCode
        )
      case 403:
        let reason = Self.googleErrorReason(record)?.lowercased()
        if reason == "insufficientpermissions" || reason == "insufficientpermission" {
          return GoogleOAuthCredentialValidationResult(
            status: .missingScope,
            message:
              "Google Calendar OAuth grant is missing required Calendar API permission. Reconnect with the full Calendar scope set.",
            grantedScopes: grantedScopes,
            missingScopes: requiredScopes,
            httpStatusCode: http.statusCode
          )
        }
        if reason == "ratelimitexceeded" || reason == "userratelimitexceeded"
          || reason == "quotaexceeded"
        {
          return GoogleOAuthCredentialValidationResult(
            status: .rateLimited,
            message: "Google Calendar rate-limited the health check. Try again shortly.",
            grantedScopes: grantedScopes,
            httpStatusCode: http.statusCode
          )
        }
        return GoogleOAuthCredentialValidationResult(
          status: .serviceUnavailable,
          message:
            "Google Calendar returned HTTP 403 during health check. Confirm Calendar API access and Workspace policy.",
          grantedScopes: grantedScopes,
          missingScopes: requiredScopes,
          httpStatusCode: http.statusCode
        )
      case 429:
        return GoogleOAuthCredentialValidationResult(
          status: .rateLimited,
          message: "Google Calendar rate-limited the health check. Try again shortly.",
          grantedScopes: grantedScopes,
          httpStatusCode: http.statusCode
        )
      default:
        return GoogleOAuthCredentialValidationResult(
          status: .serviceUnavailable,
          message: "Google Calendar returned HTTP \(http.statusCode) during health check.",
          grantedScopes: grantedScopes,
          missingScopes: requiredScopes,
          httpStatusCode: http.statusCode
        )
      }
    } catch {
      return GoogleOAuthCredentialValidationResult(
        status: .networkError,
        message: "Could not reach Google Calendar: \(error.localizedDescription)",
        grantedScopes: grantedScopes,
        missingScopes: requiredScopes
      )
    }
  }

  private func validateSearchConsoleSitesAccess(
    accessToken: String,
    selectedSiteUrl: String?,
    grantedScopes: [String],
    requiredScopes: [String]
  ) async -> GoogleOAuthCredentialValidationResult {
    guard let url = URL(string: "https://www.googleapis.com/webmasters/v3/sites") else {
      return GoogleOAuthCredentialValidationResult(
        status: .serviceUnavailable,
        message: "Google Search Console sites endpoint is unavailable.",
        grantedScopes: grantedScopes,
        missingScopes: requiredScopes,
        selectedResourceId: selectedSiteUrl
      )
    }
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.timeoutInterval = 15
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse else {
        return GoogleOAuthCredentialValidationResult(
          status: .networkError,
          message: "Google Search Console returned an unexpected response.",
          grantedScopes: grantedScopes,
          missingScopes: requiredScopes,
          selectedResourceId: selectedSiteUrl
        )
      }
      let record = Self.parseJSONBody(data)
      switch http.statusCode {
      case 200..<300:
        let siteUrls = Self.searchConsoleSiteUrls(from: record)
        guard !siteUrls.isEmpty else {
          return GoogleOAuthCredentialValidationResult(
            status: .noProperties,
            message:
              "Google Search Console credentials are valid, but this account has no accessible Search Console properties.",
            grantedScopes: grantedScopes,
            httpStatusCode: http.statusCode,
            accessibleResourceCount: 0,
            selectedResourceId: selectedSiteUrl
          )
        }
        guard let selectedSiteUrl else {
          return GoogleOAuthCredentialValidationResult(
            status: .selectedPropertyUnavailable,
            message: "Choose a Search Console property before assigning agents.",
            grantedScopes: grantedScopes,
            httpStatusCode: http.statusCode,
            accessibleResourceCount: siteUrls.count
          )
        }
        guard siteUrls.contains(selectedSiteUrl) else {
          return GoogleOAuthCredentialValidationResult(
            status: .selectedPropertyUnavailable,
            message:
              "The selected Search Console property is not accessible to this Google account. Choose another property or reconnect with the right account.",
            grantedScopes: grantedScopes,
            httpStatusCode: http.statusCode,
            accessibleResourceCount: siteUrls.count,
            selectedResourceId: selectedSiteUrl
          )
        }
        return GoogleOAuthCredentialValidationResult(
          status: .ready,
          message:
            "Google Search Console OAuth credentials verified with a bounded sites.list health check.",
          grantedScopes: grantedScopes,
          httpStatusCode: http.statusCode,
          accessibleResourceCount: siteUrls.count,
          selectedResourceId: selectedSiteUrl
        )
      case 401:
        return GoogleOAuthCredentialValidationResult(
          status: .invalidCredentials,
          message:
            "Google Search Console rejected the refreshed access token. Reconnect Google Search Console.",
          grantedScopes: grantedScopes,
          missingScopes: requiredScopes,
          httpStatusCode: http.statusCode,
          selectedResourceId: selectedSiteUrl
        )
      case 403:
        let reason = Self.googleErrorReason(record)?.lowercased()
        if reason == "insufficientpermissions" || reason == "insufficientpermission" {
          return GoogleOAuthCredentialValidationResult(
            status: .missingScope,
            message:
              "Google Search Console OAuth grant is missing webmasters.readonly. Reconnect with the read-only Search Console scope.",
            grantedScopes: grantedScopes,
            missingScopes: requiredScopes,
            httpStatusCode: http.statusCode,
            selectedResourceId: selectedSiteUrl
          )
        }
        if reason == "ratelimitexceeded" || reason == "userratelimitexceeded"
          || reason == "quotaexceeded"
        {
          return GoogleOAuthCredentialValidationResult(
            status: .rateLimited,
            message: "Google Search Console rate-limited the health check. Try again shortly.",
            grantedScopes: grantedScopes,
            httpStatusCode: http.statusCode,
            selectedResourceId: selectedSiteUrl
          )
        }
        return GoogleOAuthCredentialValidationResult(
          status: .serviceUnavailable,
          message:
            "Google Search Console returned HTTP 403 during health check. Confirm Search Console API access and property permissions.",
          grantedScopes: grantedScopes,
          missingScopes: requiredScopes,
          httpStatusCode: http.statusCode,
          selectedResourceId: selectedSiteUrl
        )
      case 429:
        return GoogleOAuthCredentialValidationResult(
          status: .rateLimited,
          message: "Google Search Console rate-limited the health check. Try again shortly.",
          grantedScopes: grantedScopes,
          httpStatusCode: http.statusCode,
          selectedResourceId: selectedSiteUrl
        )
      default:
        return GoogleOAuthCredentialValidationResult(
          status: .serviceUnavailable,
          message: "Google Search Console returned HTTP \(http.statusCode) during health check.",
          grantedScopes: grantedScopes,
          missingScopes: requiredScopes,
          httpStatusCode: http.statusCode,
          selectedResourceId: selectedSiteUrl
        )
      }
    } catch {
      return GoogleOAuthCredentialValidationResult(
        status: .networkError,
        message: "Could not reach Google Search Console: \(error.localizedDescription)",
        grantedScopes: grantedScopes,
        missingScopes: requiredScopes,
        selectedResourceId: selectedSiteUrl
      )
    }
  }

  private static func parseJSONBody(_ body: Data) -> JSONRecord {
    guard !body.isEmpty,
      let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any]
    else {
      return [:]
    }
    return jsonRecord(from: json)
  }

  private static func scopes(from raw: String?) -> [String] {
    guard let raw else { return [] }
    return
      raw
      .split { $0 == " " || $0 == "," || $0 == "\n" || $0 == "\t" }
      .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
  }

  private static func searchConsoleSiteUrls(from record: JSONRecord) -> [String] {
    guard case .array(let entries)? = record["siteEntry"] else {
      return []
    }
    return entries.compactMap { value in
      guard case .object(let object) = value else { return nil }
      return object["siteUrl"]?.string?.providerConnectionNilIfEmpty
    }
  }

  private static func missingScopes(requiredScopes: [String], grantedScopes: [String]) -> [String] {
    guard !grantedScopes.isEmpty else { return [] }
    let granted = Set(grantedScopes.map { $0.lowercased() })
    return requiredScopes.filter { !granted.contains($0.lowercased()) }
  }

  private static func googleErrorCode(_ record: JSONRecord) -> String? {
    if let value = record["error"]?.string?.providerConnectionNilIfEmpty {
      return value
    }
    if case .object(let error)? = record["error"] {
      return error["status"]?.string?.providerConnectionNilIfEmpty
        ?? error["code"]?.string?.providerConnectionNilIfEmpty
        ?? error["message"]?.string?.providerConnectionNilIfEmpty
    }
    return nil
  }

  private static func googleErrorReason(_ record: JSONRecord) -> String? {
    if case .object(let error)? = record["error"] {
      if case .array(let errors)? = error["errors"] {
        for entry in errors {
          if case .object(let item) = entry,
            let reason = item["reason"]?.string?.providerConnectionNilIfEmpty
          {
            return reason
          }
        }
      }
      return error["status"]?.string?.providerConnectionNilIfEmpty
        ?? error["code"]?.string?.providerConnectionNilIfEmpty
        ?? error["message"]?.string?.providerConnectionNilIfEmpty
    }
    return googleErrorCode(record)
  }

  private static func formEncode(_ value: String) -> String {
    var allowed = CharacterSet.urlQueryAllowed
    allowed.remove(charactersIn: "&+=?")
    return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
  }
}
