import Darwin
import Foundation
import RelayConsoleCore

@main
struct RelayHostServiceMain {
    static func main() async {
        do {
            let services = try RelayConsoleServices(
                refreshInstalledHarnessesOnLaunch: false,
                startRuntimeBrokerServer: false,
                startAutomaticCloudSync: false
            )
            let daemon = RelayHostDaemon(services: services)
            try await daemon.run()
        } catch {
            FileHandle.standardError.write(
                Data("Relay Host stopped: \(error.localizedDescription)\n".utf8)
            )
            exit(1)
        }
    }
}
