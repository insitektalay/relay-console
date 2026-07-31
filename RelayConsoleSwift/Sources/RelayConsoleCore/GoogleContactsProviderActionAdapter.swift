import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct GoogleContactsProviderActionClientResult: Sendable {
  public var result: JSONRecord
  public init(result: JSONRecord) { self.result = result }
}

public protocol GoogleContactsProviderActionClient: Sendable {
  func executeGoogleContactsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleContactsProviderActionClientResult
}

public struct FakeGoogleContactsProviderActionClient: GoogleContactsProviderActionClient {
  public init() {}
  public func executeGoogleContactsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleContactsProviderActionClientResult {
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_contacts_connections_list":
      fields = ["semanticReadContract": .string("google-contacts-connections-v1"), "connections": .array([.object(GoogleContactsProviderActionSupport.fakePerson())])]
    case "google_contacts_contact_get":
      fields = ["semanticReadContract": .string("google-contacts-contact-v1"), "contact": .object(GoogleContactsProviderActionSupport.fakePerson())]
    case "google_contacts_update_prepare":
      fields = ["semanticDraftContract": .string("google-contacts-update-prepare-v1"), "draftPreview": .object(try GoogleContactsProviderActionSupport.validatedPreview(request.payload)), "providerMutation": .bool(false)]
    case "google_contacts_contact_create", "google_contacts_contact_patch":
      fields = ["semanticWriteContract": .string(request.definition.actionKey == "google_contacts_contact_create" ? "google-contacts-create-v1" : "google-contacts-safe-patch-v1"), "providerMutation": .bool(true), "contact": .object(GoogleContactsProviderActionSupport.fakePerson())]
    default:
      throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_action_not_supported", message: "Unsupported Google Contacts action.")
    }
    return GoogleContactsProviderActionClientResult(result: GoogleContactsProviderActionSupport.base("fake-people-api-v1").merging(fields) { _, new in new })
  }
}

public final class LiveGoogleContactsProviderActionClient: GoogleContactsProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService
  private let secrets: SecretService
  private let mutationLock = NSLock()
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }

  public func executeGoogleContactsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleContactsProviderActionClientResult {
    if request.definition.actionKey == "google_contacts_update_prepare" {
            return GoogleContactsProviderActionClientResult(
                result: GoogleContactsProviderActionSupport.base("local-no-provider-request").merging([
                    "semanticDraftContract": .string("google-contacts-update-prepare-v1"), "draftPreview": .object(try GoogleContactsProviderActionSupport.validatedPreview(request.payload)), "providerMutation": .bool(false),
                ]) { _, new in new })
    }
    let token = try authorization(request)
    let root: JSONValue
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_contacts_connections_list":
            root = try send(
                token: token, method: "GET", path: "/people/me/connections",
                query: [URLQueryItem(name: "pageSize", value: "50"), URLQueryItem(name: "sortOrder", value: "LAST_MODIFIED_DESCENDING"), URLQueryItem(name: "personFields", value: GoogleContactsProviderActionSupport.readFields), URLQueryItem(name: "sources", value: "READ_SOURCE_TYPE_CONTACT")],
                body: nil)
      let people = GoogleContactsProviderActionSupport.array(GoogleContactsProviderActionSupport.object(root)["connections"]).prefix(50).map { JSONValue.object(GoogleContactsProviderActionSupport.person($0)) }
      fields = ["semanticReadContract": .string("google-contacts-connections-v1"), "connections": .array(Array(people)), "nextPageAvailable": .bool(GoogleContactsProviderActionSupport.object(root)["nextPageToken"] != nil)]
    case "google_contacts_contact_get":
      let resource = try GoogleContactsProviderActionSupport.resourceName(request.payload["resourceName"])
      root = try send(token: token, method: "GET", path: "/\(GoogleContactsProviderActionSupport.path(resource))", query: GoogleContactsProviderActionSupport.readQuery, body: nil)
      fields = ["semanticReadContract": .string("google-contacts-contact-v1"), "contact": .object(GoogleContactsProviderActionSupport.person(root))]
    case "google_contacts_contact_create":
      mutationLock.lock(); defer { mutationLock.unlock() }
            root = try send(
                token: token, method: "POST", path: "/people:createContact", query: [URLQueryItem(name: "personFields", value: GoogleContactsProviderActionSupport.readFields), URLQueryItem(name: "sources", value: "READ_SOURCE_TYPE_CONTACT")],
                body: try GoogleContactsProviderActionSupport.writeBody(request.payload, patch: false).body)
      fields = ["semanticWriteContract": .string("google-contacts-create-v1"), "providerMutation": .bool(true), "contact": .object(GoogleContactsProviderActionSupport.person(root))]
    case "google_contacts_contact_patch":
      mutationLock.lock(); defer { mutationLock.unlock() }
      let resource = try GoogleContactsProviderActionSupport.resourceName(request.payload["resourceName"])
      let current = try send(token: token, method: "GET", path: "/\(GoogleContactsProviderActionSupport.path(resource))", query: GoogleContactsProviderActionSupport.preflightQuery, body: nil)
      let update = try GoogleContactsProviderActionSupport.mergedUpdate(current: current, payload: request.payload)
            root = try send(
                token: token, method: "PATCH", path: "/\(GoogleContactsProviderActionSupport.path(resource)):updateContact",
                query: [URLQueryItem(name: "updatePersonFields", value: update.mask), URLQueryItem(name: "personFields", value: GoogleContactsProviderActionSupport.readFields), URLQueryItem(name: "sources", value: "READ_SOURCE_TYPE_CONTACT")], body: update.body)
      fields = ["semanticWriteContract": .string("google-contacts-safe-patch-v1"), "providerMutation": .bool(true), "latestSourceEtagPreflight": .bool(true), "contact": .object(GoogleContactsProviderActionSupport.person(root))]
    default:
      throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_live_action_not_supported", message: "Unsupported live Google Contacts action.")
    }
    return GoogleContactsProviderActionClientResult(result: GoogleContactsProviderActionSupport.base("live-people-api-v1").merging(fields) { _, new in new })
  }

  private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
    guard let id = request.auditIdentity.connectionId,
      let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id),
      connection.appSlug == "google-contacts", connection.appId == request.app.id,
      connection.status == .connected, connection.health.state == .ready,
      connection.grantedScopes == ProviderConnectionService.googleContactsRelayOwnedOAuthScopes,
      connection.health.diagnostics["contactSourceOnly"]?.bool == true,
      connection.health.diagnostics["directoryAccessEnabled"]?.bool == false,
      connection.health.diagnostics["otherContactsAccessEnabled"]?.bool == false,
      connection.health.diagnostics["broadPersonalFieldsEnabled"]?.bool == false,
      connection.health.diagnostics["destructiveActionsEnabled"]?.bool == false,
      connection.health.diagnostics["automaticPagination"]?.bool == false,
      let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "google_contacts_oauth_access_token" })?.secretReferenceId
    else { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_connection_not_ready", message: "Google Contacts requires a ready exact-scope privacy-bounded Relay-owned connection.") }
    return try secrets.getSecretValue(ref)
  }

  private func send(token: String, method: String, path: String, query: [URLQueryItem], body: JSONRecord?) throws -> JSONValue {
    var components = URLComponents(string: GoogleContactsProviderActionSupport.apiOrigin + path)!
    components.queryItems = query
    guard let url = components.url, url.scheme == "https", url.host == "people.googleapis.com", url.path.hasPrefix("/v1/") else { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_unsafe_url", message: "Unsafe Google People API URL.") }
    var request = URLRequest(url: url, timeoutInterval: 30)
    request.httpMethod = method
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    if let body { request.httpBody = try JSONEncoder().encode(JSONValue.object(body)); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
    let semaphore = DispatchSemaphore(value: 0)
    var captured: Result<(Data, HTTPURLResponse), Error>?
    URLSession.shared.dataTask(with: request) { bytes, response, error in
      defer { semaphore.signal() }
      if let error { captured = .failure(error); return }
      guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "google_contacts_transport_error", message: "Google People API returned no HTTP response.")); return }
      captured = .success((bytes, response))
    }.resume()
    guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_timeout", message: "Google People API request timed out.") }
    let (bytes, response) = try captured.get()
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 429 ? "google_contacts_rate_limited" : response.statusCode == 400 ? "google_contacts_invalid_or_stale_contact" : "google_contacts_api_error", message: "Google People API request failed.", providerStatusCode: response.statusCode)
        }
    guard bytes.count <= 2_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_response_too_large", message: "Google Contacts response exceeded the 2 MB V1 bound.") }
    return try JSONDecoder().decode(JSONValue.self, from: bytes)
  }
}

public struct GoogleContactsProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = ["google_contacts_connections_list", "google_contacts_contact_get", "google_contacts_update_prepare", "google_contacts_contact_create", "google_contacts_contact_patch"]
  private let client: any GoogleContactsProviderActionClient
  public init(client: any GoogleContactsProviderActionClient = FakeGoogleContactsProviderActionClient()) { self.client = client }
  public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
    guard request.app.slug == "google-contacts", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_action_not_allowlisted", message: "Google Contacts action is not allowlisted.") }
    let write = ["google_contacts_contact_create", "google_contacts_contact_patch"].contains(request.definition.actionKey)
    guard write ? request.permission != .blocked : request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_permission_denied", message: "Google Contacts action is not permitted by policy.") }
    return MarketplaceProviderActionAdapterResult(result: try client.executeGoogleContactsAction(request: request).result, error: nil, redactionStatus: "broad-personal-fields-directory-other-contacts-groups-photos-destructive-actions-excluded")
  }
}

public enum GoogleContactsProviderActionSupport {
  public static let apiOrigin = "https://people.googleapis.com/v1"
  public static let readFields = "names,emailAddresses,phoneNumbers,organizations,metadata"
  static let readQuery = [URLQueryItem(name: "personFields", value: readFields), URLQueryItem(name: "sources", value: "READ_SOURCE_TYPE_CONTACT")]
  static let preflightQuery = readQuery

    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("google-contacts"), "adapterBoundary": .string("google-contacts-provider-action-adapter"), "clientMode": .string(mode), "contactSourceOnly": .bool(true), "directoryAccessEnabled": .bool(false), "otherContactsAccessEnabled": .bool(false),
            "broadPersonalFieldsReturned": .bool(false), "destructiveActionsEnabled": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
  static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let value)? = value else { return [:] }; return value }
  static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let value)? = value else { return [] }; return value }
  static func scalar(_ value: JSONValue?, maximum: Int = 1024) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(maximum))); case .number, .bool, .null: return value; default: return .null } }
  static func path(_ value: String) -> String { value.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-_/~"))) ?? value }
    static func resourceName(_ value: JSONValue?) throws -> String {
        guard let value = value?.string, value.hasPrefix("people/"), value.count <= 512, value.dropFirst(7).allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_invalid_resource_name", message: "An explicit bounded people/* contact resource name is required.")
        }; return value
    }
    static func text(_ value: JSONValue?, name: String, maximum: Int, required: Bool = false) throws -> String? {
        guard let raw = value?.string else { if required { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_missing_\(name)", message: "Google Contacts requires \(name).") }; return nil }; let value = raw.trimmingCharacters(in: .whitespacesAndNewlines);
        guard !value.isEmpty, value.count <= maximum else { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_invalid_\(name)", message: "Google Contacts requires a bounded \(name).") }; return value
    }
    static func strings(_ value: JSONValue?, name: String, maximumCount: Int, maximumLength: Int) throws -> [String]? {
        guard value != nil else { return nil }; let values = array(value); guard values.count <= maximumCount else { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_too_many_\(name)", message: "Google Contacts \(name) exceeded the V1 count bound.") };
        return try values.map {
            guard let string = try text($0, name: name, maximum: maximumLength) else { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_invalid_\(name)", message: "Google Contacts requires bounded \(name).") }; return string
        }
    }
    static func organizations(_ value: JSONValue?) throws -> [JSONValue]? {
        guard value != nil else { return nil }; let values = array(value); guard values.count <= 3 else { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_too_many_organizations", message: "At most three organizations are allowed.") };
        return try values.map { item in
            let record = object(item); let name = try text(record["name"], name: "organization name", maximum: 256, required: true)!; let title = try text(record["title"], name: "organization title", maximum: 256); var result: JSONRecord = ["name": .string(name)];
            if let title { result["title"] = .string(title) }; return .object(result)
        }
    }
  static func writeBody(_ payload: JSONRecord, patch: Bool) throws -> (body: JSONRecord, mask: String) {
    var body: JSONRecord = [:], masks: [String] = []
        if payload["givenName"] != nil || payload["familyName"] != nil {
            let given = try text(payload["givenName"], name: "givenName", maximum: 256, required: !patch), family = try text(payload["familyName"], name: "familyName", maximum: 256);
            guard given != nil || family != nil else { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_empty_name", message: "A name update cannot be empty.") }; var name: JSONRecord = [:]; if let given { name["givenName"] = .string(given) };
            if let family { name["familyName"] = .string(family) }; body["names"] = .array([.object(name)]); masks.append("names")
        }
    if let values = try strings(payload["emailAddresses"], name: "emailAddresses", maximumCount: 5, maximumLength: 320) { body["emailAddresses"] = .array(values.map { .object(["value": .string($0)]) }); masks.append("emailAddresses") }
    if let values = try strings(payload["phoneNumbers"], name: "phoneNumbers", maximumCount: 5, maximumLength: 64) { body["phoneNumbers"] = .array(values.map { .object(["value": .string($0)]) }); masks.append("phoneNumbers") }
    if let values = try organizations(payload["organizations"]) { body["organizations"] = .array(values); masks.append("organizations") }
    guard !masks.isEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_empty_write", message: "Contact write requires at least one allowlisted field.") }
    if !patch && body["names"] == nil { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_create_name_required", message: "Contact creation requires a name.") }
    return (body, masks.joined(separator: ","))
  }
    static func mergedUpdate(current: JSONValue, payload: JSONRecord) throws -> (body: JSONRecord, mask: String) {
        var body = object(current); let update = try writeBody(payload, patch: true); for (key, value) in update.body { body[key] = value };
        guard body["metadata"] != nil, body["etag"] != nil else { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_missing_source_etag", message: "Latest contact source metadata and ETag are required for update.") }; return (body, update.mask)
    }
    static func compactArray(_ value: JSONValue?, fields: [String], limit: Int) -> JSONValue {
        .array(
            array(value).prefix(limit).map { item in
                let source = object(item); var result: JSONRecord = [:]; for field in fields { result[field] = scalar(source[field], maximum: field == "value" ? 320 : 256) }; return .object(result)
            })
    }
    static func person(_ value: JSONValue?) -> JSONRecord {
        let source = object(value);
        return [
            "resourceName": scalar(source["resourceName"], maximum: 512), "etag": scalar(source["etag"], maximum: 512), "names": compactArray(source["names"], fields: ["displayName", "givenName", "familyName"], limit: 1),
            "emailAddresses": compactArray(source["emailAddresses"], fields: ["value", "type"], limit: 5), "phoneNumbers": compactArray(source["phoneNumbers"], fields: ["value", "type"], limit: 5),
            "organizations": compactArray(source["organizations"], fields: ["name", "title", "department"], limit: 3), "broadPersonalFieldsReturned": .bool(false), "directoryProfileReturned": .bool(false), "otherContactReturned": .bool(false),
        ]
    }
  static func preview(_ payload: JSONRecord) -> JSONRecord { ["operation": payload["operation"] ?? .null, "resourceName": payload["resourceName"] ?? .null, "givenName": payload["givenName"] ?? .null, "familyName": payload["familyName"] ?? .null, "providerMutation": .bool(false)] }
    static func validatedPreview(_ payload: JSONRecord) throws -> JSONRecord {
        let operation = try text(payload["operation"], name: "operation", maximum: 16, required: true)!;
        guard ["create", "patch"].contains(operation) else { throw MarketplaceProviderActionAdapterFailure(code: "google_contacts_operation_not_allowlisted", message: "Only create and patch may be prepared.") }; if operation == "patch" { _ = try resourceName(payload["resourceName"]) };
        _ = try writeBody(payload, patch: operation == "patch"); return preview(payload)
    }
    public static func fakePerson() -> JSONRecord {
        [
            "resourceName": .string("people/c123"), "etag": .string("etag-contact-1"), "names": .array([.object(["displayName": .string("Ada Lovelace"), "givenName": .string("Ada"), "familyName": .string("Lovelace")])]),
            "emailAddresses": .array([.object(["value": .string("ada@example.com"), "type": .string("work")])]), "phoneNumbers": .array([]), "organizations": .array([.object(["name": .string("Analytical Engines"), "title": .string("Researcher"), "department": .null])]),
            "broadPersonalFieldsReturned": .bool(false), "directoryProfileReturned": .bool(false), "otherContactReturned": .bool(false),
        ]
    }
}
