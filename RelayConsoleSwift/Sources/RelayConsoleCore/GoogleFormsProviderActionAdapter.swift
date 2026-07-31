import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct GoogleFormsProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol GoogleFormsProviderActionClient: Sendable { func executeGoogleFormsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleFormsProviderActionClientResult }

public struct FakeGoogleFormsProviderActionClient: GoogleFormsProviderActionClient {
  public init() {}
  public func executeGoogleFormsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleFormsProviderActionClientResult {
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_forms_form_get": fields = ["semanticReadContract": .string("google-forms-form-structure-v1"), "form": .object(GoogleFormsProviderActionSupport.fakeForm())]
    case "google_forms_update_prepare": fields = ["semanticDraftContract": .string("google-forms-update-prepare-v1"), "draftPreview": .object(GoogleFormsProviderActionSupport.preview(request.payload))]
    case "google_forms_form_create": fields = ["semanticWriteContract": .string("google-forms-unpublished-create-v1"), "providerMutation": .bool(true), "form": .object(GoogleFormsProviderActionSupport.fakeForm())]
    case "google_forms_question_create": fields = ["semanticWriteContract": .string("google-forms-question-create-v1"), "providerMutation": .bool(true), "formId": request.payload["formId"] ?? .null]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_forms_action_not_supported", message: "Unsupported Google Forms action.")
    }
    return GoogleFormsProviderActionClientResult(result: GoogleFormsProviderActionSupport.base("fake-forms-api-v1").merging(fields) { _, new in new })
  }
}

public final class LiveGoogleFormsProviderActionClient: GoogleFormsProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
  public func executeGoogleFormsAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleFormsProviderActionClientResult {
    if request.definition.actionKey == "google_forms_update_prepare" {
            return GoogleFormsProviderActionClientResult(
                result: GoogleFormsProviderActionSupport.base("local-no-provider-request").merging(["semanticDraftContract": .string("google-forms-update-prepare-v1"), "draftPreview": .object(try GoogleFormsProviderActionSupport.validatedPreview(request.payload)), "providerMutation": .bool(false)])
                { _, new in new })
    }
    let token = try authorization(request); let root: JSONValue; let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_forms_form_get":
      let id = try GoogleFormsProviderActionSupport.safeId(request.payload["formId"], name: "formId")
      root = try send(token: token, method: "GET", path: "/forms/\(GoogleFormsProviderActionSupport.path(id))", query: [], body: nil)
      fields = ["semanticReadContract": .string("google-forms-form-structure-v1"), "form": .object(GoogleFormsProviderActionSupport.form(root))]
    case "google_forms_form_create":
      let title = try GoogleFormsProviderActionSupport.text(request.payload["title"], name: "title", maximum: 500)
      let documentTitle = try GoogleFormsProviderActionSupport.optionalText(request.payload["documentTitle"], name: "documentTitle", maximum: 500)
      var info: JSONRecord = ["title": .string(title)]; if let documentTitle { info["documentTitle"] = .string(documentTitle) }
      root = try send(token: token, method: "POST", path: "/forms", query: [URLQueryItem(name: "unpublished", value: "true")], body: ["info": .object(info)])
      fields = ["semanticWriteContract": .string("google-forms-unpublished-create-v1"), "providerMutation": .bool(true), "form": .object(GoogleFormsProviderActionSupport.form(root)), "unpublished": .bool(true)]
    case "google_forms_question_create":
      let id = try GoogleFormsProviderActionSupport.safeId(request.payload["formId"], name: "formId")
      let title = try GoogleFormsProviderActionSupport.text(request.payload["title"], name: "title", maximum: 1000)
      let kind = request.payload["questionType"]?.string ?? "text"; let required = request.payload["required"]?.bool ?? false
      var question: JSONRecord = ["required": .bool(required)]
      if kind == "text" { question["textQuestion"] = .object(["paragraph": .bool(request.payload["paragraph"]?.bool ?? false)]) }
      else if kind == "choice" { question["choiceQuestion"] = .object(["type": .string(try GoogleFormsProviderActionSupport.choiceType(request.payload["choiceType"])), "options": .array(try GoogleFormsProviderActionSupport.options(request.payload["options"])), "shuffle": .bool(false)]) }
      else { throw MarketplaceProviderActionAdapterFailure(code: "google_forms_question_type_not_allowlisted", message: "Forms V1 supports text or choice questions only.") }
      let index = max(0, min(100, Int(request.payload["index"]?.number ?? 0)))
      var body: JSONRecord = ["includeFormInResponse": .bool(false), "requests": .array([.object(["createItem": .object(["item": .object(["title": .string(title), "questionItem": .object(["question": .object(question)])]), "location": .object(["index": .number(Double(index))])])])])]
      if let revision = request.payload["requiredRevisionId"]?.string { body["writeControl"] = .object(["requiredRevisionId": .string(try GoogleFormsProviderActionSupport.safeId(.string(revision), name: "requiredRevisionId"))]) }
      root = try send(token: token, method: "POST", path: "/forms/\(GoogleFormsProviderActionSupport.path(id)):batchUpdate", query: [], body: body)
      fields = ["semanticWriteContract": .string("google-forms-question-create-v1"), "providerMutation": .bool(true), "response": .object(GoogleFormsProviderActionSupport.writeResponse(root))]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_forms_live_action_not_supported", message: "Unsupported live Google Forms action.")
    }
    return GoogleFormsProviderActionClientResult(result: GoogleFormsProviderActionSupport.base("live-forms-api-v1").merging(fields) { _, new in new })
  }
  private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "google-forms", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.grantedScopes == ProviderConnectionService.googleFormsRelayOwnedOAuthScopes, connection.health.diagnostics["appVisibleFormCorpusEnforced"]?.bool == true, connection.health.diagnostics["responsesAccessEnabled"]?.bool == false,
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "google_forms_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "google_forms_connection_not_ready", message: "Google Forms requires a ready exact-scope response-disabled Relay-owned connection.") }
    return try secrets.getSecretValue(ref)
  }
  private func send(token: String, method: String, path: String, query: [URLQueryItem], body: JSONRecord?) throws -> JSONValue {
    var components = URLComponents(string: GoogleFormsProviderActionSupport.apiOrigin + path)!; components.queryItems = query
    guard let url = components.url, url.scheme == "https", url.host == "forms.googleapis.com" else { throw MarketplaceProviderActionAdapterFailure(code: "google_forms_unsafe_url", message: "Unsafe Google Forms API URL.") }
    var request = URLRequest(url: url, timeoutInterval: 30); request.httpMethod = method; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    if let body { request.httpBody = try JSONEncoder().encode(JSONValue.object(body)); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
    let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "google_forms_transport_error", message: "Google Forms returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume()
    guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "google_forms_timeout", message: "Google Forms API request timed out.") }
        let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "google_forms_rate_limited" : "google_forms_api_error", message: "Google Forms API request failed.", providerStatusCode: response.statusCode) }
    guard bytes.count <= 2_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "google_forms_response_too_large", message: "Google Forms response exceeded the 2 MB V1 bound.") }
    return try JSONDecoder().decode(JSONValue.self, from: bytes)
  }
}

public struct GoogleFormsProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = ["google_forms_form_get", "google_forms_update_prepare", "google_forms_form_create", "google_forms_question_create"]
  private let client: any GoogleFormsProviderActionClient
  public init(client: any GoogleFormsProviderActionClient = FakeGoogleFormsProviderActionClient()) { self.client = client }
  public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
    guard request.app.slug == "google-forms", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "google_forms_action_not_allowlisted", message: "Google Forms action is not allowlisted.") }
    let write = ["google_forms_form_create", "google_forms_question_create"].contains(request.definition.actionKey)
    guard write ? request.permission != .blocked : request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "google_forms_permission_denied", message: "Google Forms action is not permitted by the compiled policy.") }
    return MarketplaceProviderActionAdapterResult(result: try client.executeGoogleFormsAction(request: request).result, error: nil, redactionStatus: "responses-identities-answers-grades-files-publish-sharing-excluded")
  }
}

public enum GoogleFormsProviderActionSupport {
  public static let apiOrigin = "https://forms.googleapis.com/v1"
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("google-forms"), "adapterBoundary": .string("google-forms-provider-action-adapter"), "clientMode": .string(mode), "appVisibleFormCorpusEnforced": .bool(true), "responsesAccessEnabled": .bool(false), "respondentDataReturned": .bool(false),
            "wholeDriveDiscovery": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
  static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let value)? = value else { return [:] }; return value }
  static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let value)? = value else { return [] }; return value }
  static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let s): return .string(String(s.prefix(2000))); case .number, .bool, .null: return value; default: return .null } }
    static func safeId(_ value: JSONValue?, name: String) throws -> String {
        guard let text = value?.string, !text.isEmpty, text.count <= 1024, text.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" || $0 == ":" }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "google_forms_invalid_\(name)", message: "Google Forms requires a bounded \(name).")
        }; return text
    }
  static func path(_ value: String) -> String { value.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-_~.:"))) ?? value }
    static func text(_ value: JSONValue?, name: String, maximum: Int) throws -> String {
        guard let text = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty, text.count <= maximum else { throw MarketplaceProviderActionAdapterFailure(code: "google_forms_invalid_\(name)", message: "Google Forms requires a bounded \(name).") }; return text
    }
  static func optionalText(_ value: JSONValue?, name: String, maximum: Int) throws -> String? { guard value != nil else { return nil }; return try text(value, name: name, maximum: maximum) }
    static func choiceType(_ value: JSONValue?) throws -> String {
        let type = value?.string ?? "RADIO"; guard ["RADIO", "CHECKBOX", "DROP_DOWN"].contains(type) else { throw MarketplaceProviderActionAdapterFailure(code: "google_forms_choice_type_not_allowlisted", message: "Choice type must be RADIO, CHECKBOX, or DROP_DOWN.") }; return type
    }
    static func options(_ value: JSONValue?) throws -> [JSONValue] {
        guard case .array(let values)? = value, !values.isEmpty, values.count <= 50 else { throw MarketplaceProviderActionAdapterFailure(code: "google_forms_invalid_options", message: "Choice questions require 1-50 options.") };
        return try values.map { .object(["value": .string(try text($0, name: "option", maximum: 500))]) }
    }
    static func item(_ value: JSONValue?) -> JSONRecord {
        let r = object(value), q = object(object(r["questionItem"])["question"]);
        let kind = q["textQuestion"] != nil ? "text" : q["choiceQuestion"] != nil ? "choice" : q["scaleQuestion"] != nil ? "scale" : q["dateQuestion"] != nil ? "date" : q["timeQuestion"] != nil ? "time" : q["fileUploadQuestion"] != nil ? "file_upload_excluded" : "other";
        let choices = array(object(q["choiceQuestion"])["options"]).prefix(50).map { scalar(object($0)["value"]) };
        return [
            "itemId": scalar(r["itemId"]), "title": scalar(r["title"]), "description": scalar(r["description"]), "questionId": scalar(q["questionId"]), "questionType": .string(kind), "required": scalar(q["required"]), "choices": .array(choices), "gradingReturned": .bool(false),
            "mediaReturned": .bool(false), "fileUploadMetadataReturned": .bool(false),
        ]
    }
    static func form(_ root: JSONValue) -> JSONRecord {
        let r = object(root), info = object(r["info"]), items = array(r["items"]).prefix(100);
        return [
            "formId": scalar(r["formId"]), "title": scalar(info["title"]), "documentTitle": scalar(info["documentTitle"]), "description": scalar(info["description"]), "revisionId": scalar(r["revisionId"]), "items": .array(items.map { .object(item($0)) }), "itemCount": .number(Double(items.count)),
            "responsesReturned": .bool(false), "respondentEmailReturned": .bool(false), "responderUriReturned": .bool(false), "linkedSheetIdReturned": .bool(false), "publishSettingsReturned": .bool(false),
        ]
    }
  static func preview(_ payload: JSONRecord) -> JSONRecord { ["formId": payload["formId"] ?? .null, "operation": payload["operation"] ?? .null, "title": payload["title"] ?? .null, "providerMutation": .bool(false)] }
    static func validatedPreview(_ payload: JSONRecord) throws -> JSONRecord {
        let operation = try text(payload["operation"], name: "operation", maximum: 32);
        guard ["form_create", "question_create"].contains(operation) else { throw MarketplaceProviderActionAdapterFailure(code: "google_forms_operation_not_allowlisted", message: "Only form_create and question_create may be prepared.") };
        if operation == "question_create" { _ = try safeId(payload["formId"], name: "formId") }; _ = try text(payload["title"], name: "title", maximum: 1000); return preview(payload)
    }
    static func writeResponse(_ root: JSONValue) -> JSONRecord {
        let r = object(root), replies = array(r["replies"]).prefix(20);
        return ["replyCount": .number(Double(replies.count)), "createdItemId": scalar(object(object(replies.first)["createItem"])["itemId"]), "requiredRevisionId": scalar(object(r["writeControl"])["requiredRevisionId"]), "formReturned": .bool(false)]
    }
    public static func fakeForm() -> JSONRecord {
        [
            "formId": .string("relay-form-101"), "title": .string("Relay intake"), "documentTitle": .string("Relay intake"), "description": .string("Bounded intake form"), "revisionId": .string("rev-1"),
            "items": .array([
                .object([
                    "itemId": .string("item-1"), "title": .string("Project name"), "description": .null, "questionId": .string("question-1"), "questionType": .string("text"), "required": .bool(true), "choices": .array([]), "gradingReturned": .bool(false), "mediaReturned": .bool(false),
                    "fileUploadMetadataReturned": .bool(false),
                ])
            ]), "itemCount": .number(1), "responsesReturned": .bool(false), "respondentEmailReturned": .bool(false), "responderUriReturned": .bool(false), "linkedSheetIdReturned": .bool(false), "publishSettingsReturned": .bool(false),
        ]
    }
}
