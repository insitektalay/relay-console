import Foundation
import SQLite3

public enum SQLiteValue: Sendable, Equatable {
    case text(String)
    case integer(Int64)
    case real(Double)
    case null

    var string: String? {
        switch self {
        case .text(let value): return value
        case .integer(let value): return String(value)
        case .real(let value): return String(value)
        case .null: return nil
        }
    }

    var bool: Bool {
        switch self {
        case .integer(let value): return value != 0
        case .text(let value): return value == "1" || value.lowercased() == "true"
        default: return false
        }
    }

    var int: Int? {
        switch self {
        case .integer(let value): return Int(value)
        case .text(let value): return Int(value)
        case .real(let value): return Int(value)
        case .null: return nil
        }
    }
}

public final class DatabaseService {
    private let databasePath: URL
    private var db: OpaquePointer?
    private let lock = NSRecursiveLock()
    private var inTransaction = false

    public init(databasePath: URL) {
        self.databasePath = databasePath
    }

    deinit {
        close()
    }

    public func open() throws {
        try FileManager.default.createDirectory(at: databasePath.deletingLastPathComponent(), withIntermediateDirectories: true)
        guard sqlite3_open(databasePath.path, &db) == SQLITE_OK else {
            throw RelayError(.databaseUnavailable, "Relay Console database could not be opened.")
        }
        try exec("PRAGMA foreign_keys = ON;")
        try exec("PRAGMA journal_mode = WAL;")
        try hardenDatabaseFiles()
    }

    public func close() {
        lock.lock()
        defer { lock.unlock() }
        if let db {
            sqlite3_close(db)
        }
        db = nil
    }

    public func exec(_ sql: String) throws {
        lock.lock()
        defer { lock.unlock() }
        var error: UnsafeMutablePointer<Int8>?
        guard sqlite3_exec(try requireDb(), sql, nil, nil, &error) == SQLITE_OK else {
            let message = error.map { String(cString: $0) } ?? "SQLite exec failed."
            sqlite3_free(error)
            throw RelayError(.databaseUnavailable, message)
        }
    }

    @discardableResult
    public func run(_ sql: String, _ params: [SQLiteValue] = []) throws -> Int {
        lock.lock()
        defer { lock.unlock() }
        let statement = try prepare(sql, params)
        defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw RelayError(.databaseUnavailable, sqliteError())
        }
        return Int(sqlite3_changes(try requireDb()))
    }

    public func get(_ sql: String, _ params: [SQLiteValue] = []) throws -> [String: SQLiteValue]? {
        try all(sql, params).first
    }

    public func all(_ sql: String, _ params: [SQLiteValue] = []) throws -> [[String: SQLiteValue]] {
        lock.lock()
        defer { lock.unlock() }
        let statement = try prepare(sql, params)
        defer { sqlite3_finalize(statement) }
        var rows: [[String: SQLiteValue]] = []
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_DONE {
                break
            }
            guard code == SQLITE_ROW else {
                throw RelayError(.databaseUnavailable, sqliteError())
            }
            rows.append(row(statement))
        }
        return rows
    }

    public func transaction<T>(_ operation: () throws -> T) throws -> T {
        lock.lock()
        defer { lock.unlock() }
        let already = inTransaction
        if !already {
            try run("BEGIN")
            inTransaction = true
        }
        do {
            let result = try operation()
            if !already {
                try run("COMMIT")
                inTransaction = false
            }
            return result
        } catch {
            if !already {
                _ = try? run("ROLLBACK")
                inTransaction = false
            }
            throw error
        }
    }

    private func requireDb() throws -> OpaquePointer {
        guard let db else {
            throw RelayError(.databaseUnavailable, "Relay Console database is not open.")
        }
        return db
    }

    private func hardenDatabaseFiles() throws {
        for url in [
            databasePath,
            URL(fileURLWithPath: databasePath.path + "-wal"),
            URL(fileURLWithPath: databasePath.path + "-shm")
        ] where FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
        }
    }

    private func sqliteError() -> String {
        guard let db else { return "Relay Console database is not open." }
        return String(cString: sqlite3_errmsg(db))
    }

    private func prepare(_ sql: String, _ params: [SQLiteValue]) throws -> OpaquePointer? {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(try requireDb(), sql, -1, &statement, nil) == SQLITE_OK else {
            throw RelayError(.databaseUnavailable, sqliteError())
        }
        for (index, value) in params.enumerated() {
            let slot = Int32(index + 1)
            switch value {
            case .text(let string):
                sqlite3_bind_text(statement, slot, string, -1, SQLITE_TRANSIENT)
            case .integer(let int):
                sqlite3_bind_int64(statement, slot, int)
            case .real(let double):
                sqlite3_bind_double(statement, slot, double)
            case .null:
                sqlite3_bind_null(statement, slot)
            }
        }
        return statement
    }

    private func row(_ statement: OpaquePointer?) -> [String: SQLiteValue] {
        var output: [String: SQLiteValue] = [:]
        let count = sqlite3_column_count(statement)
        for index in 0..<count {
            let name = String(cString: sqlite3_column_name(statement, index))
            switch sqlite3_column_type(statement, index) {
            case SQLITE_INTEGER:
                output[name] = .integer(sqlite3_column_int64(statement, index))
            case SQLITE_FLOAT:
                output[name] = .real(sqlite3_column_double(statement, index))
            case SQLITE_TEXT:
                output[name] = .text(String(cString: sqlite3_column_text(statement, index)))
            default:
                output[name] = .null
            }
        }
        return output
    }
}

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
