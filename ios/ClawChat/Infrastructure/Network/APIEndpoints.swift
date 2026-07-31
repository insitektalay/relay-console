// APIEndpoints.swift
// ClawChat – All API endpoint definitions
// Swift 6

import Foundation

// MARK: - HTTP Method

enum HTTPMethod: String, Sendable {
    case get    = "GET"
    case post   = "POST"
    case put    = "PUT"
    case patch  = "PATCH"
    case delete = "DELETE"
}

// MARK: - APIEndpoint

enum APIEndpoint: @unchecked Sendable {

    // MARK: Auth
    case login(email: String, password: String, deviceName: String, platform: String)
    case register(name: String, email: String, password: String, inviteCode: String, deviceName: String, platform: String)
    case refreshToken(token: String)
    case logout
    case changePassword(current: String, new: String)
    case wsTicket(workspaceId: String)
    case mobileSessions
    case revokeMobileSession(sessionId: String)
    case revokeAllMobileSessions
    case webSessions
    case revokeWebSession(sessionId: String)
    case revokeAllWebSessions
    case exportAccount
    case deleteAccount(currentPassword: String, confirmation: String)
    case billingStatus(workspaceId: String)
    case submitAppleTransaction(workspaceId: String, signedTransaction: String)

    // MARK: Workspace
    case workspaces
    case workspace(id: String)
    case createWorkspace(name: String, type: String)
    case updateWorkspace(id: String, params: [String: Any])
    case workspaceArtifacts(workspaceId: String)
    case workspaceArtifact(workspaceId: String, artifactId: String)
    case workspaceLibraryList(workspaceId: String, folder: String)
    case workspaceLibraryReadFile(workspaceId: String, folder: String, filename: String)
    case workspaceLibraryCreateFolder(workspaceId: String, folder: String)
    case workspaceLibraryWriteFiles(workspaceId: String, folder: String, files: [[String: Any]])
    case workspaceLibraryDeleteFile(workspaceId: String, folder: String, filename: String)
    case workspaceLibraryDeleteFolder(workspaceId: String, folder: String)
    case agentWorkspaceList(workspaceId: String, agentId: String, folder: String)
    case agentWorkspaceReadFile(workspaceId: String, agentId: String, folder: String, filename: String)
    case agentWorkspaceCreateFolder(workspaceId: String, agentId: String, folder: String)
    case agentWorkspaceWriteFiles(workspaceId: String, agentId: String, folder: String, files: [[String: Any]])
    case agentWorkspaceDeleteFile(workspaceId: String, agentId: String, folder: String, filename: String)
    case agentWorkspaceDeleteFolder(workspaceId: String, agentId: String, folder: String)
    case hermesWorkspaceList(workspaceId: String, agentId: String, folder: String, path: String)
    case hermesWorkspaceReadFile(workspaceId: String, agentId: String, folder: String, path: String, filename: String)
    case hermesWorkspaceWriteFiles(workspaceId: String, agentId: String, folder: String, path: String, files: [[String: Any]])

    // MARK: Threads
    case threads(workspaceId: String, page: Int, pageSize: Int)
    case thread(id: String)
    case updateThread(id: String, params: [String: Any])
    case threadMessages(threadId: String, page: Int, pageSize: Int, before: String?)
    case latestThreadMessages(threadId: String, limit: Int, before: String?)
    case sendMessage(
        threadId: String,
        content: String,
        type: String,
        runtimeApprovalMode: String,
        runtimeDispatchConfirmed: Bool
    )
    case createThread(workspaceId: String, title: String, type: String, participantIds: [String], agentIds: [String] = [], teamId: String? = nil, departmentId: String? = nil)
    case markThreadRead(threadId: String)
    case searchThreads(workspaceId: String, query: String, page: Int)
    case threadAnalytics(threadId: String, activityGapMinutes: Int, agentRepeatSessionId: String?)
    case agentWorkCalendar(workspaceId: String, startDate: String, endDate: String, groupType: String?, activityGapMinutes: Int, timeZone: String?)
    case teamRelay(threadId: String)
    case pauseTeamRelay(threadId: String)
    case continueTeamRelay(threadId: String)
    case updateTeamRelayLimit(threadId: String, replyLimit: Int)

    // MARK: Agents
    case agents(workspaceId: String, page: Int, pageSize: Int, teamId: String?, status: String?)
    case agentModelOptions(workspaceId: String)
    case agent(id: String)
    case createAgent(workspaceId: String, name: String, role: String, teamId: String?)
    case createAgentPayload(params: [String: Any])
    case provisionAgent(params: [String: Any])
    case agentProvisionJob(id: String)
    case updateAgent(id: String, params: [String: Any])
    case deleteAgent(id: String)
    case agentPerformance(agentId: String, period: String)
    case agentWorkLogs(agentId: String, page: Int)
    case agentSchedule(agentId: String)
    case agentReviews(agentId: String, page: Int)
    case agentRunHistory(agentId: String, page: Int)
    case agentTasks(agentId: String, status: String?, page: Int, pageSize: Int)
    case setAgentStatus(agentId: String, status: String, reason: String?)

    // MARK: Marketplace
    case marketplaceCatalog(workspaceId: String)
    case marketplaceCatalogPage(workspaceId: String, query: String, category: String?, cursor: String?, limit: Int)
    case marketplaceApp(workspaceId: String, slug: String)
    case marketplaceConnections(workspaceId: String, appSlug: String?)
    case createMarketplaceConnection(workspaceId: String, params: [String: Any])
    case updateMarketplaceConnection(workspaceId: String, id: String, params: [String: Any])
    case startMarketplaceOAuth(workspaceId: String, slug: String, params: [String: Any])
    case disconnectMarketplaceOAuth(workspaceId: String, slug: String, connectionId: String)
    case marketplaceConnectorHealth(workspaceId: String, slug: String, connectionId: String)
    case marketplaceToolRequests(workspaceId: String, status: String?)
    case updateMarketplaceToolRequest(workspaceId: String, id: String, status: String, notes: String?)
    case marketplaceInstalls(workspaceId: String)
    case installMarketplaceApp(workspaceId: String, params: [String: Any])
    case removeMarketplaceInstall(workspaceId: String, id: String)

    // MARK: Teams
    case teams(workspaceId: String)
    case team(id: String)
    case createTeam(departmentId: String, name: String, description: String?)
    case teamDashboard(teamId: String)
    case teamAgents(teamId: String, page: Int)
    case teamMemory(teamId: String, page: Int)
    case addTeamMemory(teamId: String, title: String, content: String, type: String)
    case teamHandovers(teamId: String, page: Int)

    // MARK: Departments
    case departments(workspaceId: String)
    case department(id: String)
    case createDepartment(companyId: String, name: String, description: String?)
    case updateDepartment(id: String, params: [String: Any])
    case departmentDashboard(departmentId: String)

    // MARK: Companies / Org
    case companies(workspaceId: String)
    case company(id: String)
    case createCompany(workspaceId: String, name: String)
    case orgChart(workspaceId: String)

    // MARK: Tasks
    case tasks(workspaceId: String, page: Int, status: String?, agentId: String?, teamId: String?)
    case task(id: String)
    case createTask(workspaceId: String, title: String, description: String, agentId: String?, priority: String?, dueAt: String?, recurrenceRule: String?, requiresApproval: Bool?)
    case updateTaskStatus(id: String, status: String)
    case taskRuns(taskId: String, page: Int)
    case run(id: String)
    case runEvents(runId: String, page: Int)

    // MARK: Approvals
    case approvals(workspaceId: String, page: Int, status: String?)
    case approval(id: String)
    case resolveApproval(id: String, decision: String, notes: String?)

    // MARK: Incidents
    case incidents(workspaceId: String, page: Int, status: String?, severity: String?)
    case incident(id: String)
    case resolveIncident(id: String, notes: String)
    case updateIncidentStatus(id: String, status: String, notes: String?)

    // MARK: Alerts
    case alerts(workspaceId: String, page: Int, unreadOnly: Bool)
    case markAlertRead(id: String)
    case markAllAlertsRead(workspaceId: String)

    // MARK: Work Logs
    case workLogs(workspaceId: String, agentId: String?, teamId: String?, page: Int)

    // MARK: Schedule
    case schedules(workspaceId: String)
    case agentScheduleFull(agentId: String)
    case updateSchedule(agentId: String, mode: String, shifts: [[String: Any]])

    // MARK: Performance & Reports
    case performanceMetrics(workspaceId: String, period: String, agentId: String?, teamId: String?)
    case reports(workspaceId: String, page: Int)
    case report(id: String)
    case generateReport(workspaceId: String, type: String, period: String, start: String, end: String)
    case workspaceWrapUpReports(workspaceId: String, page: Int)

    // MARK: Permissions
    case permissions(workspaceId: String)
    case updatePermission(id: String, permissions: [String])

    // MARK: Capacity
    case capacity(workspaceId: String)

    // MARK: Runtime Bridge
    case bridgeDevices(workspaceId: String)
    case revokeBridgeDevice(id: String)
    case runtimeAuthority(workspaceId: String)
    case runtimeProvisioningTargets(workspaceId: String)
    case selectRuntimeProvisioningTarget(workspaceId: String, runtimeType: String, runtimeHostId: String)
    case scanRuntimeHost(workspaceId: String, runtimeHostId: String)
    case nativeAgentObservations(workspaceId: String)
    case connectNativeAgentObservations(workspaceId: String, observationIds: [String], documentConsentVersion: Int)
    case retryNativeAgentObservation(workspaceId: String, observationId: String, documentConsentVersion: Int)
    case disconnectNativeAgentObservation(workspaceId: String, observationId: String)
    case dismissNativeAgentObservation(workspaceId: String, observationId: String)

    // MARK: User
    case me
    case updateProfile(name: String, avatarUrl: String?)
    case auditLogs(workspaceId: String, page: Int, pageSize: Int)
    case securityMetrics(workspaceId: String, hours: Int)

    // MARK: Paperclip
    case paperclipConnections(workspaceId: String)
    case createPaperclipConnection(workspaceId: String, displayName: String, baseUrl: String, companyId: String, bearerToken: String)
    case updatePaperclipConnection(workspaceId: String, connectionId: String, params: [String: Any])
    case testPaperclipConnection(workspaceId: String, connectionId: String)
    case threadPaperclipLink(threadId: String)
    case putThreadPaperclipLink(threadId: String, connectionId: String, objectType: String, objectRef: String)
    case deleteThreadPaperclipLink(threadId: String)

    // MARK: Agent Documentation
    case agentDocumentationLinkedApps(workspaceId: String)
    case createAgentDocumentationLinkedApp(workspaceId: String, name: String, repoPath: String, repoKey: String?, slug: String?)
    case updateAgentDocumentationLinkedApp(workspaceId: String, id: String, params: [String: Any])
    case deleteAgentDocumentationLinkedApp(workspaceId: String, id: String)
    case scanAgentDocumentationLinkedApp(workspaceId: String, id: String)
    case agentDocumentationBlueprints(workspaceId: String)
    case forkAgentDocumentationBlueprint(workspaceId: String, id: String, name: String?)
    case updateAgentDocumentationBlueprint(workspaceId: String, id: String, params: [String: Any])
    case publishAgentDocumentationBlueprint(workspaceId: String, id: String)
    case retireAgentDocumentationBlueprint(workspaceId: String, id: String)
    case agentDocumentationPacks(workspaceId: String)
    case generateAgentDocumentationProposal(workspaceId: String, linkedApplicationId: String, mode: String, blueprintIds: [String], packId: String?)
    case agentDocumentationProposals(workspaceId: String)
    case agentDocumentationProposal(workspaceId: String, id: String)
    case applyAgentDocumentationProposal(workspaceId: String, id: String, fileIds: [String])
    case syncAgentDocumentationPackToLibrary(workspaceId: String, id: String, targetFolder: String?)
    case agentDocumentationInstalls(workspaceId: String)
    case installAgentDocumentation(workspaceId: String, packId: String, agentId: String, role: String)
    case refreshAgentDocumentationInstall(workspaceId: String, id: String, packId: String, agentId: String, role: String)
    case agentDocumentationDrift(workspaceId: String)
    case exportAgentDocumentationState(workspaceId: String, packId: String?, agentId: String?, snapshotKind: String?, exportToLibrary: Bool)

    // MARK: Agent Library
    case agentLibraryFiles(agentId: String)
    case uploadAgentLibraryFile(agentId: String)
    case updateAgentLibraryFile(agentId: String, fileId: String, content: String)
    case deleteAgentLibraryFile(agentId: String, fileId: String)

    // MARK: Thread Wrap-Up
    case generateWrapUp(threadId: String)
    case threadWrapUps(threadId: String, page: Int)
    case wrapUp(id: String)

    // MARK: Dispatches
    case activeDispatches(threadId: String)
    case cancelDispatch(id: String)

    // MARK: Reports (extended)
    case archiveReport(id: String)

    // MARK: Search
    case searchMessages(workspaceId: String, query: String, page: Int)
}

// MARK: - Request Building

extension APIEndpoint {

    func urlRequest(relativeTo base: URL) -> URLRequest {
        guard var components = URLComponents(url: base.appendingPathComponent(path), resolvingAgainstBaseURL: true) else {
            _Concurrency.Task { @MainActor in
                Telemetry.shared.capture(
                    message: "Failed to build API URL components",
                    attributes: ["path": path]
                )
            }
            var request = URLRequest(url: base)
            request.httpMethod = method.rawValue
            return request
        }
        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        guard let url = components.url else {
            _Concurrency.Task { @MainActor in
                Telemetry.shared.capture(
                    message: "Failed to resolve API URL",
                    attributes: ["path": path]
                )
            }
            var request = URLRequest(url: base)
            request.httpMethod = method.rawValue
            return request
        }
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        if let body = bodyData {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return request
    }

    // MARK: Path

    var path: String {
        switch self {
        // Auth
        case .login:                                return "auth/login"
        case .register:                             return "auth/register"
        case .refreshToken:                         return "auth/refresh"
        case .logout:                               return "auth/logout"
        case .changePassword:                       return "auth/change-password"
        case .wsTicket:                             return "auth/ws-ticket"
        case .mobileSessions:                       return "auth/sessions"
        case .revokeMobileSession(let id):          return "auth/sessions/\(id)"
        case .revokeAllMobileSessions:              return "auth/sessions"
        case .webSessions:                          return "auth/web/sessions"
        case .revokeWebSession(let id):             return "auth/web/sessions/\(id)/revoke"
        case .revokeAllWebSessions:                 return "auth/web/sessions/revoke-all"
        case .exportAccount:                        return "auth/account/export"
        case .deleteAccount:                        return "auth/account"
        case .billingStatus(let workspaceId):       return "workspaces/\(workspaceId)/billing/status"
        case .submitAppleTransaction(let workspaceId, _): return "workspaces/\(workspaceId)/billing/apple/transactions"
        // Workspace
        case .workspaces:                           return "workspaces"
        case .workspace(let id):                    return "workspaces/\(id)"
        case .createWorkspace:                      return "workspaces"
        case .updateWorkspace(let id, _):           return "workspaces/\(id)"
        case .workspaceArtifacts(let wsId):         return "workspaces/\(wsId)/artifacts"
        case .workspaceArtifact(let wsId, let artifactId): return "workspaces/\(wsId)/artifacts/\(artifactId)"
        case .workspaceLibraryList(let wsId, _):    return "workspaces/\(wsId)/library/list"
        case .workspaceLibraryReadFile(let wsId, _, _): return "workspaces/\(wsId)/library/file"
        case .workspaceLibraryCreateFolder(let wsId, _): return "workspaces/\(wsId)/library/folders"
        case .workspaceLibraryWriteFiles(let wsId, _, _): return "workspaces/\(wsId)/library/files"
        case .workspaceLibraryDeleteFile(let wsId, _, _): return "workspaces/\(wsId)/library/file/delete"
        case .workspaceLibraryDeleteFolder(let wsId, _): return "workspaces/\(wsId)/library/folder/delete"
        case .agentWorkspaceList(let wsId, _, _):   return "workspaces/\(wsId)/openclaw/agent-workspace/list"
        case .agentWorkspaceReadFile(let wsId, _, _, _): return "workspaces/\(wsId)/openclaw/agent-workspace/file"
        case .agentWorkspaceCreateFolder(let wsId, _, _): return "workspaces/\(wsId)/openclaw/agent-workspace/folders"
        case .agentWorkspaceWriteFiles(let wsId, _, _, _): return "workspaces/\(wsId)/openclaw/agent-workspace/files"
        case .agentWorkspaceDeleteFile(let wsId, _, _, _): return "workspaces/\(wsId)/openclaw/agent-workspace/file/delete"
        case .agentWorkspaceDeleteFolder(let wsId, _, _): return "workspaces/\(wsId)/openclaw/agent-workspace/folder/delete"
        case .hermesWorkspaceList(let wsId, _, _, _): return "workspaces/\(wsId)/hermes/agent-workspace/list"
        case .hermesWorkspaceReadFile(let wsId, _, _, _, _): return "workspaces/\(wsId)/hermes/agent-workspace/file"
        case .hermesWorkspaceWriteFiles(let wsId, _, _, _, _): return "workspaces/\(wsId)/hermes/agent-workspace/files"
        // Threads
        case .threads(let wsId, _, _):              return "workspaces/\(wsId)/threads"
        case .thread(let id):                       return "threads/\(id)"
        case .updateThread(let id, _):              return "threads/\(id)"
        case .threadMessages(let tId, _, _, _):     return "threads/\(tId)/messages"
        case .latestThreadMessages(let tId, _, _):  return "threads/\(tId)/messages/latest"
        case .sendMessage(let tId, _, _, _, _):     return "threads/\(tId)/messages"
        case .createThread(let wsId, _, _, _, _, _, _): return "workspaces/\(wsId)/threads"
        case .markThreadRead(let tId):              return "threads/\(tId)/read"
        case .searchThreads(let wsId, _, _):        return "workspaces/\(wsId)/threads/search"
        case .threadAnalytics(let id, _, _):        return "threads/\(id)/analytics"
        case .agentWorkCalendar(let wsId, _, _, _, _, _): return "workspaces/\(wsId)/agent-work-calendar"
        // Agents
        case .agents:                               return "agents"
        case .agentModelOptions:                    return "agents/model-options"
        case .agent(let id):                        return "agents/\(id)"
        case .createAgent, .createAgentPayload:     return "agents"
        case .provisionAgent:                       return "agents/provision"
        case .agentProvisionJob(let id):            return "agents/provision-jobs/\(id)"
        case .updateAgent(let id, _):               return "agents/\(id)"
        case .deleteAgent(let id):                  return "agents/\(id)"
        case .agentPerformance(let id, _):          return "agents/\(id)/performance"
        case .agentWorkLogs(let id, _):             return "agents/\(id)/work-logs"
        case .agentSchedule(let id):                return "agents/\(id)/schedule"
        case .agentReviews(let id, _):              return "agents/\(id)/reviews"
        case .agentRunHistory(let id, _):           return "agents/\(id)/runs"
        case .agentTasks(let id, _, _, _):           return "agents/\(id)/tasks"
        case .setAgentStatus(let id, _, _):         return "agents/\(id)/status"
        // Marketplace
        case .marketplaceCatalog(let wsId):         return "workspaces/\(wsId)/marketplace/catalog"
        case .marketplaceCatalogPage(let wsId, _, _, _, _): return "workspaces/\(wsId)/marketplace/catalog"
        case .marketplaceApp(let wsId, let slug):   return "workspaces/\(wsId)/marketplace/catalog/\(slug)"
        case .marketplaceConnections(let wsId, _): return "workspaces/\(wsId)/marketplace/connections"
        case .createMarketplaceConnection(let wsId, _): return "workspaces/\(wsId)/marketplace/connections"
        case .updateMarketplaceConnection(let wsId, let id, _): return "workspaces/\(wsId)/marketplace/connections/\(id)"
        case .startMarketplaceOAuth(let wsId, let slug, _): return "workspaces/\(wsId)/marketplace/connectors/\(slug)/oauth/start"
        case .disconnectMarketplaceOAuth(let wsId, let slug, let connectionId): return "workspaces/\(wsId)/marketplace/connectors/\(slug)/connections/\(connectionId)/disconnect"
        case .marketplaceConnectorHealth(let wsId, let slug, let connectionId): return "workspaces/\(wsId)/marketplace/connectors/\(slug)/connections/\(connectionId)/health"
        case .marketplaceToolRequests(let wsId, _): return "workspaces/\(wsId)/marketplace/tool-requests"
        case .updateMarketplaceToolRequest(let wsId, let id, _, _): return "workspaces/\(wsId)/marketplace/tool-requests/\(id)"
        case .marketplaceInstalls(let wsId):        return "workspaces/\(wsId)/marketplace/installs"
        case .installMarketplaceApp(let wsId, _):  return "workspaces/\(wsId)/marketplace/install"
        case .removeMarketplaceInstall(let wsId, let id): return "workspaces/\(wsId)/marketplace/installs/\(id)"
        // Teams
        case .teams:                                return "teams"
        case .team(let id):                         return "teams/\(id)"
        case .createTeam:                           return "teams"
        case .teamDashboard(let id):                return "teams/\(id)/dashboard"
        case .teamAgents(let id, _):                return "teams/\(id)/agents"
        case .teamMemory(let id, _):                return "teams/\(id)/memory"
        case .addTeamMemory(let id, _, _, _):       return "teams/\(id)/memory"
        case .teamHandovers(let id, _):             return "teams/\(id)/handovers"
        // Departments
        case .departments:                          return "departments"
        case .department(let id):                   return "departments/\(id)"
        case .createDepartment:                     return "departments"
        case .updateDepartment(let id, _):          return "departments/\(id)"
        case .departmentDashboard(let id):          return "departments/\(id)/dashboard"
        // Companies
        case .companies:                            return "org/companies"
        case .company(let id):                      return "org/companies/\(id)"
        case .createCompany:                        return "org/companies"
        case .orgChart:                             return "org/chart"
        // Tasks
        case .tasks:                                return "tasks"
        case .task(let id):                         return "tasks/\(id)"
        case .createTask:                           return "tasks"
        case .updateTaskStatus(let id, _):          return "tasks/\(id)/status"
        case .taskRuns(let id, _):                  return "tasks/\(id)/runs"
        case .run(let id):                          return "runs/\(id)"
        case .runEvents(let id, _):                 return "runs/\(id)/events"
        // Approvals
        case .approvals:                            return "approvals"
        case .approval(let id):                     return "approvals/\(id)"
        case .resolveApproval(let id, let decision, _): return "approvals/\(id)/\(decision == "approved" ? "approve" : "reject")"
        // Incidents
        case .incidents(let wsId, _, _, _):         return "workspaces/\(wsId)/incidents"
        case .incident(let id):                     return "incidents/\(id)"
        case .resolveIncident(let id, _):           return "incidents/\(id)/resolve"
        case .updateIncidentStatus(let id, _, _):   return "incidents/\(id)/status"
        // Alerts
        case .alerts(let wsId, _, _):               return "workspaces/\(wsId)/alerts"
        case .markAlertRead(let id):                return "alerts/\(id)/read"
        case .markAllAlertsRead(let wsId):          return "workspaces/\(wsId)/alerts/read-all"
        // Work Logs
        case .workLogs(let wsId, _, _, _):          return "workspaces/\(wsId)/work-logs"
        // Schedules
        case .schedules(let wsId):                  return "workspaces/\(wsId)/schedules"
        case .agentScheduleFull(let id):            return "agents/\(id)/schedule"
        case .updateSchedule(let id, _, _):         return "agents/\(id)/schedule"
        // Performance & Reports
        case .performanceMetrics(let wsId, _, _, _): return "workspaces/\(wsId)/performance"
        case .reports:                              return "reports"
        case .report(let id):                       return "reports/\(id)"
        case .generateReport:                       return "reports/generate"
        case .workspaceWrapUpReports:               return "reports/wrap-ups"
        // Permissions
        case .permissions(let wsId):                return "workspaces/\(wsId)/permissions"
        case .updatePermission(let id, _):          return "permissions/\(id)"
        // Capacity
        case .capacity(let wsId):                   return "workspaces/\(wsId)/capacity"
        // Runtime bridge
        case .bridgeDevices(let workspaceId):       return "bridge/workspaces/\(workspaceId)/devices"
        case .revokeBridgeDevice(let id):           return "bridge/devices/\(id)/revoke"
        case .runtimeAuthority(let workspaceId):    return "workspaces/\(workspaceId)/runtime-authority"
        case .runtimeProvisioningTargets(let workspaceId): return "workspaces/\(workspaceId)/runtime-authority/provisioning-targets"
        case .selectRuntimeProvisioningTarget(let workspaceId, let runtimeType, _): return "workspaces/\(workspaceId)/runtime-authority/provisioning-targets/\(runtimeType)"
        case .scanRuntimeHost(let workspaceId, let runtimeHostId): return "workspaces/\(workspaceId)/runtime-authority/hosts/\(runtimeHostId)/scan"
        case .nativeAgentObservations:               return "agents/native-observations"
        case .connectNativeAgentObservations:        return "agents/native-observations/connect-batch"
        case .retryNativeAgentObservation(_, let observationId, _): return "agents/native-observations/\(observationId)/retry"
        case .disconnectNativeAgentObservation(_, let observationId): return "agents/native-observations/\(observationId)/disconnect"
        case .dismissNativeAgentObservation(_, let observationId): return "agents/native-observations/\(observationId)/dismiss"
        // User
        case .me:                                   return "auth/me"
        case .updateProfile:                        return "auth/me"
        case .auditLogs:                            return "audit-logs"
        case .securityMetrics:                      return "audit-logs/metrics"
        // Paperclip
        case .paperclipConnections(let wsId):       return "workspaces/\(wsId)/paperclip/connections"
        case .createPaperclipConnection(let wsId, _, _, _, _): return "workspaces/\(wsId)/paperclip/connections"
        case .updatePaperclipConnection(let wsId, let id, _): return "workspaces/\(wsId)/paperclip/connections/\(id)"
        case .testPaperclipConnection(let wsId, let id): return "workspaces/\(wsId)/paperclip/connections/\(id)/test"
        case .threadPaperclipLink(let tId):         return "threads/\(tId)/paperclip-link"
        case .putThreadPaperclipLink(let tId, _, _, _): return "threads/\(tId)/paperclip-link"
        case .deleteThreadPaperclipLink(let tId):   return "threads/\(tId)/paperclip-link"
        // Agent Documentation
        case .agentDocumentationLinkedApps(let wsId): return "workspaces/\(wsId)/agent-documentation/linked-apps"
        case .createAgentDocumentationLinkedApp(let wsId, _, _, _, _): return "workspaces/\(wsId)/agent-documentation/linked-apps"
        case .updateAgentDocumentationLinkedApp(let wsId, let id, _): return "workspaces/\(wsId)/agent-documentation/linked-apps/\(id)"
        case .deleteAgentDocumentationLinkedApp(let wsId, let id): return "workspaces/\(wsId)/agent-documentation/linked-apps/\(id)"
        case .scanAgentDocumentationLinkedApp(let wsId, let id): return "workspaces/\(wsId)/agent-documentation/linked-apps/\(id)/scan"
        case .agentDocumentationBlueprints(let wsId): return "workspaces/\(wsId)/agent-documentation/blueprints"
        case .forkAgentDocumentationBlueprint(let wsId, let id, _): return "workspaces/\(wsId)/agent-documentation/blueprints/\(id)/fork"
        case .updateAgentDocumentationBlueprint(let wsId, let id, _): return "workspaces/\(wsId)/agent-documentation/blueprints/\(id)"
        case .publishAgentDocumentationBlueprint(let wsId, let id): return "workspaces/\(wsId)/agent-documentation/blueprints/\(id)/publish"
        case .retireAgentDocumentationBlueprint(let wsId, let id): return "workspaces/\(wsId)/agent-documentation/blueprints/\(id)/retire"
        case .agentDocumentationPacks(let wsId): return "workspaces/\(wsId)/agent-documentation/packs"
        case .generateAgentDocumentationProposal(let wsId, _, _, _, _): return "workspaces/\(wsId)/agent-documentation/packs/generate"
        case .agentDocumentationProposals(let wsId): return "workspaces/\(wsId)/agent-documentation/proposals"
        case .agentDocumentationProposal(let wsId, let id): return "workspaces/\(wsId)/agent-documentation/proposals/\(id)"
        case .applyAgentDocumentationProposal(let wsId, let id, _): return "workspaces/\(wsId)/agent-documentation/proposals/\(id)/apply"
        case .syncAgentDocumentationPackToLibrary(let wsId, let id, _): return "workspaces/\(wsId)/agent-documentation/packs/\(id)/sync-library"
        case .agentDocumentationInstalls(let wsId): return "workspaces/\(wsId)/agent-documentation/agent-installs"
        case .installAgentDocumentation(let wsId, _, _, _): return "workspaces/\(wsId)/agent-documentation/agent-installs"
        case .refreshAgentDocumentationInstall(let wsId, let id, _, _, _): return "workspaces/\(wsId)/agent-documentation/agent-installs/\(id)/refresh"
        case .agentDocumentationDrift(let wsId): return "workspaces/\(wsId)/agent-documentation/drift"
        case .exportAgentDocumentationState(let wsId, _, _, _, _): return "workspaces/\(wsId)/agent-documentation/state/export"
        // Agent Library
        case .agentLibraryFiles(let id):                           return "agents/\(id)/library"
        case .uploadAgentLibraryFile(let id):                      return "agents/\(id)/library"
        case .updateAgentLibraryFile(let id, let fId, _):          return "agents/\(id)/library/\(fId)"
        case .deleteAgentLibraryFile(let id, let fId):             return "agents/\(id)/library/\(fId)"
        // Wrap-Up
        case .generateWrapUp(let tId):                             return "threads/\(tId)/wrap-up"
        case .threadWrapUps(let tId, _):                           return "threads/\(tId)/wrap-ups"
        case .wrapUp(let id):                                      return "wrap-ups/\(id)"
        // Team Relay
        case .teamRelay(let tId):                                  return "threads/\(tId)/team-relay"
        case .pauseTeamRelay(let tId):                             return "threads/\(tId)/team-relay/pause"
        case .continueTeamRelay(let tId):                          return "threads/\(tId)/team-relay/continue"
        case .updateTeamRelayLimit(let tId, _):                    return "threads/\(tId)/team-relay"
        // Dispatches
        case .activeDispatches(let tId):                           return "dispatches/threads/\(tId)"
        case .cancelDispatch(let id):                              return "dispatches/\(id)/cancel"
        // Reports extended
        case .archiveReport(let id):                               return "reports/\(id)"
        // Search messages
        case .searchMessages(let wsId, _, _):                      return "workspaces/\(wsId)/messages/search"
        }
    }

    var invalidatesSessionOnUnauthorized: Bool {
        switch self {
        case .me, .refreshToken:
            return true
        default:
            return false
        }
    }

    // MARK: HTTP Method

    var method: HTTPMethod {
        switch self {
        case .login, .register, .refreshToken, .logout, .changePassword, .wsTicket,
             .submitAppleTransaction,
             .revokeWebSession, .revokeAllWebSessions,
             .createWorkspace, .sendMessage, .createThread,
             .createAgent, .createAgentPayload, .provisionAgent, .addTeamMemory,
             .createMarketplaceConnection, .startMarketplaceOAuth, .disconnectMarketplaceOAuth, .installMarketplaceApp,
             .createTeam, .createDepartment, .createCompany,
             .createTask, .resolveApproval, .resolveIncident,
             .markAlertRead, .markAllAlertsRead,
             .generateReport, .revokeBridgeDevice,
             .scanRuntimeHost, .connectNativeAgentObservations, .retryNativeAgentObservation, .disconnectNativeAgentObservation, .dismissNativeAgentObservation,
             .workspaceLibraryCreateFolder, .workspaceLibraryWriteFiles,
             .workspaceLibraryDeleteFile, .workspaceLibraryDeleteFolder,
             .agentWorkspaceCreateFolder, .agentWorkspaceWriteFiles,
             .agentWorkspaceDeleteFile, .agentWorkspaceDeleteFolder,
             .hermesWorkspaceWriteFiles,
             .createPaperclipConnection, .testPaperclipConnection,
             .generateAgentDocumentationProposal, .scanAgentDocumentationLinkedApp,
             .forkAgentDocumentationBlueprint, .publishAgentDocumentationBlueprint,
             .retireAgentDocumentationBlueprint, .applyAgentDocumentationProposal,
             .syncAgentDocumentationPackToLibrary, .installAgentDocumentation,
             .refreshAgentDocumentationInstall, .exportAgentDocumentationState,
             .generateWrapUp, .uploadAgentLibraryFile,
             .pauseTeamRelay, .continueTeamRelay:
            return .post
        case .cancelDispatch:
            return .post
        case .putThreadPaperclipLink:
            return .put
        case .updateAgent, .updateDepartment, .updateTaskStatus, .setAgentStatus,
             .updateSchedule, .updatePermission, .updateProfile,
             .updateThread, .updateWorkspace,
             .updateAgentLibraryFile, .archiveReport, .updatePaperclipConnection,
             .updateAgentDocumentationLinkedApp, .updateAgentDocumentationBlueprint,
             .updateTeamRelayLimit, .selectRuntimeProvisioningTarget:
            return .patch
        case .updateMarketplaceToolRequest:
            return .patch
        case .updateMarketplaceConnection:
            return .patch
        case .markThreadRead:
            return .put
        case .deleteThreadPaperclipLink, .deleteAgentLibraryFile,
             .deleteAgentDocumentationLinkedApp, .revokeMobileSession, .revokeAllMobileSessions,
             .deleteAgent, .deleteAccount:
            return .delete
        case .removeMarketplaceInstall:
            return .delete
        case .updateIncidentStatus:
            return .patch
        default:
            return .get
        }
    }

    // MARK: Query Items

    var queryItems: [URLQueryItem] {
        switch self {
        case .threads(_, let page, let pageSize):
            return [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "page_size", value: "\(pageSize)")
            ]
        case .threadMessages(_, let page, let pageSize, let before):
            var items = [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "page_size", value: "\(pageSize)")
            ]
            if let before { items.append(URLQueryItem(name: "before", value: before)) }
            return items
        case .latestThreadMessages(_, let limit, let before):
            var items = [URLQueryItem(name: "limit", value: "\(limit)")]
            if let before { items.append(URLQueryItem(name: "before", value: before)) }
            return items
        case .searchThreads(_, let query, let page):
            return [
                URLQueryItem(name: "q", value: query),
                URLQueryItem(name: "page", value: "\(page)")
            ]
        case .threadAnalytics(_, let gap, let sessionId):
            var items = [URLQueryItem(name: "activityGapMinutes", value: "\(gap)")]
            if let sessionId { items.append(URLQueryItem(name: "agentRepeatSessionId", value: sessionId)) }
            return items
        case .agentWorkCalendar(_, let startDate, let endDate, let groupType, let gap, let timeZone):
            var items = [
                URLQueryItem(name: "startDate", value: startDate),
                URLQueryItem(name: "endDate", value: endDate),
                URLQueryItem(name: "activityGapMinutes", value: "\(gap)")
            ]
            if let groupType { items.append(URLQueryItem(name: "groupType", value: groupType)) }
            if let timeZone { items.append(URLQueryItem(name: "timeZone", value: timeZone)) }
            return items
        case .workspaceLibraryList(_, let folder):
            return [URLQueryItem(name: "folder", value: folder)]
        case .workspaceLibraryReadFile(_, let folder, let filename):
            return [URLQueryItem(name: "folder", value: folder), URLQueryItem(name: "filename", value: filename)]
        case .agentWorkspaceList(_, let agentId, let folder):
            return [URLQueryItem(name: "agentId", value: agentId), URLQueryItem(name: "folder", value: folder)]
        case .agentWorkspaceReadFile(_, let agentId, let folder, let filename):
            return [
                URLQueryItem(name: "agentId", value: agentId),
                URLQueryItem(name: "folder", value: folder),
                URLQueryItem(name: "filename", value: filename)
            ]
        case .hermesWorkspaceList(_, let agentId, let folder, let path):
            return [
                URLQueryItem(name: "agentId", value: agentId),
                URLQueryItem(name: "folder", value: folder),
                URLQueryItem(name: "path", value: path)
            ]
        case .hermesWorkspaceReadFile(_, let agentId, let folder, let path, let filename):
            return [
                URLQueryItem(name: "agentId", value: agentId),
                URLQueryItem(name: "folder", value: folder),
                URLQueryItem(name: "path", value: path),
                URLQueryItem(name: "filename", value: filename)
            ]
        case .agents(let workspaceId, let page, let pageSize, let teamId, let status):
            var items = [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "pageSize", value: "\(pageSize)"),
                URLQueryItem(name: "workspaceId", value: workspaceId)
            ]
            if let teamId  { items.append(URLQueryItem(name: "teamId", value: teamId)) }
            if let status  { items.append(URLQueryItem(name: "status",  value: status)) }
            return items
        case .agentModelOptions(let workspaceId):
            return [URLQueryItem(name: "workspaceId", value: workspaceId)]
        case .agentWorkLogs(_, let page):
            return [URLQueryItem(name: "page", value: "\(page)")]
        case .agentReviews(_, let page):
            return [URLQueryItem(name: "page", value: "\(page)")]
        case .agentRunHistory(_, let page):
            return [URLQueryItem(name: "page", value: "\(page)")]
        case .agentPerformance(_, let period):
            return [URLQueryItem(name: "period", value: period)]
        case .marketplaceConnections(_, let appSlug):
            if let appSlug { return [URLQueryItem(name: "appSlug", value: appSlug)] }
            return []
        case .marketplaceCatalogPage(_, let query, let category, let cursor, let limit):
            var items = [URLQueryItem(name: "limit", value: "\(min(max(limit, 1), 100))")]
            if !query.isEmpty { items.append(URLQueryItem(name: "query", value: query)) }
            if let category, !category.isEmpty {
                items.append(URLQueryItem(name: "category", value: category))
            }
            if let cursor, !cursor.isEmpty {
                items.append(URLQueryItem(name: "cursor", value: cursor))
            }
            return items
        case .marketplaceToolRequests(_, let status):
            if let status { return [URLQueryItem(name: "status", value: status)] }
            return []
        case .teams(let wsId):
            return [URLQueryItem(name: "workspaceId", value: wsId)]
        case .departments(let wsId):
            return [URLQueryItem(name: "workspaceId", value: wsId)]
        case .companies(let wsId):
            return [URLQueryItem(name: "workspaceId", value: wsId)]
        case .orgChart(let wsId):
            return [URLQueryItem(name: "workspaceId", value: wsId)]
        case .teamAgents(_, let page):
            return [URLQueryItem(name: "page", value: "\(page)")]
        case .teamMemory(_, let page):
            return [URLQueryItem(name: "page", value: "\(page)")]
        case .teamHandovers(_, let page):
            return [URLQueryItem(name: "page", value: "\(page)")]
        case .tasks(let workspaceId, let page, let status, let agentId, let teamId):
            var items = [
                URLQueryItem(name: "workspaceId", value: workspaceId),
                URLQueryItem(name: "page", value: "\(page)")
            ]
            if let status  { items.append(URLQueryItem(name: "status",   value: status)) }
            if let agentId { items.append(URLQueryItem(name: "agentId", value: agentId)) }
            if let teamId  { items.append(URLQueryItem(name: "teamId",  value: teamId)) }
            return items
        case .agentTasks(_, let status, let page, let pageSize):
            var items = [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "pageSize", value: "\(pageSize)")
            ]
            if let status { items.append(URLQueryItem(name: "status", value: status)) }
            return items
        case .taskRuns(_, let page):
            return [URLQueryItem(name: "page", value: "\(page)")]
        case .runEvents(_, let page):
            return [URLQueryItem(name: "page", value: "\(page)")]
        case .approvals(_, let page, let status):
            var items = [URLQueryItem(name: "page", value: "\(page)")]
            if let status { items.append(URLQueryItem(name: "status", value: status)) }
            if case .approvals(let workspaceId, _, _) = self {
                items.append(URLQueryItem(name: "workspaceId", value: workspaceId))
            }
            return items
        case .incidents(_, let page, let status, let severity):
            var items = [URLQueryItem(name: "page", value: "\(page)")]
            if let status   { items.append(URLQueryItem(name: "status",   value: status)) }
            if let severity { items.append(URLQueryItem(name: "severity", value: severity)) }
            return items
        case .alerts(_, let page, let unreadOnly):
            return [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "unread_only", value: unreadOnly ? "true" : "false")
            ]
        case .workLogs(_, let agentId, let teamId, let page):
            var items = [URLQueryItem(name: "page", value: "\(page)")]
            if let agentId { items.append(URLQueryItem(name: "agent_id", value: agentId)) }
            if let teamId  { items.append(URLQueryItem(name: "team_id",  value: teamId)) }
            return items
        case .performanceMetrics(_, let period, let agentId, let teamId):
            var items = [URLQueryItem(name: "period", value: period)]
            if let agentId { items.append(URLQueryItem(name: "agent_id", value: agentId)) }
            if let teamId  { items.append(URLQueryItem(name: "team_id",  value: teamId)) }
            return items
        case .reports(let workspaceId, let page):
            return [
                URLQueryItem(name: "workspaceId", value: workspaceId),
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "pageSize", value: "100")
            ]
        case .workspaceWrapUpReports(let wsId, let page):
            return [URLQueryItem(name: "workspaceId", value: wsId), URLQueryItem(name: "page", value: "\(page)")]
        case .auditLogs(let workspaceId, let page, let pageSize):
            return [
                URLQueryItem(name: "workspaceId", value: workspaceId),
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "pageSize", value: "\(pageSize)")
            ]
        case .securityMetrics(let workspaceId, let hours):
            return [URLQueryItem(name: "workspaceId", value: workspaceId), URLQueryItem(name: "hours", value: "\(hours)")]
        case .threadWrapUps(_, let page):
            return [URLQueryItem(name: "page", value: "\(page)")]
        case .searchMessages(_, let query, let page):
            return [
                URLQueryItem(name: "q", value: query),
                URLQueryItem(name: "page", value: "\(page)")
            ]
        case .nativeAgentObservations(let workspaceId):
            return [URLQueryItem(name: "workspaceId", value: workspaceId)]
        case .activeDispatches:
            return [URLQueryItem(name: "active", value: "true")]
        default:
            return []
        }
    }

    // MARK: Body Data

    var bodyData: Data? {
        let dict = bodyDict
        guard !dict.isEmpty else { return nil }
        return try? JSONSerialization.data(withJSONObject: dict)
    }

    private var bodyDict: [String: Any] {
        switch self {
        case .login(let email, let password, let deviceName, let platform):
            return [
                "email": email,
                "password": password,
                "deviceName": deviceName,
                "platform": platform,
            ]
        case .register(let name, let email, let password, let inviteCode, let deviceName, let platform):
            return [
                "name": name,
                "email": email,
                "password": password,
                "inviteCode": inviteCode,
                "deviceName": deviceName,
                "platform": platform,
            ]
        case .refreshToken(let token):
            return ["refreshToken": token]
        case .wsTicket(let workspaceId):
            return ["workspaceId": workspaceId]
        case .createWorkspace(let name, let type):
            return ["name": name, "type": type]
        case .updateWorkspace(_, let params):
            return params
        case .updateTeamRelayLimit(_, let replyLimit):
            return ["replyLimit": replyLimit]
        case .workspaceLibraryCreateFolder(_, let folder),
             .workspaceLibraryDeleteFolder(_, let folder):
            return ["folder": folder]
        case .workspaceLibraryWriteFiles(_, let folder, let files):
            return ["folder": folder, "files": files]
        case .workspaceLibraryDeleteFile(_, let folder, let filename):
            return ["folder": folder, "filename": filename]
        case .agentWorkspaceCreateFolder(_, let agentId, let folder),
             .agentWorkspaceDeleteFolder(_, let agentId, let folder):
            return ["agentId": agentId, "folder": folder]
        case .agentWorkspaceWriteFiles(_, let agentId, let folder, let files):
            return ["agentId": agentId, "folder": folder, "files": files]
        case .agentWorkspaceDeleteFile(_, let agentId, let folder, let filename):
            return ["agentId": agentId, "folder": folder, "filename": filename]
        case .hermesWorkspaceWriteFiles(_, let agentId, let folder, let path, let files):
            return ["agentId": agentId, "folder": folder, "path": path, "files": files]
        case .sendMessage(_, let content, let type, let runtimeApprovalMode, let runtimeDispatchConfirmed):
            return [
                "content": content,
                "type": type,
                "runtimeApprovalMode": runtimeApprovalMode,
                "runtimeDispatchConfirmed": runtimeDispatchConfirmed
            ]
        case .updateThread(_, let params):
            return params
        case .createThread(_, let title, let type, let participantIds, let agentIds, let teamId, let departmentId):
            var d: [String: Any] = ["title": title, "type": type, "participant_ids": participantIds, "agent_ids": agentIds]
            if let teamId { d["team_id"] = teamId }
            if let departmentId { d["department_id"] = departmentId }
            return d
        case .createTeam(let departmentId, let name, let description):
            var d: [String: Any] = ["name": name, "departmentId": departmentId]
            if let desc = description { d["description"] = desc }
            return d
        case .createDepartment(let companyId, let name, let description):
            var d: [String: Any] = ["name": name, "companyId": companyId]
            if let desc = description { d["description"] = desc }
            return d
        case .createCompany(let wsId, let name):
            return ["name": name, "workspaceId": wsId]
        case .createAgent(let workspaceId, let name, let role, let teamId):
            var d: [String: Any] = ["workspaceId": workspaceId, "name": name, "role": role]
            if let teamId { d["teamId"] = teamId }
            return d
        case .createAgentPayload(let params),
             .provisionAgent(let params),
             .updateDepartment(_, let params):
            return params
        case .updateAgent(_, let params):
            return params
        case .setAgentStatus(_, let status, let reason):
            var d: [String: Any] = ["status": status]
            if let reason { d["reason"] = reason }
            return d
        case .createMarketplaceConnection(_, let params),
             .startMarketplaceOAuth(_, _, let params),
             .installMarketplaceApp(_, let params):
            return params
        case .updateMarketplaceConnection(_, _, let params):
            return params
        case .updateMarketplaceToolRequest(_, _, let status, let notes):
            var d: [String: Any] = ["status": status]
            if let notes { d["resolutionNotes"] = notes }
            return d
        case .addTeamMemory(_, let title, let content, let type):
            return ["title": title, "content": content, "type": type]
        case .createTask(let workspaceId, let title, let description, let agentId, let priority, let dueAt, let recurrenceRule, let requiresApproval):
            var d: [String: Any] = [
                "workspaceId": workspaceId,
                "title": title,
                "description": description,
                "targetType": "direct",
                "messageBody": title,
            ]
            if let agentId           { d["assignedAgentId"] = agentId }
            if let priority          { d["priority"] = priority }
            if let dueAt             { d["dueAt"] = dueAt }
            if let recurrenceRule    { d["recurrenceRule"] = recurrenceRule }
            if let requiresApproval  { d["requiresApproval"] = requiresApproval }
            return d
        case .updateTaskStatus(_, let status):
            return ["status": status]
        case .resolveApproval(_, _, let notes):
            var d: [String: Any] = [:]
            if let notes { d["notes"] = notes }
            return d
        case .resolveIncident(_, let notes):
            return ["notes": notes]
        case .updateIncidentStatus(_, let status, let notes):
            var d: [String: Any] = ["status": status]
            if let notes { d["notes"] = notes }
            return d
        case .updateSchedule(_, let mode, let shifts):
            return ["mode": mode, "shifts": shifts]
        case .generateReport(let workspaceId, let type, let period, let start, let end):
            return ["workspaceId": workspaceId, "type": type, "period": period, "start": start, "end": end]
        case .updatePermission(_, let permissions):
            return ["permissions": permissions]
        case .updateProfile(let name, let avatarUrl):
            var d: [String: Any] = ["name": name]
            if let avatarUrl { d["avatar_url"] = avatarUrl }
            return d
        case .createPaperclipConnection(_, let displayName, let baseUrl, let companyId, let bearerToken):
            return ["displayName": displayName, "baseUrl": baseUrl, "companyId": companyId, "bearerToken": bearerToken]
        case .updatePaperclipConnection(_, _, let params):
            return params
        case .putThreadPaperclipLink(_, let connectionId, let objectType, let objectRef):
            return ["connectionId": connectionId, "objectType": objectType, "objectRef": objectRef]
        case .createAgentDocumentationLinkedApp(_, let name, let repoPath, let repoKey, let slug):
            var d: [String: Any] = ["name": name, "repoPath": repoPath]
            if let repoKey { d["repoKey"] = repoKey }
            if let slug { d["slug"] = slug }
            return d
        case .updateAgentDocumentationLinkedApp(_, _, let params),
             .updateAgentDocumentationBlueprint(_, _, let params):
            return params
        case .forkAgentDocumentationBlueprint(_, _, let name):
            var d: [String: Any] = [:]
            if let name { d["name"] = name }
            return d
        case .generateAgentDocumentationProposal(_, let linkedApplicationId, let mode, let blueprintIds, let packId):
            var d: [String: Any] = ["linkedApplicationId": linkedApplicationId, "mode": mode]
            if !blueprintIds.isEmpty { d["blueprintIds"] = blueprintIds }
            if let packId { d["packId"] = packId }
            return d
        case .applyAgentDocumentationProposal(_, _, let fileIds):
            return ["fileIds": fileIds]
        case .syncAgentDocumentationPackToLibrary(_, _, let targetFolder):
            var d: [String: Any] = [:]
            if let targetFolder { d["targetFolder"] = targetFolder }
            return d
        case .installAgentDocumentation(_, let packId, let agentId, let role),
             .refreshAgentDocumentationInstall(_, _, let packId, let agentId, let role):
            return ["packId": packId, "agentId": agentId, "role": role]
        case .exportAgentDocumentationState(_, let packId, let agentId, let snapshotKind, let exportToLibrary):
            var d: [String: Any] = ["exportToLibrary": exportToLibrary]
            if let packId { d["packId"] = packId }
            if let agentId { d["agentId"] = agentId }
            if let snapshotKind { d["snapshotKind"] = snapshotKind }
            return d
        case .updateAgentLibraryFile(_, _, let content):
            return ["content": content]
        case .archiveReport:
            return ["archived": true]
        case .changePassword(let current, let new):
            return ["currentPassword": current, "newPassword": new]
        case .deleteAccount(let currentPassword, let confirmation):
            return ["currentPassword": currentPassword, "confirmation": confirmation]
        case .submitAppleTransaction(_, let signedTransaction):
            return ["signedTransaction": signedTransaction]
        case .selectRuntimeProvisioningTarget(_, _, let runtimeHostId):
            return ["runtimeHostId": runtimeHostId]
        case .connectNativeAgentObservations(let workspaceId, let observationIds, let documentConsentVersion):
            return [
                "workspaceId": workspaceId,
                "observationIds": observationIds,
                "documentConsentVersion": documentConsentVersion,
            ]
        case .retryNativeAgentObservation(let workspaceId, _, let documentConsentVersion):
            return [
                "workspaceId": workspaceId,
                "documentConsentVersion": documentConsentVersion,
            ]
        case .disconnectNativeAgentObservation(let workspaceId, _):
            return ["workspaceId": workspaceId]
        case .dismissNativeAgentObservation(let workspaceId, _):
            return ["workspaceId": workspaceId]
        default:
            return [:]
        }
    }
}
