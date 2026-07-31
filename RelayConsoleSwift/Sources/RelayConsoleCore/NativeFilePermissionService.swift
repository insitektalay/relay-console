import Foundation

public struct NativeFilePermissionRequest: Codable, Equatable, Sendable {
    public var targetKind: NativeFilePermissionTargetKind
    public var displayName: String?
    public var rawPath: String?
    public var bookmarkRef: String?
    public var accessLevel: NativeFilePermissionAccessLevel
    public var status: NativeFilePermissionStatus?
    public var relatedTaskId: RelayId?
    public var relatedToolRequestId: RelayId?
    public var relatedActionRunId: RelayId?
    public var metadata: JSONRecord

    public init(
        targetKind: NativeFilePermissionTargetKind,
        displayName: String? = nil,
        rawPath: String? = nil,
        bookmarkRef: String? = nil,
        accessLevel: NativeFilePermissionAccessLevel,
        status: NativeFilePermissionStatus? = nil,
        relatedTaskId: RelayId? = nil,
        relatedToolRequestId: RelayId? = nil,
        relatedActionRunId: RelayId? = nil,
        metadata: JSONRecord = [:]
    ) {
        self.targetKind = targetKind
        self.displayName = displayName
        self.rawPath = rawPath
        self.bookmarkRef = bookmarkRef
        self.accessLevel = accessLevel
        self.status = status
        self.relatedTaskId = relatedTaskId
        self.relatedToolRequestId = relatedToolRequestId
        self.relatedActionRunId = relatedActionRunId
        self.metadata = metadata
    }
}

public final class NativeFilePermissionService {
    private let data: LocalDataService
    private let permissions: PermissionPolicyService?
    private let auditSecurity: AuditSecurityService?

    public init(
        data: LocalDataService,
        permissions: PermissionPolicyService? = nil,
        auditSecurity: AuditSecurityService? = nil
    ) {
        self.data = data
        self.permissions = permissions
        self.auditSecurity = auditSecurity
    }

    @discardableResult
    public func linkPermission(
        context: ServiceRequestContext,
        request: NativeFilePermissionRequest,
        now: Date = Date()
    ) throws -> NativeFilePermissionRecord {
        try requireMutationAccess(context: context, message: "Linking native file permission requires owner or admin authority.")
        try requirePermission(
            context: context,
            resourceId: nil,
            action: "link",
            eventAction: "link",
            detail: permissionDetail(action: "link", request: request),
            now: now
        )

        let timestamp = iso(now)
        let rawPath = request.rawPath?.trimmingCharacters(in: .whitespacesAndNewlines)
        let name = Self.summarizedDisplayName(request.displayName, targetKind: request.targetKind)
        let record = NativeFilePermissionRecord(
            id: createRelayId("nfperm"),
            workspaceId: context.workspaceId,
            targetKind: request.targetKind,
            displayName: name,
            displayPath: Self.summarizedDisplayPath(name: name, targetKind: request.targetKind, rawPath: rawPath),
            pathHash: rawPath.map { Self.stableHash("\(request.targetKind.rawValue):\($0)") },
            bookmarkRef: request.bookmarkRef.map(Self.opaqueBookmarkRef),
            accessLevel: request.accessLevel,
            status: request.status ?? Self.defaultStatus(accessLevel: request.accessLevel, bookmarkRef: request.bookmarkRef),
            relatedTaskId: request.relatedTaskId,
            relatedToolRequestId: request.relatedToolRequestId,
            relatedActionRunId: request.relatedActionRunId,
            lastValidatedAt: timestamp,
            lastSyncedAt: nil,
            failureReason: nil,
            metadata: guardedMetadata(request.metadata).merging([
                "rawPathPersisted": .bool(false),
                "sourceSyncExcluded": .bool(true),
                "localAppWorkflowExcluded": .bool(true),
                "paperclipExcluded": .bool(true),
                "generatedPackExcluded": .bool(true),
                "nativePermissionRecord": .bool(true)
            ]) { _, new in new },
            createdByActorId: context.actorId,
            updatedByActorId: context.actorId,
            revokedAt: nil,
            createdAt: timestamp,
            updatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
        let saved = try data.saveNativeFilePermission(record)
        recordAudit(
            context: context,
            eventType: "file_permission.linked",
            message: "Native file permission record linked.",
            permission: saved,
            action: "link",
            now: now
        )
        return saved
    }

    public func listPermissions(
        context: ServiceRequestContext,
        status: NativeFilePermissionStatus? = nil,
        limit: Int = 100,
        now: Date = Date()
    ) throws -> [NativeFilePermissionRecord] {
        try requireReadAccess(context: context)
        try requirePermission(
            context: context,
            resourceId: nil,
            action: "read",
            eventAction: "read",
            detail: [
                "action": .string("read"),
                "status": status.map { .string($0.rawValue) } ?? .null
            ],
            now: now
        )
        return try data.listNativeFilePermissions(workspaceId: context.workspaceId, status: status, limit: limit)
    }

    public func getPermission(
        context: ServiceRequestContext,
        permissionId: RelayId,
        now: Date = Date()
    ) throws -> NativeFilePermissionRecord? {
        try requireReadAccess(context: context)
        try requirePermission(
            context: context,
            resourceId: permissionId,
            action: "read",
            eventAction: "read",
            detail: [
                "action": .string("read"),
                "permissionId": .string(permissionId)
            ],
            now: now
        )
        return try data.getNativeFilePermission(workspaceId: context.workspaceId, permissionId: permissionId)
    }

    @discardableResult
    public func updateStatus(
        context: ServiceRequestContext,
        permissionId: RelayId,
        status: NativeFilePermissionStatus,
        accessLevel: NativeFilePermissionAccessLevel? = nil,
        failureReason: String? = nil,
        now: Date = Date()
    ) throws -> NativeFilePermissionRecord {
        try requireMutationAccess(context: context, message: "Updating native file permission requires owner or admin authority.")
        var record = try requireRecord(context: context, permissionId: permissionId, now: now)
        try requirePermission(
            context: context,
            resourceId: record.id,
            action: "update",
            eventAction: "update",
            detail: permissionDetail(action: "update", permission: record, status: status),
            now: now
        )
        let timestamp = iso(now)
        let previousStatus = record.status
        record.status = status
        if let accessLevel {
            record.accessLevel = accessLevel
        }
        record.failureReason = failureReason
        record.lastValidatedAt = timestamp
        if status == .synced {
            record.lastSyncedAt = timestamp
        }
        if status == .revoked {
            record.bookmarkRef = nil
            record.revokedAt = timestamp
        }
        record.updatedByActorId = context.actorId
        record.updatedAt = timestamp
        let saved = try data.saveNativeFilePermission(record)
        recordAudit(
            context: context,
            eventType: status == .syncFailed ? "file_permission.sync_failed" : "file_permission.status_changed",
            severity: status == .syncFailed ? "warning" : "info",
            message: "Native file permission status changed.",
            permission: saved,
            action: "update",
            extra: [
                "previousStatus": .string(previousStatus.rawValue),
                "nextStatus": .string(status.rawValue)
            ],
            now: now
        )
        return saved
    }

    @discardableResult
    public func revokePermission(
        context: ServiceRequestContext,
        permissionId: RelayId,
        now: Date = Date()
    ) throws -> NativeFilePermissionRecord {
        try requireMutationAccess(context: context, message: "Revoking native file permission requires owner or admin authority.")
        var record = try requireRecord(context: context, permissionId: permissionId, now: now)
        try requirePermission(
            context: context,
            resourceId: record.id,
            action: "revoke",
            eventAction: "revoke",
            detail: permissionDetail(action: "revoke", permission: record, status: .revoked),
            now: now
        )
        let timestamp = iso(now)
        record.status = .revoked
        record.bookmarkRef = nil
        record.revokedAt = timestamp
        record.updatedAt = timestamp
        record.updatedByActorId = context.actorId
        let saved = try data.saveNativeFilePermission(record)
        recordAudit(
            context: context,
            eventType: "file_permission.revoked",
            severity: "warning",
            message: "Native file permission was revoked.",
            permission: saved,
            action: "revoke",
            now: now
        )
        return saved
    }

    @discardableResult
    public func unlinkPermission(
        context: ServiceRequestContext,
        permissionId: RelayId,
        now: Date = Date()
    ) throws -> NativeFilePermissionRecord {
        try requireMutationAccess(context: context, message: "Unlinking native file permission requires owner or admin authority.")
        var record = try requireRecord(context: context, permissionId: permissionId, now: now)
        try requirePermission(
            context: context,
            resourceId: record.id,
            action: "unlink",
            eventAction: "unlink",
            detail: permissionDetail(action: "unlink", permission: record, status: .notLinked),
            now: now
        )
        let timestamp = iso(now)
        record.status = .notLinked
        record.displayPath = "Unlinked \(record.targetKind.rawValue) ([REDACTED])"
        record.pathHash = nil
        record.bookmarkRef = nil
        record.failureReason = nil
        record.updatedAt = timestamp
        record.updatedByActorId = context.actorId
        let saved = try data.saveNativeFilePermission(record)
        recordAudit(
            context: context,
            eventType: "file_permission.unlinked",
            message: "Native file permission was unlinked.",
            permission: saved,
            action: "unlink",
            now: now
        )
        return saved
    }

    @discardableResult
    public func requireAccess(
        context: ServiceRequestContext,
        permissionId: RelayId,
        requiredAccess: NativeFilePermissionAccessLevel,
        action: String? = nil,
        now: Date = Date()
    ) throws -> NativeFilePermissionRecord {
        let permissionAction = action ?? (requiredAccess == .readOnly ? "read" : "write")
        let record = try requireRecord(context: context, permissionId: permissionId, now: now)
        try requirePermission(
            context: context,
            resourceId: record.id,
            action: permissionAction,
            eventAction: permissionAction,
            detail: permissionDetail(action: permissionAction, permission: record, status: record.status),
            now: now
        )
        try requireUsableState(context: context, permission: record, requiredAccess: requiredAccess, action: permissionAction, now: now)
        return record
    }

    public static func statusTitle(for permission: NativeFilePermissionRecord) -> String {
        switch permission.status {
        case .notLinked:
            return "Not linked"
        case .permissionNeeded:
            return "Permission needed"
        case .linked:
            return "Linked"
        case .readOnly:
            return "Read only"
        case .readWriteGranted:
            return "Read/write granted"
        case .revoked:
            return "Revoked"
        case .unavailable:
            return "Unavailable"
        case .synced:
            return "Synced"
        case .stale:
            return "Stale"
        case .syncFailed:
            return "Sync failed"
        }
    }

    public static func exportLines(for permissions: [NativeFilePermissionRecord]) -> [String] {
        var lines = ["Native File Permissions", "Records: \(permissions.count)"]
        for permission in permissions {
            lines.append("Name: \(permission.displayName)")
            lines.append("Target: \(permission.targetKind.rawValue)")
            lines.append("Path: \(permission.displayPath)")
            lines.append("Access: \(permission.accessLevel.rawValue)")
            lines.append("Status: \(statusTitle(for: permission))")
            lines.append("Mode: source-backed retained native file permission")
            lines.append("Local app/source sync: excluded")
        }
        return lines
    }

    private func requireRecord(
        context: ServiceRequestContext,
        permissionId: RelayId,
        now: Date
    ) throws -> NativeFilePermissionRecord {
        guard let record = try data.getNativeFilePermission(workspaceId: context.workspaceId, permissionId: permissionId) else {
            recordDenied(
                context: context,
                permission: nil,
                action: "lookup",
                reasonCode: .permissionNeeded,
                stateKind: .permissionNeeded,
                message: "Native file permission record is missing.",
                now: now
            )
            throw ServiceGuardResult(
                stateKind: .permissionNeeded,
                reasonCode: .permissionNeeded,
                message: "Native file permission is required before file access can continue.",
                recovery: "Ask a workspace owner or admin to link the file or folder again.",
                correlationId: context.correlationId,
                auditRequired: true,
                retryable: false
            )
        }
        return record
    }

    private func requireUsableState(
        context: ServiceRequestContext,
        permission: NativeFilePermissionRecord,
        requiredAccess: NativeFilePermissionAccessLevel,
        action: String,
        now: Date
    ) throws {
        guard permission.status.allowsFileAccess else {
            let reason = permission.status == .stale || permission.status == .syncFailed ? GuardReasonCode.errorRetryable : .permissionNeeded
            let state = permission.status == .stale || permission.status == .syncFailed ? GuardedStateKind.retryableError : .permissionNeeded
            recordDenied(
                context: context,
                permission: permission,
                action: action,
                reasonCode: reason,
                stateKind: state,
                message: "Native file permission is not currently usable.",
                now: now
            )
            throw ServiceGuardResult(
                stateKind: state,
                reasonCode: reason,
                message: "Native file permission is not currently usable.",
                recovery: "Refresh or relink the native file permission before retrying.",
                correlationId: context.correlationId,
                auditRequired: true,
                retryable: state == .retryableError
            )
        }
        if requiredAccess == .readWrite && permission.accessLevel != .readWrite {
            recordDenied(
                context: context,
                permission: permission,
                action: action,
                reasonCode: .authorityReadOnly,
                stateKind: .readOnly,
                message: "Native file permission is read-only.",
                now: now
            )
            throw ServiceGuardResult(
                stateKind: .readOnly,
                reasonCode: .authorityReadOnly,
                message: "Native file permission is read-only.",
                recovery: "Ask a workspace owner or admin to grant read/write access.",
                correlationId: context.correlationId,
                auditRequired: true,
                retryable: false
            )
        }
        if requiredAccess == .readWrite && !permission.status.allowsWriteAccess {
            recordDenied(
                context: context,
                permission: permission,
                action: action,
                reasonCode: .permissionNeeded,
                stateKind: .permissionNeeded,
                message: "Native file permission does not include read/write authorization.",
                now: now
            )
            throw ServiceGuardResult(
                stateKind: .permissionNeeded,
                reasonCode: .permissionNeeded,
                message: "Native file permission does not include read/write authorization.",
                recovery: "Grant read/write access before retrying.",
                correlationId: context.correlationId,
                auditRequired: true,
                retryable: false
            )
        }
    }

    private func requireReadAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .member, .viewer, .approver, .operator],
            context: context,
            message: "Reading native file permission records requires workspace access."
        ) {
            throw denied
        }
    }

    private func requireMutationAccess(context: ServiceRequestContext, message: String) throws {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context, message: message) {
            throw denied
        }
    }

    private func requirePermission(
        context: ServiceRequestContext,
        resourceId: RelayId?,
        action: String,
        eventAction: String,
        detail: JSONRecord,
        now: Date
    ) throws {
        do {
            try permissions?.requireAllowed(
                context: context,
                resourceType: "native_file_permission",
                resourceId: resourceId,
                action: action,
                detail: detail,
                now: now
            )
        } catch let denied as ServiceGuardResult {
            recordDenied(
                context: context,
                permission: nil,
                action: eventAction,
                reasonCode: denied.reasonCode,
                stateKind: denied.stateKind,
                message: denied.message,
                now: now
            )
            throw denied
        }
    }

    private func recordDenied(
        context: ServiceRequestContext,
        permission: NativeFilePermissionRecord?,
        action: String,
        reasonCode: GuardReasonCode,
        stateKind: GuardedStateKind,
        message: String,
        now: Date
    ) {
        var detail: JSONRecord = [
            "action": .string(action),
            "stateKind": .string(stateKind.rawValue),
            "reasonCode": .string(reasonCode.rawValue),
            "redactionStatus": .string("private-state-excluded"),
            "rawPathPersisted": .bool(false)
        ]
        if let permission {
            detail.merge(permissionAuditDetail(permission)) { _, new in new }
        }
        _ = auditSecurity?.record(
            context: context,
            request: AuditLogRecordRequest(
                eventType: "file_permission.denied",
                resourceType: "native_file_permission",
                resourceId: permission?.id,
                severity: "warning",
                message: message,
                taskId: permission?.relatedTaskId,
                actionRunId: permission?.relatedActionRunId,
                source: "native-file-permission-service",
                context: detail
            ),
            now: now
        )
    }

    private func recordAudit(
        context: ServiceRequestContext,
        eventType: String,
        severity: String = "info",
        message: String,
        permission: NativeFilePermissionRecord,
        action: String,
        extra: JSONRecord = [:],
        now: Date
    ) {
        var detail = permissionAuditDetail(permission)
        detail["action"] = .string(action)
        detail["rawPathPersisted"] = .bool(false)
        detail["redactionStatus"] = .string("private-state-excluded")
        detail.merge(extra) { _, new in new }
        _ = auditSecurity?.record(
            context: context,
            request: AuditLogRecordRequest(
                eventType: eventType,
                resourceType: "native_file_permission",
                resourceId: permission.id,
                severity: severity,
                message: message,
                taskId: permission.relatedTaskId,
                actionRunId: permission.relatedActionRunId,
                source: "native-file-permission-service",
                context: detail
            ),
            now: now
        )
    }

    private func permissionAuditDetail(_ permission: NativeFilePermissionRecord) -> JSONRecord {
        [
            "permissionId": .string(permission.id),
            "targetKind": .string(permission.targetKind.rawValue),
            "displayPath": .string(permission.displayPath),
            "accessLevel": .string(permission.accessLevel.rawValue),
            "status": .string(permission.status.rawValue),
            "relatedTaskId": permission.relatedTaskId.map(JSONValue.string) ?? .null,
            "relatedToolRequestId": permission.relatedToolRequestId.map(JSONValue.string) ?? .null,
            "relatedActionRunId": permission.relatedActionRunId.map(JSONValue.string) ?? .null
        ]
    }

    private func permissionDetail(
        action: String,
        request: NativeFilePermissionRequest
    ) -> JSONRecord {
        [
            "action": .string(action),
            "targetKind": .string(request.targetKind.rawValue),
            "accessLevel": .string(request.accessLevel.rawValue),
            "status": request.status.map { .string($0.rawValue) } ?? .null,
            "rawPathPersisted": .bool(false),
            "sourceSyncExcluded": .bool(true)
        ]
    }

    private func permissionDetail(
        action: String,
        permission: NativeFilePermissionRecord,
        status: NativeFilePermissionStatus
    ) -> JSONRecord {
        permissionAuditDetail(permission).merging([
            "action": .string(action),
            "nextStatus": .string(status.rawValue),
            "rawPathPersisted": .bool(false),
            "sourceSyncExcluded": .bool(true)
        ]) { _, new in new }
    }

    private func guardedMetadata(_ metadata: JSONRecord) -> JSONRecord {
        metadata.merging([
            "source": .string("native-file-permission-service")
        ]) { _, new in new }
    }

    private static func defaultStatus(
        accessLevel: NativeFilePermissionAccessLevel,
        bookmarkRef: String?
    ) -> NativeFilePermissionStatus {
        guard bookmarkRef != nil else { return .permissionNeeded }
        return accessLevel == .readWrite ? .readWriteGranted : .readOnly
    }

    private static func summarizedDisplayName(
        _ displayName: String?,
        targetKind: NativeFilePermissionTargetKind
    ) -> String {
        let fallback = targetKind == .folder ? "Linked folder" : "Linked file"
        guard let trimmed = displayName?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
            return fallback
        }
        if trimmed.hasPrefix("/") || trimmed.hasPrefix("~") || trimmed.contains("\\") {
            return fallback
        }
        return String(trimmed.prefix(120))
    }

    private static func summarizedDisplayPath(
        name: String,
        targetKind: NativeFilePermissionTargetKind,
        rawPath: String?
    ) -> String {
        let target = targetKind == .folder ? "folder" : "file"
        guard rawPath?.isEmpty == false else {
            return "\(target) \(name) ([REDACTED])"
        }
        return "\(target) \(name) ([REDACTED])"
    }

    private static func opaqueBookmarkRef(_ bookmarkRef: String) -> String {
        "bookmark-\(stableHash(bookmarkRef))"
    }

    private static func stableHash(_ value: String) -> String {
        var hash: UInt64 = 14695981039346656037
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1099511628211
        }
        return String(format: "%016llx", hash)
    }

    private func iso(_ date: Date) -> IsoTimestamp {
        ISO8601DateFormatter.relayConsole.string(from: date)
    }
}

private extension NativeFilePermissionStatus {
    var allowsFileAccess: Bool {
        switch self {
        case .linked, .readOnly, .readWriteGranted, .synced:
            return true
        case .notLinked, .permissionNeeded, .revoked, .unavailable, .stale, .syncFailed:
            return false
        }
    }

    var allowsWriteAccess: Bool {
        switch self {
        case .readWriteGranted, .synced:
            return true
        case .linked, .readOnly, .notLinked, .permissionNeeded, .revoked, .unavailable, .stale, .syncFailed:
            return false
        }
    }
}
