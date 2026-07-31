// ClawDataModels.swift
// ClawChat – SwiftData models for local caching
// Swift 6, iOS 17+

import Foundation
import SwiftData

// MARK: - CachedWorkspace

@Model
final class CachedWorkspace {
    @Attribute(.unique) var id: String
    var name: String
    var type: String
    var avatarUrl: String?
    var unreadCount: Int
    var agentCount: Int
    var lastSyncedAt: Date
    var data: Data  // Full JSON blob

    init(from workspace: Workspace) {
        self.id           = workspace.id
        self.name         = workspace.name
        self.type         = workspace.type.rawValue
        self.avatarUrl    = workspace.avatarUrl
        self.unreadCount  = workspace.unreadCount
        self.agentCount   = workspace.agentCount
        self.lastSyncedAt = Date()
        self.data         = (try? APIClient.encoder.encode(workspace)) ?? Data()
    }

    func update(from workspace: Workspace) {
        name         = workspace.name
        type         = workspace.type.rawValue
        avatarUrl    = workspace.avatarUrl
        unreadCount  = workspace.unreadCount
        agentCount   = workspace.agentCount
        lastSyncedAt = Date()
        data         = (try? APIClient.encoder.encode(workspace)) ?? data
    }

    func toWorkspace() -> Workspace? {
        try? APIClient.decoder.decode(Workspace.self, from: data)
    }
}

// MARK: - CachedThread

@Model
final class CachedThread {
    @Attribute(.unique) var id: String
    var workspaceId: String
    var title: String
    var type: String
    var unreadCount: Int
    var isPinned: Bool
    var lastMessageAt: Date?
    var lastSyncedAt: Date
    var data: Data

    init(from thread: Thread) {
        self.id            = thread.id
        self.workspaceId   = thread.workspaceId
        self.title         = thread.title
        self.type          = thread.type.rawValue
        self.unreadCount   = thread.unreadCount
        self.isPinned      = thread.isPinned
        self.lastMessageAt = thread.lastMessage?.timestamp
        self.lastSyncedAt  = Date()
        self.data          = (try? APIClient.encoder.encode(thread)) ?? Data()
    }

    func update(from thread: Thread) {
        workspaceId   = thread.workspaceId
        title         = thread.title
        type          = thread.type.rawValue
        unreadCount   = thread.unreadCount
        isPinned      = thread.isPinned
        lastMessageAt = thread.lastMessage?.timestamp ?? thread.updatedAt
        lastSyncedAt  = Date()
        data          = (try? APIClient.encoder.encode(thread)) ?? data
    }

    func toThread() -> Thread? {
        try? APIClient.decoder.decode(Thread.self, from: data)
    }
}

// MARK: - CachedMessage

@Model
final class CachedMessage {
    @Attribute(.unique) var id: String
    var threadId: String
    var content: String
    var senderId: String
    var createdAt: Date
    var data: Data

    init(from message: Message) {
        self.id        = message.id
        self.threadId  = message.threadId
        self.content   = message.content
        self.senderId  = message.senderId
        self.createdAt = message.createdAt
        self.data      = (try? APIClient.encoder.encode(message)) ?? Data()
    }

    func update(from message: Message) {
        threadId  = message.threadId
        content   = message.content
        senderId  = message.senderId
        createdAt = message.createdAt
        data      = (try? APIClient.encoder.encode(message)) ?? data
    }

    func toMessage() -> Message? {
        try? APIClient.decoder.decode(Message.self, from: data)
    }
}

// MARK: - CachedAgent

@Model
final class CachedAgent {
    @Attribute(.unique) var id: String
    var workspaceId: String
    var name: String
    var status: String
    var lastSyncedAt: Date
    var data: Data

    init(from agent: Agent) {
        self.id           = agent.id
        self.workspaceId  = agent.workspaceId
        self.name         = agent.name
        self.status       = agent.status.rawValue
        self.lastSyncedAt = Date()
        self.data         = (try? APIClient.encoder.encode(agent)) ?? Data()
    }

    func update(from agent: Agent) {
        workspaceId  = agent.workspaceId
        name         = agent.name
        status       = agent.status.rawValue
        lastSyncedAt = Date()
        data         = (try? APIClient.encoder.encode(agent)) ?? data
    }

    func toAgent() -> Agent? {
        try? APIClient.decoder.decode(Agent.self, from: data)
    }
}

// MARK: - CachedTask

@Model
final class CachedTask {
    @Attribute(.unique) var id: String
    var workspaceId: String
    var title: String
    var status: String
    var lastSyncedAt: Date
    var data: Data

    init(from task: Task) {
        self.id           = task.id
        self.workspaceId  = task.workspaceId
        self.title        = task.title
        self.status       = task.status.rawValue
        self.lastSyncedAt = Date()
        self.data         = (try? APIClient.encoder.encode(task)) ?? Data()
    }

    func toTask() -> Task? {
        try? APIClient.decoder.decode(Task.self, from: data)
    }
}

// MARK: - CachedAlert

@Model
final class CachedAlert {
    @Attribute(.unique) var id: String
    var workspaceId: String
    var isRead: Bool
    var createdAt: Date
    var data: Data

    init(from alert: Alert) {
        self.id          = alert.id
        self.workspaceId = alert.workspaceId
        self.isRead      = alert.isRead
        self.createdAt   = alert.createdAt
        self.data        = (try? APIClient.encoder.encode(alert)) ?? Data()
    }

    func toAlert() -> Alert? {
        try? APIClient.decoder.decode(Alert.self, from: data)
    }
}
