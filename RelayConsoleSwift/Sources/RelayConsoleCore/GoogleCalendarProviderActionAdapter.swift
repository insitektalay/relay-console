import Foundation

public struct GoogleCalendarProviderActionClientResult: Sendable {
  public var result: JSONRecord
  public init(result: JSONRecord) { self.result = result }
}
public protocol GoogleCalendarProviderActionClient: Sendable {
  func executeGoogleCalendarAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> GoogleCalendarProviderActionClientResult
}

public struct FakeGoogleCalendarProviderActionClient: GoogleCalendarProviderActionClient {
  public init() {}
  public func executeGoogleCalendarAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> GoogleCalendarProviderActionClientResult
  {
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_calendar_calendar_list":
      fields = [
        "semanticReadContract": .string("google-calendar-calendar-list-v1"),
        "calendars": .array([.object(GoogleCalendarProviderActionSupport.fakeCalendar())]),
      ]
    case "google_calendar_event_list":
      fields = [
        "semanticReadContract": .string("google-calendar-event-list-v1"),
        "events": .array([.object(GoogleCalendarProviderActionSupport.fakeEvent())]),
      ]
    case "google_calendar_freebusy_query":
      fields = [
        "semanticReadContract": .string("google-calendar-freebusy-v1"),
        "busy": .array([.object(GoogleCalendarProviderActionSupport.fakeBusy())]),
      ]
    case "google_calendar_event_create":
      fields = [
        "semanticWriteContract": .string("google-calendar-event-create-v1"),
        "event": .object(GoogleCalendarProviderActionSupport.fakeEvent()),
        "providerMutation": .bool(true),
      ]
    case "google_calendar_event_update":
      fields = [
        "semanticWriteContract": .string("google-calendar-event-update-v1"),
        "event": .object(GoogleCalendarProviderActionSupport.fakeEvent()),
        "providerMutation": .bool(true),
      ]
    default:
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_calendar_action_not_supported", message: "Unsupported Google Calendar action."
      )
    }
    return GoogleCalendarProviderActionClientResult(
      result: GoogleCalendarProviderActionSupport.base("fake-calendar-api-v3").merging(fields) {
        _, new in new
      })
  }
}

public final class LiveGoogleCalendarProviderActionClient: GoogleCalendarProviderActionClient,
  @unchecked Sendable
{
  private let data: LocalDataService
  private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) {
    self.data = data
    self.secrets = secrets
  }
  public func executeGoogleCalendarAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> GoogleCalendarProviderActionClientResult
  {
    let token = try authorization(request)
    let limit = GoogleCalendarProviderActionSupport.bound(request.payload["limit"])
    switch request.definition.actionKey {
    case "google_calendar_calendar_list":
      let root = try send(
        token, method: "GET", path: "/users/me/calendarList",
        query: [URLQueryItem(name: "maxResults", value: String(limit))], body: nil)
      return mapped(
        "semanticReadContract", "google-calendar-calendar-list-v1",
        [
          "calendars": .array(
            GoogleCalendarProviderActionSupport.array(
              GoogleCalendarProviderActionSupport.object(root)["items"]
            ).prefix(limit).map { .object(GoogleCalendarProviderActionSupport.calendar($0)) })
        ])
    case "google_calendar_event_list":
      let calendarId = try GoogleCalendarProviderActionSupport.requiredString(
        request.payload["calendarId"], name: "calendarId", max: 320)
      let timeMin = try GoogleCalendarProviderActionSupport.requiredTimestamp(
        request.payload["timeMin"], name: "timeMin")
      let timeMax = try GoogleCalendarProviderActionSupport.requiredTimestamp(
        request.payload["timeMax"], name: "timeMax")
      let query = [
        URLQueryItem(name: "timeMin", value: timeMin),
        URLQueryItem(name: "timeMax", value: timeMax),
        URLQueryItem(name: "maxResults", value: String(limit)),
        URLQueryItem(name: "singleEvents", value: "true"),
        URLQueryItem(name: "orderBy", value: "startTime"),
        URLQueryItem(name: "showDeleted", value: "false"),
      ]
      let root = try send(
        token, method: "GET",
        path: "/calendars/\(GoogleCalendarProviderActionSupport.path(calendarId))/events",
        query: query, body: nil)
      return mapped(
        "semanticReadContract", "google-calendar-event-list-v1",
        [
          "events": .array(
            GoogleCalendarProviderActionSupport.array(
              GoogleCalendarProviderActionSupport.object(root)["items"]
            ).prefix(limit).map { .object(GoogleCalendarProviderActionSupport.event($0)) })
        ])
    case "google_calendar_freebusy_query":
      let timeMin = try GoogleCalendarProviderActionSupport.requiredTimestamp(
        request.payload["timeMin"], name: "timeMin")
      let timeMax = try GoogleCalendarProviderActionSupport.requiredTimestamp(
        request.payload["timeMax"], name: "timeMax")
      let ids = try GoogleCalendarProviderActionSupport.calendarIds(request.payload["calendarIds"])
      let root = try send(
        token, method: "POST", path: "/freeBusy", query: [],
        body: [
          "timeMin": .string(timeMin), "timeMax": .string(timeMax),
          "items": .array(ids.map { .object(["id": .string($0)]) }),
        ])
      let calendars = GoogleCalendarProviderActionSupport.object(
        GoogleCalendarProviderActionSupport.object(root)["calendars"])
      var busy: [JSONValue] = []
      for id in ids {
        for value in GoogleCalendarProviderActionSupport.array(
          GoogleCalendarProviderActionSupport.object(calendars[id])["busy"]
        ).prefix(25) {
          busy.append(.object(GoogleCalendarProviderActionSupport.busy(value, calendarId: id)))
        }
      }
      return mapped(
        "semanticReadContract", "google-calendar-freebusy-v1",
        [
          "timeMin": .string(timeMin), "timeMax": .string(timeMax),
          "busy": .array(Array(busy.prefix(100))),
        ])
    case "google_calendar_event_create", "google_calendar_event_update":
      let calendarId = try GoogleCalendarProviderActionSupport.requiredString(
        request.payload["calendarId"], name: "calendarId", max: 320)
      let payload = try GoogleCalendarProviderActionSupport.writePayload(request.payload)
      let update = request.definition.actionKey == "google_calendar_event_update"
      let eventId =
        update
        ? try GoogleCalendarProviderActionSupport.requiredString(
          request.payload["eventId"], name: "eventId", max: 1024) : ""
      let path =
        update
        ? "/calendars/\(GoogleCalendarProviderActionSupport.path(calendarId))/events/\(GoogleCalendarProviderActionSupport.path(eventId))"
        : "/calendars/\(GoogleCalendarProviderActionSupport.path(calendarId))/events"
      let root = try send(
        token, method: update ? "PATCH" : "POST", path: path,
        query: [URLQueryItem(name: "sendUpdates", value: "none")], body: payload)
      return mapped(
        "semanticWriteContract",
        update ? "google-calendar-event-update-v1" : "google-calendar-event-create-v1",
        [
          "event": .object(GoogleCalendarProviderActionSupport.event(root)),
          "providerMutation": .bool(true), "guestNotificationsSent": .bool(false),
        ])
    default:
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_calendar_live_action_not_supported",
        message: "Unsupported live Google Calendar action.")
    }
  }
  private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
    guard let id = request.auditIdentity.connectionId,
      let connection = try data.getProviderConnection(
        workspaceId: request.context.workspaceId, connectionId: id),
      connection.appSlug == "google-calendar", connection.appId == request.app.id,
      connection.status == .connected, connection.health.state == .ready,
      connection.grantedScopes == ProviderConnectionService.googleCalendarRelayOwnedOAuthScopes,
      connection.health.diagnostics["apiOrigin"]?.string
        == GoogleCalendarProviderActionSupport.apiOrigin,
      let ref = connection.credentialRequirements.first(where: {
        $0.fieldKey == "google_calendar_oauth_access_token"
      })?.secretReferenceId
    else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_calendar_connection_not_ready",
        message: "Google Calendar requires a ready exact-scope Relay-owned connection.")
    }
    return try secrets.getSecretValue(ref)
  }
  private func send(
    _ token: String, method: String, path: String, query: [URLQueryItem], body: JSONRecord?
  ) throws -> JSONValue {
    var components = URLComponents(string: GoogleCalendarProviderActionSupport.apiOrigin + path)
    components?.queryItems = query.isEmpty ? nil : query
    guard let url = components?.url else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_calendar_invalid_url",
        message: "Could not build allowlisted Google Calendar URL.")
    }
    var request = URLRequest(url: url)
    request.httpMethod = method
    request.timeoutInterval = 20
    request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    if let body {
      request.httpBody = try JSONEncoder().encode(JSONValue.object(body))
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    }
    let semaphore = DispatchSemaphore(value: 0)
    var outcome: Result<(Data, Int), Error>!
    URLSession.shared.dataTask(with: request) { bytes, response, error in
      outcome =
        error.map(Result.failure)
        ?? .success((bytes ?? Data(), (response as? HTTPURLResponse)?.statusCode ?? 0))
      semaphore.signal()
    }.resume()
    guard semaphore.wait(timeout: .now() + 20) == .success else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_calendar_timeout", message: "Google Calendar request timed out.")
    }
    let (bytes, status) = try outcome.get()
    guard (200..<300).contains(status) else {
      throw MarketplaceProviderActionAdapterFailure(
        code: status == 429
          ? "google_calendar_rate_limited"
          : status == 401
            ? "google_calendar_access_token_invalid"
            : status == 403
              ? "google_calendar_scope_or_acl_denied"
              : status == 404
                ? "google_calendar_resource_not_found"
                : status == 409 || status == 412
                  ? "google_calendar_conflict" : "google_calendar_api_error",
        message: "Google Calendar API request failed.", providerStatusCode: status)
    }
    return bytes.isEmpty
      ? .object([:])
      : GoogleCalendarProviderActionSupport.json(try JSONSerialization.jsonObject(with: bytes))
  }
  private func mapped(_ key: String, _ contract: String, _ fields: JSONRecord)
    -> GoogleCalendarProviderActionClientResult
  {
    GoogleCalendarProviderActionClientResult(
      result: GoogleCalendarProviderActionSupport.base("live-calendar-api-v3").merging(
        [key: .string(contract)].merging(fields) { _, new in new }
      ) { _, new in new })
  }
}

public struct GoogleCalendarProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = [
    "google_calendar_calendar_list", "google_calendar_event_list", "google_calendar_freebusy_query",
    "google_calendar_event_create", "google_calendar_event_update",
  ]
  private let client: any GoogleCalendarProviderActionClient
  public init(
    client: any GoogleCalendarProviderActionClient = FakeGoogleCalendarProviderActionClient()
  ) { self.client = client }
  public func execute(request: MarketplaceProviderActionAdapterRequest) throws
    -> MarketplaceProviderActionAdapterResult
  {
    guard request.app.slug == "google-calendar", Self.allowed.contains(request.definition.actionKey)
    else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_calendar_action_not_allowlisted",
        message: "Google Calendar action is not allowlisted.")
    }
    let write =
      request.definition.actionKey.hasSuffix("_create")
      || request.definition.actionKey.hasSuffix("_update")
    guard write ? request.permission != .blocked : request.permission == .allowed else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_calendar_permission_denied",
        message: "Google Calendar action is not permitted by the compiled policy.")
    }
    return MarketplaceProviderActionAdapterResult(
      result: try client.executeGoogleCalendarAction(request: request).result, error: nil,
      redactionStatus: "credentials-private-extended-properties-attachments-excluded")
  }
}

public enum GoogleCalendarProviderActionSupport {
  public static let apiOrigin = "https://www.googleapis.com/calendar/v3"
  static func base(_ mode: String) -> JSONRecord {
    [
      "provider": .string("google-calendar"),
      "adapterBoundary": .string("google-calendar-provider-action-adapter"),
      "clientMode": .string(mode), "rawProviderToolExposure": .bool(false),
      "automaticPagination": .bool(false), "attachmentsReturned": .bool(false),
      "privateExtendedPropertiesReturned": .bool(false),
      "redactionStatus": .string("credentials-private-extended-properties-attachments-excluded"),
    ]
  }
  static func bound(_ value: JSONValue?) -> Int {
    max(1, min(25, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? 25))
  }
  static func object(_ value: JSONValue?) -> JSONRecord {
    guard case .object(let value)? = value else { return [:] }
    return value
  }
  static func array(_ value: JSONValue?) -> [JSONValue] {
    guard case .array(let value)? = value else { return [] }
    return value
  }
  static func scalar(_ value: JSONValue?) -> JSONValue {
    guard let value else { return .null }
    switch value {
    case .string(let text): return .string(String(text.prefix(2000)))
    case .number, .bool, .null: return value
    default: return .null
    }
  }
  static func requiredString(_ value: JSONValue?, name: String, max: Int) throws -> String {
    guard let text = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty,
      text.count <= max
    else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_calendar_invalid_\(name)",
        message: "Google Calendar requires a bounded \(name).")
    }
    return text
  }
  static func requiredTimestamp(_ value: JSONValue?, name: String) throws -> String {
    let text = try requiredString(value, name: name, max: 64)
    guard ISO8601DateFormatter().date(from: text) != nil else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_calendar_invalid_\(name)",
        message: "Google Calendar requires RFC3339 \(name).")
    }
    return text
  }
  static func path(_ value: String) -> String {
    value.addingPercentEncoding(
      withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-_~."))) ?? value
  }
  static func calendarIds(_ value: JSONValue?) throws -> [String] {
    let ids = array(value).compactMap(\.string).map {
      $0.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    guard (1...10).contains(ids.count), ids.allSatisfy({ !$0.isEmpty && $0.count <= 320 }) else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_calendar_invalid_calendar_ids",
        message: "FreeBusy requires 1-10 bounded Calendar IDs.")
    }
    return ids
  }
  static func time(_ value: JSONValue?) -> JSONRecord {
    let record = object(value)
    return [
      "date": scalar(record["date"]), "dateTime": scalar(record["dateTime"]),
      "timeZone": scalar(record["timeZone"]),
    ]
  }
  static func calendar(_ value: JSONValue) -> JSONRecord {
    let r = object(value)
    return [
      "id": scalar(r["id"]), "summary": scalar(r["summary"]),
      "description": scalar(r["description"]), "timeZone": scalar(r["timeZone"]),
      "accessRole": scalar(r["accessRole"]), "primary": scalar(r["primary"]),
      "selected": scalar(r["selected"]), "aclReturned": .bool(false),
    ]
  }
  static func attendee(_ value: JSONValue?) -> JSONRecord {
    let r = object(value)
    return [
      "email": scalar(r["email"]), "displayName": scalar(r["displayName"]),
      "responseStatus": scalar(r["responseStatus"]), "self": scalar(r["self"]),
    ]
  }
  static func event(_ value: JSONValue?) -> JSONRecord {
    let r = object(value)
    return [
      "id": scalar(r["id"]), "etag": scalar(r["etag"]), "status": scalar(r["status"]),
      "summary": scalar(r["summary"]), "description": scalar(r["description"]),
      "location": scalar(r["location"]), "start": .object(time(r["start"])),
      "end": .object(time(r["end"])), "eventType": scalar(r["eventType"]),
      "recurrence": .array(array(r["recurrence"]).prefix(10).map(scalar)),
      "organizer": .object(attendee(r["organizer"])),
      "attendees": .array(array(r["attendees"]).prefix(25).map { .object(attendee($0)) }),
      "htmlLink": scalar(r["htmlLink"]), "updated": scalar(r["updated"]),
      "attachmentsReturned": .bool(false), "privateExtendedPropertiesReturned": .bool(false),
    ]
  }
  static func busy(_ value: JSONValue, calendarId: String) -> JSONRecord {
    let r = object(value)
    return [
      "calendarId": .string(calendarId), "start": scalar(r["start"]), "end": scalar(r["end"]),
    ]
  }
  static func writePayload(_ payload: JSONRecord) throws -> JSONRecord {
    var result: JSONRecord = [:]
    if let summary = payload["summary"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
      !summary.isEmpty, summary.count <= 500
    {
      result["summary"] = .string(summary)
    }
    for key in ["description", "location"] {
      if let text = payload[key]?.string, text.count <= 4000 { result[key] = .string(text) }
    }
    guard case .object(let start)? = payload["start"], case .object(let end)? = payload["end"],
      !start.isEmpty && !end.isEmpty
    else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_calendar_invalid_event_time",
        message: "Event create/update requires bounded start and end objects.")
    }
    result["start"] = .object(start.filter { ["date", "dateTime", "timeZone"].contains($0.key) })
    result["end"] = .object(end.filter { ["date", "dateTime", "timeZone"].contains($0.key) })
    if case .array(let attendees)? = payload["attendees"] {
      guard attendees.count <= 25 else {
        throw MarketplaceProviderActionAdapterFailure(
          code: "google_calendar_too_many_attendees", message: "At most 25 attendees are allowed.")
      }
      result["attendees"] = .array(
        attendees.compactMap { value in
          let record = object(value)
          guard let email = record["email"]?.string, email.contains("@"), email.count <= 320 else {
            return nil
          }
          return .object(["email": .string(email)])
        })
    }
    return result
  }
  public static func fakeCalendar() -> JSONRecord {
    calendar(
      .object([
        "id": .string("primary"), "summary": .string("Relay Team"),
        "timeZone": .string("Europe/London"), "accessRole": .string("owner"),
        "primary": .bool(true), "selected": .bool(true),
      ]))
  }
  public static func fakeEvent() -> JSONRecord {
    event(
      .object([
        "id": .string("event-101"), "etag": .string("etag-1"), "status": .string("confirmed"),
        "summary": .string("Planning review"), "description": .string("Review the release plan."),
        "location": .string("Video call"),
        "start": .object([
          "dateTime": .string("2026-07-12T10:00:00Z"), "timeZone": .string("Europe/London"),
        ]),
        "end": .object([
          "dateTime": .string("2026-07-12T10:30:00Z"), "timeZone": .string("Europe/London"),
        ]), "eventType": .string("default"),
        "attendees": .array([
          .object([
            "email": .string("participant@example.test"), "responseStatus": .string("accepted"),
          ])
        ]), "updated": .string("2026-07-12T09:00:00Z"),
      ]))
  }
  public static func fakeBusy() -> JSONRecord {
    busy(
      .object(["start": .string("2026-07-12T10:00:00Z"), "end": .string("2026-07-12T10:30:00Z")]),
      calendarId: "primary")
  }
  static func json(_ value: Any) -> JSONValue {
    if let value = value as? String { return .string(value) }
    if let value = value as? Bool { return .bool(value) }
    if let value = value as? NSNumber { return .number(value.doubleValue) }
    if let value = value as? [String: Any] { return .object(value.mapValues(json)) }
    if let value = value as? [Any] { return .array(value.map(json)) }
    return .null
  }
}
