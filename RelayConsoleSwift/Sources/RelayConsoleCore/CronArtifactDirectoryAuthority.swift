import Foundation

struct CronArtifactDirectoryAuthority {
    private let paths: RelayConsolePaths
    private let fileManager: FileManager

    init(paths: RelayConsolePaths, fileManager: FileManager) {
        self.paths = paths
        self.fileManager = fileManager
    }

    func configuredDirectory(
        for job: [String: Any],
        prompt: String,
        workdir: String?
    ) -> URL? {
        let structured = text(job["output_directory"])
            ?? text(job["artifact_output_directory"])
        if let structured {
            guard let resolved = resolvedDirectory(structured, workdir: workdir),
                  isSafe(resolved)
            else { return nil }
            return resolved
        }
        return inferredDirectory(in: prompt, workdir: workdir)
    }

    func reconcile(agents: [AgentWithBinding]) throws -> Int {
        var repairedCount = 0
        for agent in agents {
            guard agent.binding.runtimeType == .hermes,
                  let homePath = nonEmpty(agent.binding.hermesHomePath)
            else { continue }
            let jobsURL = URL(fileURLWithPath: homePath, isDirectory: true)
                .appendingPathComponent("cron", isDirectory: true)
                .appendingPathComponent("jobs.json")
            repairedCount += try reconcile(jobsURL: jobsURL)
        }
        return repairedCount
    }

    private func reconcile(jobsURL: URL) throws -> Int {
        guard fileManager.fileExists(atPath: jobsURL.path) else { return 0 }
        let originalData = try Data(contentsOf: jobsURL)
        // Hermes can briefly expose an incomplete file while rewriting
        // scheduler state. Leave it untouched and retry on the next refresh.
        guard !originalData.isEmpty,
              var root = try? JSONSerialization.jsonObject(with: originalData)
        else { return 0 }

        let repairedCount: Int
        if var object = root as? [String: Any],
           var jobs = object["jobs"] as? [[String: Any]] {
            repairedCount = reconcile(jobs: &jobs)
            guard repairedCount > 0 else { return 0 }
            object["jobs"] = jobs
            object["updated_at"] = ISO8601DateFormatter.relayConsole.string(from: Date())
            root = object
        } else if var jobs = root as? [[String: Any]] {
            repairedCount = reconcile(jobs: &jobs)
            guard repairedCount > 0 else { return 0 }
            root = jobs
        } else {
            return 0
        }

        // Do not overwrite scheduler progress that landed after our read.
        guard (try? Data(contentsOf: jobsURL)) == originalData else { return 0 }
        let output = try JSONSerialization.data(
            withJSONObject: root,
            options: [.prettyPrinted, .sortedKeys]
        )
        try output.write(to: jobsURL, options: [.atomic])
        try? fileManager.setAttributes(
            [.posixPermissions: 0o600],
            ofItemAtPath: jobsURL.path
        )
        return repairedCount
    }

    private func reconcile(jobs: inout [[String: Any]]) -> Int {
        var repairedCount = 0
        for index in jobs.indices {
            if text(jobs[index]["output_directory"]) != nil
                || text(jobs[index]["artifact_output_directory"]) != nil {
                continue
            }
            let prompt = text(jobs[index]["prompt"]) ?? ""
            let workdir = text(jobs[index]["workdir"])
            guard let outputDirectory = inferredDirectory(
                in: prompt,
                workdir: workdir
            ) else { continue }
            jobs[index]["output_directory"] = outputDirectory.path
            repairedCount += 1
        }
        return repairedCount
    }

    private func inferredDirectory(in prompt: String, workdir: String?) -> URL? {
        if let explicit = explicitDirectory(in: prompt),
           let resolved = resolvedDirectory(explicit, workdir: workdir),
           isSafe(resolved) {
            return resolved
        }
        guard let legacyFilePath = legacyArtifactFilePath(in: prompt) else {
            return nil
        }
        let directory = URL(fileURLWithPath: legacyFilePath, isDirectory: false)
            .standardizedFileURL
            .deletingLastPathComponent()
        // Natural-language recovery is narrower than the exact marker. It
        // repairs existing Relay-owned outputs without treating an arbitrary
        // path in an agent prompt as filesystem scan authorization.
        let cronRoot = paths.artifactsDir
            .appendingPathComponent("cron", isDirectory: true)
            .standardizedFileURL.path
        guard directory.path.hasPrefix(cronRoot + "/"), isSafe(directory) else {
            return nil
        }
        return directory
    }

    private func explicitDirectory(in prompt: String) -> String? {
        if let marked = markedDirectory(in: prompt) {
            return marked
        }
        for pattern in [
            #"Documentation output directory:\s*([^\n]+)"#,
            #"output directory:\s*([^\n]+)"#,
            #"under the output directory:\s*([^\n]+)"#
        ] {
            guard let regex = try? NSRegularExpression(
                pattern: pattern,
                options: [.caseInsensitive]
            ) else { continue }
            let range = NSRange(prompt.startIndex..<prompt.endIndex, in: prompt)
            if let match = regex.firstMatch(in: prompt, range: range),
               match.numberOfRanges > 1,
               let swiftRange = Range(match.range(at: 1), in: prompt) {
                return String(prompt[swiftRange])
                    .trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        return nil
    }

    private func markedDirectory(in prompt: String) -> String? {
        let marker = NSRegularExpression.escapedPattern(
            for: RuntimeArtifactContract.cronOutputMarker
        )
        let endMarker = NSRegularExpression.escapedPattern(
            for: RuntimeArtifactContract.cronOutputEndMarker
        )
        let pattern = #"\#(marker)\s*\r?\nDirectory:\s*([^\r\n]+)\r?\n\#(endMarker)"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(
                in: prompt,
                range: NSRange(prompt.startIndex..<prompt.endIndex, in: prompt)
              ),
              match.numberOfRanges > 1,
              let range = Range(match.range(at: 1), in: prompt)
        else { return nil }
        return String(prompt[range]).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func legacyArtifactFilePath(in prompt: String) -> String? {
        let extensions = [
            "md", "markdown", "txt", "rtf", "pdf", "doc", "docx",
            "png", "jpg", "jpeg", "gif", "webp", "heic", "svg",
            "mov", "mp4", "m4v", "webm", "mp3", "m4a", "wav", "aac",
            "flac", "json", "csv", "tsv", "yaml", "yml", "xml", "sql"
        ].joined(separator: "|")
        let pattern =
            #"(?:durable\s+Relay\s+Console\s+artifact(?:\s+on\s+every\s+run)?|artifact\s+output\s+file)\s*:\s*[`"']?(/[^\r\n]*?\.(?:\#(extensions)))(?=[`"']?(?:[\s.]|$))"#
        guard let regex = try? NSRegularExpression(
            pattern: pattern,
            options: [.caseInsensitive]
        ),
              let match = regex.firstMatch(
                in: prompt,
                range: NSRange(prompt.startIndex..<prompt.endIndex, in: prompt)
              ),
              match.numberOfRanges > 1,
              let range = Range(match.range(at: 1), in: prompt)
        else { return nil }
        return String(prompt[range]).trimmingCharacters(
            in: CharacterSet(charactersIn: "`\"' ")
        )
    }

    private func resolvedDirectory(_ raw: String, workdir: String?) -> URL? {
        let trimmed = raw.trimmingCharacters(
            in: CharacterSet(charactersIn: "`\"' \t\r\n")
        )
        guard !trimmed.isEmpty else { return nil }
        if trimmed.hasPrefix("/") {
            return URL(fileURLWithPath: trimmed, isDirectory: true).standardizedFileURL
        }
        guard let workdir = nonEmpty(workdir) else { return nil }
        return URL(fileURLWithPath: workdir, isDirectory: true)
            .appendingPathComponent(trimmed, isDirectory: true)
            .standardizedFileURL
    }

    private func isSafe(_ directory: URL) -> Bool {
        let path = directory.standardizedFileURL.path
        let home = fileManager.homeDirectoryForCurrentUser.standardizedFileURL.path
        let blocked = Set([
            "/", "/Users", home, home + "/Library",
            home + "/Library/Application Support",
            paths.root.standardizedFileURL.path,
            paths.artifactsDir.standardizedFileURL.path,
            paths.artifactsDir.appendingPathComponent(
                "cron",
                isDirectory: true
            ).standardizedFileURL.path
        ])
        return path.hasPrefix("/") && !blocked.contains(path)
    }

    private func text(_ value: Any?) -> String? {
        nonEmpty(value as? String)
    }

    private func nonEmpty(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
