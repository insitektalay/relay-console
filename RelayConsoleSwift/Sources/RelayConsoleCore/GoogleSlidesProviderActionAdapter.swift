import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct GoogleSlidesProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol GoogleSlidesProviderActionClient: Sendable { func executeGoogleSlidesAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleSlidesProviderActionClientResult }

public struct FakeGoogleSlidesProviderActionClient: GoogleSlidesProviderActionClient {
  public init() {}
  public func executeGoogleSlidesAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleSlidesProviderActionClientResult {
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_slides_presentation_get": fields = ["semanticReadContract": .string("google-slides-presentation-v1"), "presentation": .object(GoogleSlidesProviderActionSupport.fakePresentation())]
    case "google_slides_page_get": fields = ["semanticReadContract": .string("google-slides-page-v1"), "page": .object(GoogleSlidesProviderActionSupport.fakePage())]
    case "google_slides_update_prepare": fields = ["semanticDraftContract": .string("google-slides-update-prepare-v1"), "draftPreview": .object(GoogleSlidesProviderActionSupport.preview(request.payload))]
    case "google_slides_text_replace": fields = ["semanticWriteContract": .string("google-slides-text-replace-v1"), "providerMutation": .bool(true), "presentationId": request.payload["presentationId"] ?? .null]
    case "google_slides_slide_create": fields = ["semanticWriteContract": .string("google-slides-slide-create-v1"), "providerMutation": .bool(true), "presentationId": request.payload["presentationId"] ?? .null]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_slides_action_not_supported", message: "Unsupported Google Slides action.")
    }
    return GoogleSlidesProviderActionClientResult(result: GoogleSlidesProviderActionSupport.base("fake-slides-api-v1").merging(fields) { _, new in new })
  }
}

public final class LiveGoogleSlidesProviderActionClient: GoogleSlidesProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
  public func executeGoogleSlidesAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleSlidesProviderActionClientResult {
    if request.definition.actionKey == "google_slides_update_prepare" {
            return GoogleSlidesProviderActionClientResult(
                result: GoogleSlidesProviderActionSupport.base("local-no-provider-request").merging([
                    "semanticDraftContract": .string("google-slides-update-prepare-v1"), "draftPreview": .object(try GoogleSlidesProviderActionSupport.validatedPreview(request.payload)), "providerMutation": .bool(false),
                ]) { _, new in new })
    }
    let token = try authorization(request), id = try GoogleSlidesProviderActionSupport.safeId(request.payload["presentationId"], name: "presentationId")
    let root: JSONValue; let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_slides_presentation_get":
      root = try send(token: token, method: "GET", path: "/presentations/\(GoogleSlidesProviderActionSupport.path(id))", body: nil)
      fields = ["semanticReadContract": .string("google-slides-presentation-v1"), "presentation": .object(GoogleSlidesProviderActionSupport.presentation(root))]
    case "google_slides_page_get":
      let page = try GoogleSlidesProviderActionSupport.safeId(request.payload["pageObjectId"], name: "pageObjectId")
      root = try send(token: token, method: "GET", path: "/presentations/\(GoogleSlidesProviderActionSupport.path(id))/pages/\(GoogleSlidesProviderActionSupport.path(page))", body: nil)
      fields = ["semanticReadContract": .string("google-slides-page-v1"), "page": .object(GoogleSlidesProviderActionSupport.page(root))]
    case "google_slides_text_replace":
      let match = try GoogleSlidesProviderActionSupport.text(request.payload["matchText"], name: "matchText", maximum: 1000)
      let replacement = try GoogleSlidesProviderActionSupport.text(request.payload["replacementText"], name: "replacementText", maximum: 20_000)
      var body: JSONRecord = ["requests": .array([.object(["replaceAllText": .object(["containsText": .object(["text": .string(match), "matchCase": .bool(request.payload["matchCase"]?.bool ?? true)]), "replaceText": .string(replacement)])])])]
      if let revision = request.payload["requiredRevisionId"]?.string { body["writeControl"] = .object(["requiredRevisionId": .string(try GoogleSlidesProviderActionSupport.safeId(.string(revision), name: "requiredRevisionId"))]) }
      root = try send(token: token, method: "POST", path: "/presentations/\(GoogleSlidesProviderActionSupport.path(id)):batchUpdate", body: body)
      fields = ["semanticWriteContract": .string("google-slides-text-replace-v1"), "providerMutation": .bool(true), "response": .object(GoogleSlidesProviderActionSupport.writeResponse(root))]
    case "google_slides_slide_create":
      let layout = request.payload["layout"]?.string ?? "TITLE_AND_BODY"
      guard ["BLANK", "TITLE", "TITLE_AND_BODY", "TITLE_ONLY", "SECTION_HEADER"].contains(layout) else { throw MarketplaceProviderActionAdapterFailure(code: "google_slides_layout_not_allowlisted", message: "Slide layout is not allowlisted.") }
      let objectId = try GoogleSlidesProviderActionSupport.safeObjectId(request.payload["slideObjectId"])
      var requests: [JSONValue] = [.object(["createSlide": .object(["objectId": .string(objectId), "slideLayoutReference": .object(["predefinedLayout": .string(layout)])])])]
            if let title = request.payload["titleText"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty {
                guard title.count <= 10_000 else { throw MarketplaceProviderActionAdapterFailure(code: "google_slides_text_too_large", message: "Slide title exceeds the V1 bound.") }; requests.append(.object(["insertText": .object(["objectId": .string(objectId), "text": .string(title)])]))
            }
      guard requests.count <= 20 else { throw MarketplaceProviderActionAdapterFailure(code: "google_slides_batch_too_large", message: "Slides V1 permits at most 20 atomic subrequests.") }
      root = try send(token: token, method: "POST", path: "/presentations/\(GoogleSlidesProviderActionSupport.path(id)):batchUpdate", body: ["requests": .array(requests)])
      fields = ["semanticWriteContract": .string("google-slides-slide-create-v1"), "providerMutation": .bool(true), "response": .object(GoogleSlidesProviderActionSupport.writeResponse(root))]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_slides_live_action_not_supported", message: "Unsupported live Google Slides action.")
    }
    return GoogleSlidesProviderActionClientResult(result: GoogleSlidesProviderActionSupport.base("live-slides-api-v1").merging(fields) { _, new in new })
  }
  private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "google-slides", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.grantedScopes == ProviderConnectionService.googleSlidesRelayOwnedOAuthScopes, connection.health.diagnostics["appVisiblePresentationCorpusEnforced"]?.bool == true,
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "google_slides_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "google_slides_connection_not_ready", message: "Google Slides requires a ready exact-scope Relay-owned connection.") }
    return try secrets.getSecretValue(ref)
  }
  private func send(token: String, method: String, path: String, body: JSONRecord?) throws -> JSONValue {
    guard let url = URL(string: GoogleSlidesProviderActionSupport.apiOrigin + path), url.scheme == "https", url.host == "slides.googleapis.com" else { throw MarketplaceProviderActionAdapterFailure(code: "google_slides_unsafe_url", message: "Unsafe Google Slides API URL.") }
    var request = URLRequest(url: url, timeoutInterval: 30); request.httpMethod = method; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    if let body { request.httpBody = try JSONEncoder().encode(JSONValue.object(body)); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
    let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "google_slides_transport_error", message: "Google Slides returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume()
    guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "google_slides_timeout", message: "Google Slides API request timed out.") }
        let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "google_slides_rate_limited" : "google_slides_api_error", message: "Google Slides API request failed.", providerStatusCode: response.statusCode) }
    guard bytes.count <= 2_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "google_slides_response_too_large", message: "Google Slides response exceeded the 2 MB V1 bound.") }
    return try JSONDecoder().decode(JSONValue.self, from: bytes)
  }
}

public struct GoogleSlidesProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = ["google_slides_presentation_get", "google_slides_page_get", "google_slides_update_prepare", "google_slides_text_replace", "google_slides_slide_create"]
  private let client: any GoogleSlidesProviderActionClient
  public init(client: any GoogleSlidesProviderActionClient = FakeGoogleSlidesProviderActionClient()) { self.client = client }
  public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
    guard request.app.slug == "google-slides", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "google_slides_action_not_allowlisted", message: "Google Slides action is not allowlisted.") }
    let write = ["google_slides_text_replace", "google_slides_slide_create"].contains(request.definition.actionKey)
    guard write ? request.permission != .blocked : request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "google_slides_permission_denied", message: "Google Slides action is not permitted by the compiled policy.") }
    return MarketplaceProviderActionAdapterResult(result: try client.executeGoogleSlidesAction(request: request).result, error: nil, redactionStatus: "presentation-text-bounded-media-not-returned-sharing-drive-metadata-excluded")
  }
}

public enum GoogleSlidesProviderActionSupport {
  public static let apiOrigin = "https://slides.googleapis.com/v1"
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("google-slides"), "adapterBoundary": .string("google-slides-provider-action-adapter"), "clientMode": .string(mode), "appVisiblePresentationCorpusEnforced": .bool(true), "wholeDriveDiscovery": .bool(false), "automaticPagination": .bool(false),
            "thumbnailsReturned": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
  static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let value)? = value else { return [:] }; return value }
  static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let value)? = value else { return [] }; return value }
  static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let s): return .string(String(s.prefix(2000))); case .number, .bool, .null: return value; default: return .null } }
    static func safeId(_ value: JSONValue?, name: String) throws -> String {
        guard let text = value?.string, !text.isEmpty, text.count <= 1024, text.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" || $0 == ":" }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "google_slides_invalid_\(name)", message: "Google Slides requires a bounded \(name).")
        }; return text
    }
    static func safeObjectId(_ value: JSONValue?) throws -> String {
        let value = try safeId(value, name: "slideObjectId"); guard (5...50).contains(value.count) else { throw MarketplaceProviderActionAdapterFailure(code: "google_slides_invalid_slide_object_id", message: "Slide object IDs must contain 5-50 safe characters.") }; return value
    }
  static func path(_ value: String) -> String { value.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-_~.:"))) ?? value }
    static func text(_ value: JSONValue?, name: String, maximum: Int) throws -> String {
        guard let text = value?.string, !text.isEmpty, text.count <= maximum else { throw MarketplaceProviderActionAdapterFailure(code: "google_slides_invalid_\(name)", message: "Google Slides requires a bounded \(name).") }; return text
    }
  static func elementText(_ element: JSONValue?) -> String { let shape = object(object(element)["shape"]), text = object(shape["text"]), elements = array(text["textElements"]); return String(elements.compactMap { object(object($0)["textRun"])["content"]?.string }.joined().prefix(10_000)) }
    static func page(_ root: JSONValue) -> JSONRecord {
        let r = object(root), elements = array(r["pageElements"]).prefix(100);
        return ["objectId": scalar(r["objectId"]), "elementCount": .number(Double(elements.count)), "semanticText": .string(String(elements.map(elementText).joined(separator: "\n").prefix(10_000))), "mediaBytesReturned": .bool(false), "speakerNotesReturned": .bool(false)]
    }
    static func presentation(_ root: JSONValue) -> JSONRecord {
        let r = object(root), slides = array(r["slides"]).prefix(50);
        return [
            "presentationId": scalar(r["presentationId"]), "title": scalar(object(r["title"])["content"] ?? r["title"]), "locale": scalar(r["locale"]), "slideCount": .number(Double(slides.count)), "slides": .array(slides.map { .object(page($0)) }), "mastersReturned": .bool(false),
            "layoutsReturned": .bool(false), "themesReturned": .bool(false),
        ]
    }
  static func preview(_ payload: JSONRecord) -> JSONRecord { ["presentationId": payload["presentationId"] ?? .null, "operation": payload["operation"] ?? .null, "providerMutation": .bool(false)] }
    static func validatedPreview(_ payload: JSONRecord) throws -> JSONRecord {
        _ = try safeId(payload["presentationId"], name: "presentationId"); let operation = try text(payload["operation"], name: "operation", maximum: 32);
        guard ["text_replace", "slide_create"].contains(operation) else { throw MarketplaceProviderActionAdapterFailure(code: "google_slides_operation_not_allowlisted", message: "Only text_replace and slide_create may be prepared.") }; return preview(payload)
    }
  static func writeResponse(_ root: JSONValue) -> JSONRecord { let r = object(root); return ["presentationId": scalar(r["presentationId"]), "replyCount": .number(Double(array(r["replies"]).prefix(20).count)), "requiredRevisionId": scalar(object(r["writeControl"])["requiredRevisionId"])] }
  public static func fakePage() -> JSONRecord { ["objectId": .string("slide_001"), "elementCount": .number(2), "semanticText": .string("Quarterly plan\nRelay is ready"), "mediaBytesReturned": .bool(false), "speakerNotesReturned": .bool(false)] }
    public static func fakePresentation() -> JSONRecord {
        ["presentationId": .string("relay-presentation-101"), "title": .string("Quarterly plan"), "locale": .string("en-GB"), "slideCount": .number(1), "slides": .array([.object(fakePage())]), "mastersReturned": .bool(false), "layoutsReturned": .bool(false), "themesReturned": .bool(false)]
    }
}
