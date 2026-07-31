import Foundation

extension ProviderConnectionService {
  static func isSafeMicrosoftTenantId(_ value: String) -> Bool {
    value.count <= 128
      && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" || $0 == "." }
  }

  static func isSafeYouTubeResourceId(_ value: String) -> Bool {
    !value.isEmpty && value.count <= 128
      && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }
  }

  static func isSafeMerchantCenterAccountName(_ value: String) -> Bool {
    guard value.hasPrefix("accounts/") else { return false }
    let id = value.dropFirst("accounts/".count)
    return !id.isEmpty && id.count <= 32 && id.allSatisfy(\.isNumber)
  }

  static func isSafeSearchConsoleSiteURL(_ value: String) -> Bool {
    if value.hasPrefix("sc-domain:") {
      let domain = String(value.dropFirst(10))
      return !domain.isEmpty && domain.count <= 253 && !domain.contains("/")
        && !domain.contains("@") && domain.contains(".")
    }
    guard value.count <= 2048, let url = URL(string: value),
      ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
      url.host?.providerConnectionNilIfEmpty != nil,
      url.user == nil, url.password == nil, url.fragment == nil
    else { return false }
    return true
  }

  static func isGoogleAdsCustomerId(_ value: String) -> Bool {
    value.count == 10 && value.allSatisfy(\.isNumber)
  }

  static func isSafeWrikeOpaqueId(_ value: String) -> Bool {
    !value.isEmpty && value.count <= 128
      && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }
  }
  static func safeWrikeAPIOrigin(_ value: String) -> URL? {
    let raw = value.contains("://") ? value : "https://" + value
    guard var components = URLComponents(string: raw), components.scheme?.lowercased() == "https",
      let host = components.host?.lowercased(), host == "wrike.com" || host.hasSuffix(".wrike.com"),
      components.user == nil, components.password == nil, components.port == nil,
      components.query == nil, components.fragment == nil,
      components.path.isEmpty || components.path == "/"
    else { return nil }
    components.scheme = "https"
    components.host = host
    components.path = "/api/v4"
    return components.url
  }

  static func isSafeSmartsheetNumericId(_ value: String) -> Bool {
    !value.isEmpty && value.first != "0" && value.count <= 20 && value.allSatisfy(\.isNumber)
  }
  static func isSafeTodoistUserId(_ value: String) -> Bool {
    !value.isEmpty && value.first != "0" && value.count <= 20 && value.allSatisfy(\.isNumber)
  }
  static func isSafeHarvestNumericId(_ value: String) -> Bool {
    !value.isEmpty && value.first != "0" && value.count <= 20 && value.allSatisfy(\.isNumber)
  }
  static func isSafeCalendlyResourceUri(_ value: String, resource: String) -> Bool {
    let prefix = "https://api.calendly.com/" + resource + "/"
    guard value.hasPrefix(prefix) else { return false }
    let identifier = String(value.dropFirst(prefix.count))
    return !identifier.isEmpty && identifier.count <= 64
      && identifier.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
  }
  static func isSafeCalComNumericId(_ value: String) -> Bool {
    !value.isEmpty && value.first != "0" && value.count <= 20 && value.allSatisfy(\.isNumber)
  }
  static func isSafeCalComHandle(_ value: String) -> Bool {
    !value.isEmpty && value.count <= 128
      && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" || $0 == "." }
  }
  static func isSafeDocusignIdentifier(_ value: String) -> Bool {
    !value.isEmpty && value.count <= 64 && value.allSatisfy { $0.isHexDigit || $0 == "-" }
  }
  static func isSafeDocusignBaseURI(_ value: String) -> Bool {
    guard let components = URLComponents(string: value), components.scheme == "https",
      components.user == nil, components.password == nil, components.port == nil,
      components.path.isEmpty || components.path == "/", components.query == nil,
      components.fragment == nil, let host = components.host?.lowercased()
    else { return false }
    let labels = host.split(separator: ".")
    return labels.count == 3 && labels[1] == "docusign" && labels[2] == "net"
      && labels[0].allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" }
  }
  static func isSafeDropboxSignIdentifier(_ value: String) -> Bool {
    value.count >= 24 && value.count <= 64 && value.allSatisfy(\.isHexDigit)
  }
  static func isSafeDropboxSignLocale(_ value: String) -> Bool {
    value.count >= 2 && value.count <= 16
      && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
  }
  static func isSafePandaDocIdentifier(_ value: String) -> Bool {
    !value.isEmpty && value.count <= 64
      && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
  }
  static let typeformAPIOrigins: Set<String> = [
    "https://api.typeform.com", "https://api.eu.typeform.com", "https://api.typeform.eu",
  ]
  static func isSafeTypeformIdentifier(_ value: String) -> Bool {
    !value.isEmpty && value.count <= 64
      && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
  }
  static let surveyMonkeyAccessURLs: Set<String> = [
    "https://api.surveymonkey.com", "https://api.eu.surveymonkey.com",
    "https://api.surveymonkey.ca",
  ]
  static func isSafeSurveyMonkeyIdentifier(_ value: String) -> Bool {
    !value.isEmpty && value.count <= 32 && value.allSatisfy(\.isNumber)
      && value.contains(where: { $0 != "0" })
  }
  static let filloutAPIBaseURLs: Set<String> = [
    "https://api.fillout.com", "https://eu-api.fillout.com",
  ]
  static func isSafeMailchimpDataCenter(_ value: String) -> Bool {
    !value.isEmpty && value.count <= 20
      && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" }
  }
  static func isSafeMailchimpIdentifier(_ value: String) -> Bool {
    !value.isEmpty && value.count <= 64
      && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
  }
  static func isSafeKlaviyoIdentifier(_ value: String) -> Bool {
    !value.isEmpty && value.count <= 64
      && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
  }
  static func isSafeConvertKitAccountId(_ value: String) -> Bool {
    !value.isEmpty && value.first != "0" && value.count <= 20 && value.allSatisfy(\.isNumber)
  }
  static func isSafeCampaignMonitorId(_ value: String) -> Bool {
    value.count == 32 && value.allSatisfy(\.isHexDigit)
  }
  static func safeSmartsheetAPIOrigin(_ value: String) -> URL? {
    let raw = value.contains("://") ? value : "https://" + value
    let hosts: Set<String> = [
      "api.smartsheet.com", "api.smartsheet.eu", "api.smartsheet.au", "api.smartsheetgov.com",
    ]
    guard var components = URLComponents(string: raw), components.scheme?.lowercased() == "https",
      let host = components.host?.lowercased(), hosts.contains(host), components.user == nil,
      components.password == nil, components.port == nil, components.query == nil,
      components.fragment == nil,
      components.path.isEmpty || components.path == "/" || components.path == "/2.0"
        || components.path == "/2.0/"
    else { return nil }
    components.scheme = "https"
    components.host = host
    components.path = "/2.0"
    return components.url
  }

  static func safeTeamworkAPIOrigin(_ value: String) -> String? {
    guard var components = URLComponents(string: value), components.scheme?.lowercased() == "https",
      let host = components.host?.lowercased(),
      host == "teamwork.com" || host.hasSuffix(".teamwork.com"), components.user == nil,
      components.password == nil, components.port == nil, components.query == nil,
      components.fragment == nil
    else { return nil }
    components.scheme = "https"
    components.host = host
    components.path = ""
    return components.url?.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
  }

  static func notionConnectionStatus(for validation: NotionTokenValidationResult)
    -> ProviderConnectionStatus
  {
    switch validation.status {
    case .ready:
      return .connected
    case .invalidToken, .missingSecret, .secretUnavailable, .restrictedResource:
      return .authRequired
    case .rateLimited, .serviceUnavailable, .networkError:
      return .healthError
    }
  }

  static func telemetryDeckConnectionStatus(
    for validation: TelemetryDeckPATValidationResult
  ) -> ProviderConnectionStatus {
    switch validation.status {
    case .ready:
      return .connected
    case .invalidToken, .missingSecret, .secretUnavailable, .forbidden:
      return .authRequired
    case .paidPlanRequired, .rateLimited, .serviceUnavailable, .providerFormatError, .networkError:
      return .healthError
    }
  }

  static func postHogConnectionStatus(for validation: PostHogTokenValidationResult)
    -> ProviderConnectionStatus
  {
    switch validation.status {
    case .ready:
      return .connected
    case .invalidToken, .forbidden, .projectUnavailable:
      return .authRequired
    case .rateLimited, .serviceUnavailable, .networkError:
      return .healthError
    }
  }

  static func sentryConnectionStatus(for validation: SentryTokenValidationResult)
    -> ProviderConnectionStatus
  {
    switch validation.status {
    case .ready:
      return .connected
    case .invalidToken, .missingSecret, .secretUnavailable, .missingOrganization,
      .insufficientScope, .invalidBaseURL:
      return .authRequired
    case .rateLimited, .serviceUnavailable, .providerFormatError, .networkError:
      return .healthError
    }
  }

  static func googleOAuthConnectionStatus(
    for validation: GoogleOAuthCredentialValidationResult
  ) -> ProviderConnectionStatus {
    switch validation.status {
    case .ready:
      return .connected
    case .missingSecret, .secretUnavailable, .invalidCredentials, .missingScope:
      return .authRequired
    case .noProperties, .selectedPropertyUnavailable, .rateLimited, .serviceUnavailable,
      .networkError:
      return .healthError
    }
  }

  static func microsoftClarityConnectionStatus(
    for validation: MicrosoftClarityTokenValidationResult
  ) -> ProviderConnectionStatus {
    switch validation.status {
    case .ready:
      return .connected
    case .invalidToken, .missingSecret, .secretUnavailable, .unauthorized:
      return .authRequired
    case .invalidRequest, .quotaExceeded, .serviceUnavailable, .providerFormatError, .networkError:
      return .healthError
    }
  }

  static func notionReauthorizeRequired(for validation: NotionTokenValidationResult) -> Bool {
    switch validation.status {
    case .invalidToken, .missingSecret, .secretUnavailable, .restrictedResource:
      return true
    case .ready, .rateLimited, .serviceUnavailable, .networkError:
      return false
    }
  }

  static func postHogReauthorizeRequired(for validation: PostHogTokenValidationResult)
    -> Bool
  {
    switch validation.status {
    case .invalidToken, .forbidden, .projectUnavailable:
      return true
    case .ready, .rateLimited, .serviceUnavailable, .networkError:
      return false
    }
  }

  static func sentryReauthorizeRequired(for validation: SentryTokenValidationResult) -> Bool {
    switch validation.status {
    case .invalidToken, .missingSecret, .secretUnavailable, .missingOrganization,
      .insufficientScope, .invalidBaseURL:
      return true
    case .ready, .rateLimited, .serviceUnavailable, .providerFormatError, .networkError:
      return false
    }
  }

  static func telemetryDeckReauthorizeRequired(
    for validation: TelemetryDeckPATValidationResult
  ) -> Bool {
    switch validation.status {
    case .invalidToken, .missingSecret, .secretUnavailable, .forbidden:
      return true
    case .ready, .paidPlanRequired, .rateLimited, .serviceUnavailable, .providerFormatError,
      .networkError:
      return false
    }
  }

  static func googleOAuthReauthorizeRequired(
    for validation: GoogleOAuthCredentialValidationResult
  ) -> Bool {
    switch validation.status {
    case .missingSecret, .secretUnavailable, .invalidCredentials, .missingScope:
      return true
    case .ready, .noProperties, .selectedPropertyUnavailable, .rateLimited, .serviceUnavailable,
      .networkError:
      return false
    }
  }

  static func microsoftClarityReauthorizeRequired(
    for validation: MicrosoftClarityTokenValidationResult
  ) -> Bool {
    switch validation.status {
    case .invalidToken, .missingSecret, .secretUnavailable, .unauthorized:
      return true
    case .ready, .invalidRequest, .quotaExceeded, .serviceUnavailable, .providerFormatError,
      .networkError:
      return false
    }
  }

  static func normalizedPostHogBaseURLString(_ value: String) throws -> String {
    let trimmed =
      value
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let input =
      trimmed.isEmpty
      ? "https://us.posthog.com"
      : (trimmed.contains("://") ? trimmed : "https://\(trimmed)")
    guard var components = URLComponents(string: input) else {
      throw RelayError(.invalidInput, "Enter a valid PostHog API base URL.")
    }
    if components.scheme == nil {
      components.scheme = "https"
    }
    components.path = ""
    components.query = nil
    components.fragment = nil
    guard components.scheme == "https" || components.scheme == "http",
      components.host?.providerConnectionNilIfEmpty != nil,
      let url = components.url
    else {
      throw RelayError(.invalidInput, "Enter a valid PostHog API base URL.")
    }
    return url.absoluteString
  }

  static func normalizedGoogleAnalyticsPropertyId(_ value: String) throws -> String {
    let trimmed = try requireNonEmptyString(value, field: "GA4 property ID", maxLength: 128)
    if trimmed.lowercased().hasPrefix("properties/") {
      let suffix = String(trimmed.dropFirst("properties/".count))
        .trimmingCharacters(in: .whitespacesAndNewlines)
      return try requireNonEmptyString(suffix, field: "GA4 property ID", maxLength: 80)
    }
    return trimmed
  }

  static func statusRequiresSecretReference(_ status: ProviderConnectionStatus) -> Bool {
    switch status {
    case .connected, .expired, .healthError, .validating, .senderInvalid, .disconnecting,
      .reauthorizeRequired:
      return true
    case .disconnected, .authRequired, .unavailable:
      return false
    }
  }

  static func statusRequiresCatalogConnection(_ status: ProviderConnectionStatus) -> Bool {
    switch status {
    case .connected, .expired, .healthError, .validating, .senderInvalid, .disconnecting,
      .reauthorizeRequired:
      return true
    case .disconnected, .authRequired, .unavailable:
      return false
    }
  }

  static func secretReferenceIds(in connection: MarketplaceProviderConnection) -> [RelayId] {
    var seen = Set<RelayId>()
    return
      (connection.secretReferenceIds
      + connection.credentialRequirements.compactMap(\.secretReferenceId))
      .filter { seen.insert($0).inserted }
  }
}
