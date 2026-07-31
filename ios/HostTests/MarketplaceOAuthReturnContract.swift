import Foundation

private struct MarketplaceOAuthReturnContractFailure: Error, CustomStringConvertible {
    let description: String
}

@main
enum MarketplaceOAuthReturnContract {
    static func main() throws {
        try testCanonicalReturnTarget()
        try testConnectedAndErrorReturns()
        try testContextAndSecretRejection()
        print("MarketplaceOAuthReturnContract passed")
    }

    private static func testCanonicalReturnTarget() throws {
        let target = try unwrap(
            MarketplaceOAuthCallback.returnURL(
                workspaceId: "workspace-1",
                appSlug: "google-calendar"
            ),
            "canonical callback target was not created"
        )
        try expect(
            target.absoluteString == "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=google-calendar",
            "canonical callback target changed"
        )
        try expect(
            MarketplaceOAuthCallback.returnURL(workspaceId: "workspace/1", appSlug: "gmail") == nil,
            "unsafe workspace identifier was accepted"
        )
        try expect(
            MarketplaceOAuthCallback.returnURL(workspaceId: "workspace-1", appSlug: "Google") == nil,
            "noncanonical provider slug was accepted"
        )
    }

    private static func testConnectedAndErrorReturns() throws {
        let connected = try parse(
            "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=google-calendar&connector_oauth=google-calendar&status=connected&connectionId=connection-1&marketplace_connection_id=connection-1",
            workspaceId: "workspace-1",
            appSlug: "google-calendar"
        )
        try expect(connected.status == .connected, "connected status was not retained")
        try expect(connected.connectionId == "connection-1", "connection identifier was not retained")

        let failed = try parse(
            "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&connector_oauth=slack&status=error&error=oauth_failed",
            workspaceId: "workspace-1",
            appSlug: "slack"
        )
        try expect(failed.status == .error && failed.connectionId == nil, "bounded error callback was not accepted")
    }

    private static func testContextAndSecretRejection() throws {
        let invalid = [
            "relayconsole://marketplace/oauth?workspace_id=workspace-2&marketplace_app=slack&connector_oauth=slack&status=error&error=oauth_failed",
            "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=gmail&connector_oauth=gmail&status=error&error=oauth_failed",
            "otherapp://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&connector_oauth=slack&status=error&error=oauth_failed",
            "relayconsole://user:password@marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&connector_oauth=slack&status=error&error=oauth_failed",
            "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&connector_oauth=slack&status=error&error=oauth_failed#secret",
            "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&connector_oauth=slack&status=error&error=oauth_failed&code=secret",
            "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&connector_oauth=slack&status=error&error=oauth_failed&state=secret",
            "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&connector_oauth=slack&status=error&error=oauth_failed&access_token=secret",
            "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&connector_oauth=slack&status=error&error=oauth_failed&refresh_token=secret",
            "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&connector_oauth=slack&status=error&error=oauth_failed&message=provider-secret",
            "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&connector_oauth=slack&status=error&status=connected&error=oauth_failed",
            "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&connector_oauth=slack&status=connected&connectionId=one&marketplace_connection_id=two",
            "relayconsole://marketplace/oauth?workspace_id=workspace-1&marketplace_app=slack&connector_oauth=slack&status=error&error=oauth_failed&connectionId=connection-1",
        ]

        for raw in invalid {
            do {
                _ = try parse(raw, workspaceId: "workspace-1", appSlug: "slack")
                throw MarketplaceOAuthReturnContractFailure(description: "unsafe callback was accepted")
            } catch is MarketplaceOAuthReturnContractFailure {
                throw MarketplaceOAuthReturnContractFailure(description: "unsafe callback was accepted")
            } catch {
                let description = error.localizedDescription
                try expect(!description.contains("secret"), "callback rejection reflected secret material")
                try expect(!description.contains(raw), "callback rejection reflected the callback URL")
            }
        }
    }

    private static func parse(
        _ raw: String,
        workspaceId: String,
        appSlug: String
    ) throws -> MarketplaceOAuthCallback {
        let url = try unwrap(URL(string: raw), "test callback URL was invalid")
        return try MarketplaceOAuthCallback.parse(
            url,
            expectedWorkspaceId: workspaceId,
            expectedAppSlug: appSlug
        )
    }

    private static func unwrap<T>(_ value: T?, _ message: String) throws -> T {
        guard let value else { throw MarketplaceOAuthReturnContractFailure(description: message) }
        return value
    }

    private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
        guard condition() else { throw MarketplaceOAuthReturnContractFailure(description: message) }
    }
}
