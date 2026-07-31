import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct RuntimeActivityPanel: View {
  let projection: RuntimeActivityProjection
  var streamingFallbackText: String? = nil
  let isActive: Bool
  var startedAt: IsoTimestamp? = nil

  var streamingText: String? {
    guard let text = projection.draftText ?? streamingFallbackText, !text.isEmpty else {
      return nil
    }
    return text
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      if !projection.tasks.isEmpty {
        RuntimeTaskListPanel(tasks: projection.tasks)
      } else if streamingText == nil, isActive {
        RuntimeThinkingBubble(startedAt: startedAt)
      }
      if let streamingText {
        RuntimeStreamingResponseView(text: streamingText, isActive: isActive)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct RuntimeLiveUpdateHeader: View {
  let startedAt: IsoTimestamp?
  let isWaitingForUser: Bool

  var body: some View {
    TimelineView(.animation(minimumInterval: 1)) { context in
      let pulseIsExpanded = Int(context.date.timeIntervalSinceReferenceDate) % 2 == 0
      HStack(spacing: 7) {
        ZStack {
          Circle()
            .fill(RCTheme.chatAccent.opacity(0.2))
            .frame(width: 13, height: 13)
            .scaleEffect(pulseIsExpanded ? 1.15 : 0.82)
          Circle()
            .fill(RCTheme.chatAccent)
            .frame(width: 6, height: 6)
        }
        Text(isWaitingForUser ? "ACTION NEEDED" : "LIVE UPDATE")
          .font(.caption2.weight(.bold))
          .tracking(1.1)
          .foregroundStyle(RCTheme.chatAccent)
        if let elapsed = elapsedLabel(since: startedAt, now: context.date) {
          Image(systemName: "clock")
            .font(.caption2)
            .foregroundStyle(RCTheme.chatMuted)
          Text(elapsed)
            .font(.caption2.monospacedDigit())
            .foregroundStyle(RCTheme.chatMuted)
        }
      }
      .accessibilityElement(children: .combine)
      .accessibilityLabel(
        isWaitingForUser ? "Action needed" : "Live update, agent is still working")
    }
  }
}

struct RuntimeThinkingBubble: View {
  let startedAt: IsoTimestamp?

  var body: some View {
    TimelineView(.animation(minimumInterval: 0.24)) { context in
      let tick = Int(context.date.timeIntervalSinceReferenceDate / 0.24)
      HStack(spacing: 9) {
        HStack(spacing: 4) {
          ForEach(0..<3, id: \.self) { index in
            Circle()
              .fill(RCTheme.chatAccent)
              .frame(width: 6, height: 6)
              .scaleEffect((tick + index) % 3 == 0 ? 1.0 : 0.72)
              .opacity((tick + index) % 3 == 0 ? 1.0 : 0.42)
          }
        }
        Text("Thinking")
          .font(.callout.weight(.semibold))
          .foregroundStyle(RCTheme.chatText)
        if let elapsed = elapsedLabel(since: startedAt, now: context.date) {
          Text(elapsed)
            .font(.caption.monospacedDigit())
            .foregroundStyle(RCTheme.chatMuted)
        }
      }
      .padding(.horizontal, 12)
      .frame(height: 34)
      .background(RCTheme.chatComposer.opacity(0.58))
      .clipShape(Capsule())
      .overlay(Capsule().stroke(RCTheme.chatComposerBorder.opacity(0.58)))
      .accessibilityElement(children: .combine)
      .accessibilityLabel("Agent is thinking")
    }
  }
}

struct RuntimeStreamingResponseView: View {
  let text: String
  let isActive: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      Text(isActive ? "INTERIM COMMENTARY" : "PARTIAL RESPONSE")
        .font(.caption2.weight(.bold))
        .tracking(0.9)
        .foregroundStyle(RCTheme.chatAccent.opacity(0.82))
      RelayMarkdownView(markdown: text)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(10)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RCTheme.chatCanvas.opacity(0.42))
    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 8, style: .continuous)
        .stroke(RCTheme.chatAccent.opacity(0.13))
    )
    .accessibilityElement(children: .contain)
    .accessibilityLabel(isActive ? "Interim agent commentary" : "Partial agent response")
  }
}

private enum RuntimeMissionStepState {
  case done
  case active
  case pending
  case blocked
}

private struct RuntimeMissionStep: Identifiable {
  let id: String
  let title: String
  let detail: String?
  let state: RuntimeMissionStepState
}

private struct RuntimeMissionSummary {
  let title: String
  let currentStep: String
  let needsUser: String
  let lastActivity: String?
  let lastUpdatedAt: IsoTimestamp?
  let steps: [RuntimeMissionStep]

  init(projection: RuntimeActivityProjection, fallbackDetail: String?) {
    let text = RuntimeMissionSummary.searchText(
      projection: projection, fallbackDetail: fallbackDetail)
    if text.localizedCaseInsensitiveContains("google-docs")
      || text.localizedCaseInsensitiveContains("google docs")
      || text.localizedCaseInsensitiveContains("docs.googleapis.com")
    {
      self = RuntimeMissionSummary.googleDocs(projection: projection, text: text)
    } else {
      self = RuntimeMissionSummary.generic(
        projection: projection, fallbackDetail: fallbackDetail, text: text)
    }
  }

  private init(
    title: String, currentStep: String, needsUser: String, lastActivity: String?,
    lastUpdatedAt: IsoTimestamp?, steps: [RuntimeMissionStep]
  ) {
    self.title = title
    self.currentStep = currentStep
    self.needsUser = needsUser
    self.lastActivity = lastActivity
    self.lastUpdatedAt = lastUpdatedAt
    self.steps = steps
  }

  private static func googleDocs(projection: RuntimeActivityProjection, text: String)
    -> RuntimeMissionSummary
  {
    let checkedConnection = hasTool(projection, named: "relay_console_google_docs_status")
    let openedSetup =
      hasSuccessfulTool(projection, named: "relay_console_google_docs_open_setup")
      || containsAny(text, ["console.cloud.google.com", "docs.googleapis.com"])
    let foundCredentialsPage = contains(text, "console.cloud.google.com/apis/credentials")
    let foundOAuthClient = containsAny(
      text, ["Desktop client 1", "OAuth 2.0 Client IDs", "oauth client"])
    let openedPlayground = containsAny(text, ["oauthplayground", "OAuth Playground"])
    let createdConsentURL = hasSuccessfulTool(
      projection, named: "relay_console_google_docs_oauth_authorization_url")
    let exchangedCode = hasSuccessfulTool(
      projection, named: "relay_console_google_docs_exchange_auth_code")
    let savedWithTool = hasSuccessfulTool(
      projection, named: "relay_console_google_docs_save_oauth_credentials")
    let savedCredentials = exchangedCode || savedWithTool
    let exchangeFailed = hasFailedTool(
      projection, named: "relay_console_google_docs_exchange_auth_code")
    let saveFailed = hasFailedTool(
      projection, named: "relay_console_google_docs_save_oauth_credentials")
    let latestFailure = toolFailureMessage(
      projection,
      names: [
        "relay_console_google_docs_exchange_auth_code",
        "relay_console_google_docs_save_oauth_credentials",
      ])
    let testedConnection = savedCredentials && googleDocsStatusConnected(projection)
    let blockedByGoogle = containsAny(
      text, ["Choose an account", "Sign in", "Use your Google Account", "403", "access blocked"])
    let activeTool = projection.items.last(where: { $0.phase == .running })?.toolName
    let hasBrowserSnapshot = hasTool(projection, named: "browser_snapshot")
    let currentStep: String
    if exchangeFailed || saveFailed {
      currentStep = latestFailure ?? "Google Docs credentials were not saved."
    } else if blockedByGoogle {
      currentStep =
        hasBrowserSnapshot
        ? "Google login or consent is needed in the browser."
        : "Google login is needed, but Relay has not exposed a browser page."
    } else if !checkedConnection {
      currentStep = "Checking whether Google Docs is already connected."
    } else if !foundCredentialsPage {
      currentStep = "Opening the Google Cloud Credentials page."
    } else if !foundOAuthClient {
      currentStep = "Looking for an existing OAuth desktop client."
    } else if !createdConsentURL {
      currentStep = "Creating a Google consent URL from the Desktop client."
    } else if !savedCredentials {
      currentStep = "Waiting for the Google authorization code, then exchanging it securely."
    } else if !testedConnection {
      currentStep = "Testing the saved Google Docs connection."
    } else {
      currentStep = "Google Docs is connected."
    }
    let needsUser: String
    if exchangeFailed || saveFailed {
      needsUser =
        "Retry from the current Google Cloud page, or manually add the client ID, client secret, and refresh token here."
    } else if blockedByGoogle {
      needsUser =
        hasBrowserSnapshot
        ? "Complete the visible Google login or consent page, then tell the agent to continue."
        : "No Google browser page is available. Cancel this run and retry after Relay opens the Google page."
    } else if activeTool == "browser_snapshot" {
      needsUser = "No action needed unless the browser is asking you to sign in or approve access."
    } else {
      needsUser = "No action needed right now."
    }
    return RuntimeMissionSummary(
      title: "Connecting Google Docs",
      currentStep: currentStep,
      needsUser: needsUser,
      lastActivity: humanLastActivity(projection),
      lastUpdatedAt: projection.updatedAt,
      steps: [
        RuntimeMissionStep(
          id: "check-connection",
          title: "Check Relay Google Docs connection",
          detail: checkedConnection ? "Relay reported Google Docs is not connected yet." : nil,
          state: checkedConnection ? .done : .active
        ),
        RuntimeMissionStep(
          id: "open-google-cloud",
          title: "Open Google Cloud setup",
          detail: openedSetup ? "Google Cloud setup pages were opened or inspected." : nil,
          state: state(done: openedSetup, active: checkedConnection && !openedSetup)
        ),
        RuntimeMissionStep(
          id: "credentials-page",
          title: "Reach the Credentials page",
          detail: foundCredentialsPage ? "The Google Cloud Credentials page is visible." : nil,
          state: state(
            done: foundCredentialsPage, active: openedSetup && !foundCredentialsPage,
            blocked: blockedByGoogle && !foundCredentialsPage)
        ),
        RuntimeMissionStep(
          id: "oauth-client",
          title: "Find or create OAuth desktop client",
          detail: foundOAuthClient
            ? "Found an OAuth desktop client, likely Desktop client 1." : nil,
          state: state(done: foundOAuthClient, active: foundCredentialsPage && !foundOAuthClient)
        ),
        RuntimeMissionStep(
          id: "refresh-token",
          title: "Generate Google consent URL",
          detail: createdConsentURL
            ? "Relay created the Google consent URL for the Desktop client."
            : (openedPlayground
              ? "OAuth Playground was opened, but Relay can now use its own OAuth exchange tool."
              : "Needs Google OAuth consent before Relay can save the connection."),
          state: state(
            done: createdConsentURL, active: foundOAuthClient && !createdConsentURL,
            blocked: blockedByGoogle && foundOAuthClient)
        ),
        RuntimeMissionStep(
          id: "exchange-code",
          title: "Exchange authorization code",
          detail: exchangedCode
            ? "Relay exchanged the authorization code and stored the refresh token securely."
            : (exchangeFailed
              ? latestFailure
              : "After Google consent, Relay needs the authorization code from the browser URL."),
          state: state(
            done: exchangedCode, active: createdConsentURL && !exchangedCode && !exchangeFailed,
            blocked: exchangeFailed || (blockedByGoogle && createdConsentURL))
        ),
        RuntimeMissionStep(
          id: "save-credentials",
          title: "Save credentials securely",
          detail: savedCredentials
            ? "Credentials were saved through Relay's secure connection store."
            : (saveFailed
              ? latestFailure
              : "Client ID, client secret, and refresh token still need to be saved."),
          state: state(
            done: savedCredentials, active: exchangedCode && !savedCredentials && !saveFailed,
            blocked: saveFailed)
        ),
        RuntimeMissionStep(
          id: "test-connection",
          title: "Test Google Docs connection",
          detail: testedConnection ? "Google Docs is connected." : nil,
          state: state(done: testedConnection, active: savedCredentials && !testedConnection)
        ),
      ]
    )
  }

  private static func generic(
    projection: RuntimeActivityProjection, fallbackDetail: String?, text: String
  ) -> RuntimeMissionSummary {
    let runningTool = projection.items.last { $0.kind == .tool && $0.phase == .running }
    let latestReadable =
      runningTool.map(humanToolTitle)
      ?? projection.tasks.first(where: { $0.status == .inProgress })?.content
      ?? fallbackDetail
      ?? "Working on the request."
    let completedTools = projection.items.filter { $0.kind == .tool && $0.phase == .completed }
      .count
    let runningTools = projection.items.filter { $0.kind == .tool && $0.phase == .running }.count
    let needsUser =
      containsAny(text, ["sign in", "login", "authorize", "allow access", "consent"])
      ? "Complete the login or approval step in the browser, then tell the agent to continue."
      : "No action needed right now."
    return RuntimeMissionSummary(
      title: "Working on your request",
      currentStep: latestReadable,
      needsUser: needsUser,
      lastActivity: humanLastActivity(projection),
      lastUpdatedAt: projection.updatedAt,
      steps: [
        RuntimeMissionStep(
          id: "started", title: "Start runtime", detail: "The agent run has started.", state: .done),
        RuntimeMissionStep(
          id: "tools",
          title: "Use tools",
          detail: "\(completedTools) completed, \(runningTools) running",
          state: runningTools > 0 ? .active : (completedTools > 0 ? .done : .pending)
        ),
        RuntimeMissionStep(id: "reply", title: "Return answer", detail: nil, state: .pending),
      ]
    )
  }

  private static func state(done: Bool, active: Bool, blocked: Bool = false)
    -> RuntimeMissionStepState
  {
    if done { return .done }
    if blocked { return .blocked }
    if active { return .active }
    return .pending
  }

  private static func searchText(projection: RuntimeActivityProjection, fallbackDetail: String?)
    -> String
  {
    let itemText = projection.items.map { item in
      [
        item.title,
        item.summary,
        item.toolName,
        encodeJSONRecord(item.detail),
        item.result.map(encodeJSONRecord),
        item.error.map(encodeJSONRecord),
      ].compactMap { $0 }.joined(separator: " ")
    }
    return ([fallbackDetail, projection.lastEventType] + itemText).compactMap { $0 }.joined(
      separator: " ")
  }

  private static func contains(_ text: String, _ needle: String) -> Bool {
    text.range(of: needle, options: [.caseInsensitive, .diacriticInsensitive]) != nil
  }

  private static func containsAny(_ text: String, _ needles: [String]) -> Bool {
    needles.contains { contains(text, $0) }
  }

  private static func hasTool(_ projection: RuntimeActivityProjection, named name: String) -> Bool {
    projection.items.contains { $0.toolName == name }
  }

  private static func hasSuccessfulTool(_ projection: RuntimeActivityProjection, named name: String)
    -> Bool
  {
    projection.items.contains { item in
      guard item.toolName == name, item.phase == .completed, item.error == nil else { return false }
      return boolValue(item.result?["ok"]) == true
    }
  }

  private static func hasFailedTool(_ projection: RuntimeActivityProjection, named name: String)
    -> Bool
  {
    projection.items.contains { item in
      guard item.toolName == name else { return false }
      if item.phase == .failed || item.error != nil { return true }
      if let result = item.result, boolValue(result["ok"]) == false { return true }
      return false
    }
  }

  private static func googleDocsStatusConnected(_ projection: RuntimeActivityProjection) -> Bool {
    projection.items.contains { item in
      guard item.toolName == "relay_console_google_docs_status",
        item.phase == .completed,
        item.error == nil,
        let result = item.result
      else { return false }
      return boolValue(result["connected"]) == true
        || stringValue(result["connectionState"]) == "connected"
        || stringValue(result["status"]) == "connected"
    }
  }

  private static func toolFailureMessage(_ projection: RuntimeActivityProjection, names: [String])
    -> String?
  {
    let nameSet = Set(names)
    guard
      let item = projection.items.last(where: { item in
        guard let toolName = item.toolName, nameSet.contains(toolName) else { return false }
        return item.phase == .failed || item.error != nil || boolValue(item.result?["ok"]) == false
      })
    else {
      return nil
    }
    if let message = stringValue(item.error?["message"])?.nilIfEmpty {
      return message
    }
    if let message = stringValue(item.result?["message"])?.nilIfEmpty {
      return message
    }
    return "The Google Docs credential step did not complete, so no connection was saved."
  }

  private static func humanLastActivity(_ projection: RuntimeActivityProjection) -> String? {
    guard let item = projection.items.last(where: { $0.updatedAt != nil }) else {
      return projection.lastEventType.map { "Received \($0)." }
    }
    switch item.kind {
    case .tool:
      return "\(humanToolTitle(item))."
    case .context:
      return "Loaded runtime context."
    case .thinking:
      return "The agent is reasoning."
    case .status, .terminal:
      return item.summary ?? item.title
    case .message:
      return "Drafted response text."
    case .taskList:
      return "Updated the task checklist."
    case .toolGroup:
      return "Updated tool activity."
    case .unknown:
      return item.summary ?? item.title
    }
  }

  private static func humanToolTitle(_ item: RuntimeActivityItem) -> String {
    switch item.toolName ?? item.title {
    case "skill_view":
      return "Reading the Google Docs connection skill"
    case "relay_console_google_docs_status":
      return "Checking Relay's Google Docs connection"
    case "relay_console_google_docs_open_setup":
      return "Opening Google Docs setup pages"
    case "relay_console_google_docs_oauth_authorization_url":
      return "Creating the Google consent URL"
    case "relay_console_google_docs_exchange_auth_code":
      return "Exchanging the Google authorization code"
    case "relay_console_google_docs_save_oauth_credentials":
      return "Saving Google Docs credentials securely"
    case "browser_snapshot":
      return "Inspecting the browser page"
    case "browser_navigate":
      return "Opening a browser page"
    case "terminal":
      return "Running a local helper"
    default:
      return item.summary ?? item.title
    }
  }
}

private struct RuntimeMissionProgressPanel: View {
  let mission: RuntimeMissionSummary
  let isActive: Bool
  let onCancel: (() -> Void)?

  var body: some View {
    TimelineView(.periodic(from: Date(), by: 1)) { context in
      let secondsSinceUpdate = intervalSeconds(since: mission.lastUpdatedAt, now: context.date)
      let isStale = isActive && (secondsSinceUpdate ?? 0) >= 60
      VStack(alignment: .leading, spacing: 12) {
        HStack(alignment: .top, spacing: 12) {
          Image(
            systemName: isStale
              ? "exclamationmark.triangle.fill" : "point.3.connected.trianglepath.dotted"
          )
          .font(.system(size: 19, weight: .semibold))
          .foregroundStyle(isStale ? RCTheme.accentAmber : RCTheme.accentBlue)
          .frame(width: 24, height: 24)
          VStack(alignment: .leading, spacing: 4) {
            Text(mission.title)
              .font(.callout.weight(.bold))
              .foregroundStyle(RCTheme.text)
            Text(
              isStale ? "No new agent activity. This run is probably stuck." : mission.currentStep
            )
            .font(.callout)
            .foregroundStyle(RCTheme.text)
            .lineLimit(3)
          }
          Spacer(minLength: 8)
          StatusBadge(
            title: isStale ? "Stuck" : (isActive ? "Working" : "Idle"),
            tone: isStale ? .amber : (isActive ? .blue : .neutral),
            accessibilityLabelText: isStale
              ? "Mission appears stuck" : (isActive ? "Mission working" : "Mission idle")
          )
        }

        if isStale {
          RuntimeStaleRunNotice(
            secondsSinceUpdate: secondsSinceUpdate, detail: mission.needsUser, onCancel: onCancel)
        }

        RuntimeNeedsUserRow(text: mission.needsUser)

        VStack(alignment: .leading, spacing: 8) {
          ForEach(mission.steps) { step in
            RuntimeMissionStepRow(step: step)
          }
        }

        if let lastActivity = mission.lastActivity {
          HStack(spacing: 7) {
            Image(systemName: "clock")
              .font(.caption.weight(.semibold))
              .foregroundStyle(RCTheme.muted)
            Text("Last activity: \(lastActivity)")
              .font(.caption)
              .foregroundStyle(RCTheme.muted)
              .lineLimit(2)
          }
        }
      }
      .padding(12)
      .background(RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 5))
      .overlay(
        RoundedRectangle(cornerRadius: 5).stroke(
          (isStale ? RCTheme.accentAmber : RCTheme.accentBlue).opacity(0.30))
      )
      .accessibilityElement(children: .contain)
    }
  }
}

struct RuntimeStaleRunNotice: View {
  let secondsSinceUpdate: Int?
  let detail: String
  let onCancel: (() -> Void)?

  var body: some View {
    HStack(alignment: .top, spacing: 8) {
      Image(systemName: "timer")
        .font(.callout.weight(.semibold))
        .foregroundStyle(RCTheme.accentAmber)
        .frame(width: 18)
      VStack(alignment: .leading, spacing: 3) {
        Text("This is taking too long")
          .font(.callout.weight(.bold))
          .foregroundStyle(RCTheme.accentAmber)
        Text(staleText)
          .font(.callout)
          .foregroundStyle(RCTheme.text)
          .lineLimit(2)
        Text(detail)
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
          .lineLimit(3)
      }
      Spacer(minLength: 8)
      if let onCancel {
        Button {
          onCancel()
        } label: {
          Label("Cancel run", systemImage: "xmark.circle")
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .help("Cancel this stuck runtime dispatch")
        .accessibilityLabel("Cancel stuck runtime dispatch")
      }
    }
    .padding(9)
    .background(RCTheme.accentAmber.opacity(0.10))
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.accentAmber.opacity(0.30)))
  }

  var staleText: String {
    let label =
      secondsSinceUpdate.map { seconds in
        seconds < 60 ? "\(seconds)s" : "\(seconds / 60)m \(seconds % 60)s"
      } ?? "a while"
    return "There has been no meaningful update for \(label)."
  }
}

struct RuntimeNeedsUserRow: View {
  let text: String

  var needsAction: Bool {
    !text.localizedCaseInsensitiveContains("No action needed")
  }

  var body: some View {
    HStack(alignment: .top, spacing: 8) {
      Image(systemName: needsAction ? "hand.raised.fill" : "checkmark.shield.fill")
        .font(.caption.weight(.semibold))
        .foregroundStyle(needsAction ? RCTheme.accentAmber : RCTheme.accentGreen)
        .frame(width: 16)
      VStack(alignment: .leading, spacing: 2) {
        Text("Needs you")
          .font(.caption.weight(.bold))
          .foregroundStyle(needsAction ? RCTheme.accentAmber : RCTheme.muted)
        Text(text)
          .font(.callout)
          .foregroundStyle(needsAction ? RCTheme.text : RCTheme.muted)
          .lineLimit(3)
      }
      Spacer(minLength: 8)
    }
    .padding(8)
    .background((needsAction ? RCTheme.accentAmber : RCTheme.accentGreen).opacity(0.08))
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(
      RoundedRectangle(cornerRadius: 4).stroke(
        (needsAction ? RCTheme.accentAmber : RCTheme.accentGreen).opacity(0.24)))
  }
}

private struct RuntimeMissionStepRow: View {
  let step: RuntimeMissionStep

  var body: some View {
    HStack(alignment: .top, spacing: 8) {
      Image(systemName: iconName)
        .font(.callout.weight(.semibold))
        .foregroundStyle(tone.color)
        .frame(width: 18)
      VStack(alignment: .leading, spacing: 2) {
        Text(step.title)
          .font(.callout.weight(step.state == .active ? .semibold : .regular))
          .foregroundStyle(step.state == .pending ? RCTheme.muted : RCTheme.text)
          .lineLimit(2)
        if let detail = step.detail, !detail.isEmpty {
          Text(detail)
            .font(.caption)
            .foregroundStyle(RCTheme.muted)
            .lineLimit(2)
        }
      }
      Spacer(minLength: 8)
    }
  }

  var iconName: String {
    switch step.state {
    case .done:
      return "checkmark.circle.fill"
    case .active:
      return "arrow.triangle.2.circlepath"
    case .pending:
      return "circle"
    case .blocked:
      return "exclamationmark.circle.fill"
    }
  }

  var tone: ComponentTone {
    switch step.state {
    case .done:
      return .green
    case .active:
      return .blue
    case .pending:
      return .neutral
    case .blocked:
      return .amber
    }
  }
}

struct RuntimeLiveActivityMetaView: View {
  let startedAt: IsoTimestamp?
  let updatedAt: IsoTimestamp?
  let lastEventType: String?

  var body: some View {
    TimelineView(.periodic(from: Date(), by: 1)) { context in
      let elapsed = elapsedLabel(since: startedAt, now: context.date)
      let silence = elapsedLabel(since: updatedAt, now: context.date)
      let secondsSinceUpdate = intervalSeconds(since: updatedAt, now: context.date)
      let isStale = (secondsSinceUpdate ?? 0) >= 45

      HStack(spacing: 8) {
        Image(systemName: isStale ? "exclamationmark.circle" : "pulse")
          .font(.caption2.weight(.semibold))
          .foregroundStyle(isStale ? RCTheme.accentAmber : RCTheme.accentBlue)
        Text(metaText(elapsed: elapsed, silence: silence, isStale: isStale))
          .font(.caption2.monospacedDigit())
          .foregroundStyle(isStale ? RCTheme.accentAmber : RCTheme.muted)
          .lineLimit(2)
        if let lastEventType, !lastEventType.isEmpty {
          StatusBadge(
            title: lastEventType,
            tone: isStale ? .amber : .neutral,
            accessibilityLabelText: "Last runtime event \(lastEventType)"
          )
        }
      }
      .padding(.top, 1)
      .accessibilityElement(children: .combine)
      .accessibilityLabel(metaText(elapsed: elapsed, silence: silence, isStale: isStale))
    }
  }

  private func metaText(elapsed: String?, silence: String?, isStale: Bool) -> String {
    var parts: [String] = []
    if let elapsed {
      parts.append("Working \(elapsed)")
    } else {
      parts.append("Working")
    }
    if let silence {
      parts.append(isStale ? "No new activity for \(silence)" : "Last update \(silence) ago")
    } else {
      parts.append("Waiting for first runtime update")
    }
    return parts.joined(separator: " · ")
  }
}

struct RuntimeTaskListPanel: View {
  let tasks: [RuntimeActivityTask]

  var activeTask: RuntimeActivityTask? {
    tasks.first { $0.status == .inProgress }
      ?? tasks.first { $0.status == .pending }
      ?? tasks.last
  }

  var completedCount: Int {
    tasks.filter { $0.status == .completed }.count
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      HStack(spacing: 8) {
        RuntimePhaseIcon(phase: activeTask?.status == .completed ? .completed : .running)
        Text(activeTask?.content ?? "Task list")
          .font(.caption.weight(.semibold))
          .foregroundStyle(RCTheme.text)
          .lineLimit(2)
        Spacer(minLength: 8)
        StatusBadge(
          title: "\(completedCount)/\(tasks.count)",
          tone: completedCount == tasks.count ? .green : .blue,
          accessibilityLabelText: "\(completedCount) of \(tasks.count) tasks completed"
        )
      }
      VStack(alignment: .leading, spacing: 5) {
        ForEach(tasks) { task in
          HStack(alignment: .firstTextBaseline, spacing: 8) {
            RuntimeTaskStatusIcon(status: task.status)
            Text(task.content)
              .font(.caption)
              .foregroundStyle(task.status == .completed ? RCTheme.muted : RCTheme.text)
              .lineLimit(2)
            Spacer(minLength: 6)
          }
        }
      }
    }
    .padding(9)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.accentBlue.opacity(0.24)))
    .accessibilityElement(children: .combine)
    .accessibilityLabel("Runtime task list, \(completedCount) of \(tasks.count) completed")
  }
}

struct RuntimeToolGroupRow: View {
  let group: RuntimeActivityToolGroup
  let items: [RuntimeActivityItem]
  let isExpanded: Bool
  let toggle: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      HStack(spacing: 8) {
        RuntimePhaseIcon(phase: group.phase)
        VStack(alignment: .leading, spacing: 2) {
          Text(group.title)
            .font(.caption.weight(.semibold))
            .foregroundStyle(RCTheme.text)
          if let summary = group.summary {
            Text(summary)
              .font(.caption2)
              .foregroundStyle(RCTheme.muted)
              .lineLimit(1)
          }
        }
        Spacer(minLength: 8)
        if let duration = runtimeActivityDurationLabel(group.durationMs) {
          Text(duration)
            .font(.caption2.monospacedDigit())
            .foregroundStyle(RCTheme.muted)
        }
        StatusBadge(
          title: runtimeActivityPhaseLabel(group.phase),
          tone: runtimeActivityPhaseTone(group.phase),
          accessibilityLabelText: "Tool group \(runtimeActivityPhaseLabel(group.phase))"
        )
        Button(action: toggle) {
          Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
        }
        .buttonStyle(MessageIconButtonStyle())
        .help(isExpanded ? "Hide tool details" : "Show tool details")
        .accessibilityLabel(isExpanded ? "Hide tool details" : "Show tool details")
      }
      if isExpanded {
        VStack(alignment: .leading, spacing: 6) {
          ForEach(items) { item in
            RuntimeActivityRow(item: item, compact: true)
          }
        }
      }
    }
    .padding(9)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(
      RoundedRectangle(cornerRadius: 4).stroke(
        runtimeActivityPhaseTone(group.phase).color.opacity(0.30))
    )
    .accessibilityElement(children: .contain)
  }
}

struct RuntimeActivityRow: View {
  let item: RuntimeActivityItem
  var compact: Bool = false
  @State private var isExpanded = false

  var detailText: String? {
    runtimeActivityDetailText(item)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .top, spacing: 8) {
        RuntimePhaseIcon(phase: item.phase, iconName: runtimeActivityKindIcon(item.kind))
          .padding(.top, 1)
        VStack(alignment: .leading, spacing: 2) {
          Text(item.title)
            .font(.caption.weight(.semibold))
            .foregroundStyle(RCTheme.text)
            .lineLimit(2)
          if let summary = item.summary {
            Text(summary)
              .font(.caption2)
              .foregroundStyle(RCTheme.muted)
              .lineLimit(compact ? 2 : 3)
              .textSelection(.enabled)
          }
        }
        Spacer(minLength: 8)
        if let duration = runtimeActivityDurationLabel(item.durationMs) {
          Text(duration)
            .font(.caption2.monospacedDigit())
            .foregroundStyle(RCTheme.muted)
        }
        StatusBadge(
          title: runtimeActivityPhaseLabel(item.phase),
          tone: runtimeActivityPhaseTone(item.phase),
          accessibilityLabelText: "\(item.title) \(runtimeActivityPhaseLabel(item.phase))"
        )
        if detailText != nil {
          Button {
            isExpanded.toggle()
          } label: {
            Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
          }
          .buttonStyle(MessageIconButtonStyle())
          .help(isExpanded ? "Hide runtime detail" : "Show runtime detail")
          .accessibilityLabel(isExpanded ? "Hide runtime detail" : "Show runtime detail")
        }
      }
      if isExpanded, let detailText {
        Text(detailText)
          .font(.system(size: 11, design: .monospaced))
          .foregroundStyle(RCTheme.muted)
          .textSelection(.enabled)
          .lineLimit(12)
          .padding(8)
          .frame(maxWidth: .infinity, alignment: .leading)
          .background(Color.black.opacity(0.12))
          .clipShape(RoundedRectangle(cornerRadius: 4))
          .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
      }
    }
    .padding(compact ? 7 : 9)
    .background(compact ? Color.white.opacity(0.02) : RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
    .accessibilityElement(children: .combine)
  }
}

struct RuntimeDraftTextView: View {
  let text: String

  var body: some View {
    Text(text)
      .font(.caption)
      .lineSpacing(2)
      .foregroundStyle(RCTheme.text)
      .textSelection(.enabled)
      .padding(9)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(Color.white.opacity(0.025))
      .clipShape(RoundedRectangle(cornerRadius: 4))
      .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
      .accessibilityLabel("Runtime draft response")
  }
}

struct RuntimePhaseIcon: View {
  let phase: RuntimeActivityPhase
  var iconName: String? = nil

  var body: some View {
    Group {
      if phase == .running {
        ProgressView()
          .controlSize(.small)
      } else {
        Image(systemName: iconName ?? runtimeActivityPhaseIcon(phase))
          .font(.system(size: 13, weight: .semibold))
      }
    }
    .foregroundStyle(runtimeActivityPhaseTone(phase).color)
    .frame(width: 18, height: 18)
    .accessibilityHidden(true)
  }
}

struct RuntimeTaskStatusIcon: View {
  let status: RuntimeActivityTaskStatus

  var phase: RuntimeActivityPhase {
    switch status {
    case .pending:
      return .pending
    case .inProgress:
      return .running
    case .completed:
      return .completed
    case .cancelled:
      return .cancelled
    case .unknown:
      return .unknown
    }
  }

  var body: some View {
    RuntimePhaseIcon(phase: phase)
      .frame(width: 16, height: 16)
  }
}

func runtimeActivityPhaseTone(_ phase: RuntimeActivityPhase) -> ComponentTone {
  switch phase {
  case .pending:
    return .neutral
  case .running:
    return .blue
  case .completed:
    return .green
  case .failed:
    return .red
  case .cancelled:
    return .amber
  case .unknown:
    return .neutral
  }
}

func runtimeActivityPhaseLabel(_ phase: RuntimeActivityPhase) -> String {
  switch phase {
  case .pending:
    return "Pending"
  case .running:
    return "Running"
  case .completed:
    return "Done"
  case .failed:
    return "Failed"
  case .cancelled:
    return "Cancelled"
  case .unknown:
    return "Unknown"
  }
}

func runtimeActivityPhaseIcon(_ phase: RuntimeActivityPhase) -> String {
  switch phase {
  case .pending:
    return "circle"
  case .running:
    return "arrow.triangle.2.circlepath"
  case .completed:
    return "checkmark.circle.fill"
  case .failed:
    return "exclamationmark.triangle.fill"
  case .cancelled:
    return "xmark.circle.fill"
  case .unknown:
    return "questionmark.circle"
  }
}

func runtimeActivityKindIcon(_ kind: RuntimeActivityKind) -> String {
  switch kind {
  case .message:
    return "text.bubble"
  case .thinking:
    return "sparkle.magnifyingglass"
  case .status:
    return "waveform.path.ecg"
  case .tool:
    return "terminal"
  case .toolGroup:
    return "square.stack.3d.up"
  case .taskList:
    return "checklist"
  case .context:
    return "gauge.with.dots.needle.50percent"
  case .terminal:
    return "play.circle"
  case .unknown:
    return "questionmark.circle"
  }
}

func runtimeActivityDurationLabel(_ durationMs: Int?) -> String? {
  guard let durationMs else { return nil }
  if durationMs < 1_000 {
    return "\(durationMs)ms"
  }
  let seconds = Double(durationMs) / 1_000
  return String(format: "%.1fs", seconds)
}

func elapsedLabel(since timestamp: IsoTimestamp?, now: Date) -> String? {
  guard let date = relayConsoleDate(from: timestamp) else { return nil }
  let seconds = max(0, Int(now.timeIntervalSince(date)))
  if seconds < 60 {
    return "\(seconds)s"
  }
  let minutes = seconds / 60
  let remainder = seconds % 60
  if minutes < 60 {
    return "\(minutes)m \(remainder)s"
  }
  let hours = minutes / 60
  let minuteRemainder = minutes % 60
  return "\(hours)h \(minuteRemainder)m"
}

func intervalSeconds(since timestamp: IsoTimestamp?, now: Date) -> Int? {
  guard let date = relayConsoleDate(from: timestamp) else { return nil }
  return max(0, Int(now.timeIntervalSince(date)))
}

func relayConsoleDate(from timestamp: IsoTimestamp?) -> Date? {
  guard let timestamp else { return nil }
  return ISO8601DateFormatter.relayConsole.date(from: timestamp)
    ?? ISO8601DateFormatter().date(from: timestamp)
}

func runtimeActivityDetailText(_ item: RuntimeActivityItem) -> String? {
  let sections = [
    item.detail.isEmpty ? nil : "detail: \(encodeJSONRecord(item.detail))",
    item.result.map { "result: \(encodeJSONRecord($0))" },
    item.error.map { "error: \(encodeJSONRecord($0))" },
  ].compactMap { $0 }
  return sections.isEmpty ? nil : sections.joined(separator: "\n")
}
