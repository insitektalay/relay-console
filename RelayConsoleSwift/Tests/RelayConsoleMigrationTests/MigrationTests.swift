import Foundation
import RelayConsoleCore

@main
struct RelayConsoleMigrationTests {
    private static let fixedTimestamp = "2026-01-01T00:00:00Z"

    static func main() throws {
        try run("clean database runs all migrations", testCleanDatabaseRunsAllMigrations)
        try run("provider action migration runs after legacy version 28", testProviderActionMigrationRunsAfterLegacyVersionTwentyEight)
        try run("version 29 tables indexes and columns match expectations", testVersionTwentyNineTablesIndexesAndColumns)
        try run("version 30 cloud replica schema preserves local-only and queues linked writes transactionally", testVersionThirtyCloudReplicaSchema)
        try run("version 31 clears unbounded rebuildable snapshot history", testVersionThirtyOneSnapshotRetentionCleanup)
        try run("version 32 indexes stable message history cursors", testVersionThirtyTwoMessageHistoryCursorIndex)
        try run("version 33 adds versioned cloud agent documents", testVersionThirtyThreeAgentDocuments)
        try run("version 35 repairs cached Relay Cloud runtime types", testVersionThirtyFiveRepairsCachedCloudRuntimeTypes)
        try run("version 37 splits Relay Cloud harnesses by runtime", testVersionThirtySevenSplitsCloudHarnessesByRuntime)
        try run("version 38 keeps Relay Cloud proxies out of local harness lifecycle", testVersionThirtyEightSeparatesLocalHarnessesFromCloudProxies)
        try run("schema 38 upgrades through runtime authority migrations 39 and 40", testSchemaThirtyEightUpgradeThroughRuntimeAuthority)
        try run("version 41 stores native document revisions without content", testVersionFortyOneNativeDocumentRevisionState)
        try run("version 42 coalesces repeated pending cloud mutations", testVersionFortyTwoCoalescesPendingCloudMutations)
        try run("Swift validates the shared connector v3 fixtures", testConnectorV3ContractFixtures)
        try run("Relay Cloud agent documents are editable through the workspace service", testCloudAgentDocumentWorkspace)
        try run("current update preserves user data and remains readable by the previous schema contract", testCurrentUpdateRollbackSchemaCompatibility)
        try run("cloud link checkpoint exports bounded workspace records instead of copying caches", testBoundedCloudLinkCheckpoint)
        try run("seed settings are inert and product tables stay empty", testInertSeedSettingsAndNoProductSeeds)
        try run("generated welcome cleanup migration removes legacy rows", testGeneratedWelcomeCleanupMigration)
        try run("profile workspace preferences migration is additive", testProfileWorkspacePreferencesMigration)
        try run("chat migration preserves existing direct threads and links sessions", testChatMigrationPreservesExistingDirectRowsAndSessions)
        try run("agent org migration preserves existing agents", testAgentOrgMigrationPreservesExistingAgents)
        try run("migrated store keeps secret-like values redacted", testRedactionBehaviorOnMigratedStore)
        try run("baseline migration fixture manifest matches schema", testFixtureManifestMatchesSchema)
        print("RelayConsoleMigrationTests passed")
    }

    private static func run(_ name: String, _ test: () throws -> Void) throws {
        do {
            try test()
            print("ok - \(name)")
        } catch {
            print("not ok - \(name): \(error)")
            throw error
        }
    }

    private static func testCleanDatabaseRunsAllMigrations() throws {
        try withTemporaryDatabase { database, _, _ in
            try runMigrations(database: database)

            let applied = try database.all("SELECT version, name FROM schema_migrations ORDER BY version")
            let pairs = try applied.map { row in
                (try integer(row, "version"), try text(row, "name"))
            }
            let expected = migrations.map { (Int64($0.version), $0.name) }
            let pairSignatures = pairs.map { "\($0.0):\($0.1)" }
            let expectedSignatures = expected.map { "\($0.0):\($0.1)" }

            try expect(pairSignatures == expectedSignatures, "schema_migrations did not match migration registry")
            try expect(pairs.last?.0 == 42, "expected schema version 42")
        }
    }

    private static func testVersionFortyTwoCoalescesPendingCloudMutations() throws {
        try withTemporaryDatabase { database, _, _ in
            try applyMigrations(database, through: 41)
            let timestamp = fixedTimestamp
            try database.run("INSERT INTO local_profiles(id,display_name,created_at,updated_at) VALUES('profile','Local User',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO workspaces(id,profile_id,name,created_at,updated_at) VALUES('workspace','profile','Local',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO cloud_deployments(id,deployment_id,name,api_base_url,websocket_base_url,api_version,sync_contract_version,runtime_contract_version,marketplace_contract_version,created_at,updated_at) VALUES('dep','dep','Railway','https://relay.example/api/v1','wss://relay.example/events','v1','sync.v1','runtime.v1','marketplace.v1',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO secret_references(id,scope,label,provider,keychain_service,keychain_account,created_at,updated_at) VALUES('sec-a','cloud','Access','test','Relay Console','a',?,?),('sec-r','cloud','Refresh','test','Relay Console','r',?,?)", [.text(timestamp), .text(timestamp), .text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO cloud_accounts(id,deployment_id,remote_user_id,display_name,access_secret_reference_id,refresh_secret_reference_id,created_at,updated_at) VALUES('acct','dep','remote-user','User','sec-a','sec-r',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO workspace_sync_links(id,local_workspace_id,deployment_id,account_id,remote_installation_id,remote_workspace_id,state,created_at,updated_at) VALUES('link','workspace','dep','acct','installation','remote-workspace','linked',?,?)", [.text(timestamp), .text(timestamp)])
            for index in 1...3 {
                try database.run(
                    "INSERT INTO sync_outbox(id,sync_link_id,client_mutation_id,object_type,object_id,operation,state,created_at,updated_at) VALUES(?,?,?,?,?,'upsert','pending',?,?)",
                    [.text("out-\(index)"), .text("link"), .text("mutation-\(index)"), .text("dispatch_status"), .text("dispatch-1"), .text(timestamp), .text(timestamp)]
                )
            }

            try runMigrations(database: database)
            try expect(
                try scalarCount(database, "SELECT COUNT(*) AS count FROM sync_outbox WHERE sync_link_id='link' AND object_type='dispatch_status' AND object_id='dispatch-1' AND state IN ('pending','retry')") == 1,
                "migration should collapse existing pending duplicates"
            )

            try database.run(
                "INSERT INTO sync_outbox(id,sync_link_id,client_mutation_id,object_type,object_id,operation,state,created_at,updated_at) VALUES('out-4','link','mutation-4','dispatch_status','dispatch-1','upsert','pending',?,?)",
                [.text(timestamp), .text(timestamp)]
            )
            try expect(
                try scalarCount(database, "SELECT COUNT(*) AS count FROM sync_outbox WHERE sync_link_id='link' AND object_type='dispatch_status' AND object_id='dispatch-1' AND state IN ('pending','retry')") == 1,
                "new pending updates should replace the older queued update"
            )
        }
    }

    private static func testVersionFortyOneNativeDocumentRevisionState() throws {
        try withTemporaryDatabase { database, _, _ in
            try runMigrations(database: database)
            let columns = try database.all("PRAGMA table_info(native_document_sync_state)")
                .map { try text($0, "name") }
            try expect(
                Set(columns) == Set([
                    "runtime_device_id", "runtime_type", "external_agent_id",
                    "folder", "filename", "object_id", "server_version",
                    "content_hash", "acknowledgement_pending", "updated_at",
                ]),
                "native document revision state has unexpected columns"
            )
            try expect(
                !columns.contains("content"),
                "native document revision state must not duplicate document content"
            )
        }
    }

    private static func testConnectorV3ContractFixtures() throws {
        let fixtureRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("docs/native-agent-connection/fixtures", isDirectory: true)
        func fixture(_ name: String) throws -> [String: Any] {
            let data = try Data(contentsOf: fixtureRoot.appendingPathComponent(name))
            guard let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                throw MigrationTestFailure("invalid connector fixture \(name)")
            }
            return value
        }

        let inventory = try fixture("connector-v3-inventory-request.json")
        let response = try fixture("connector-v3-inventory-response.json")
        let connect = try fixture("connector-v3-connect-directive.json")
        let request = try fixture("connector-v3-provision-request.json")
        let result = try fixture("connector-v3-provision-result.json")
        let inventoryAgents = inventory["agents"] as? [[String: Any]]
        let inventoryDocuments = inventoryAgents?.first?["documents"] as? [[String: Any]]
        let discoveries = response["discoveries"] as? [[String: Any]]

        try expect(inventory["protocolVersion"] as? String == "relay-connector.v3", "invalid v3 inventory protocol")
        try expect(inventoryDocuments?.isEmpty == true, "inventory fixture must remain metadata-only")
        try expect(discoveries?.first?["directive"] as? String == "metadata_only", "invalid inventory directive")
        try expect(discoveries?.first?["documentSync"] as? Bool == false, "inventory must not enable document sync")
        try expect(connect["directive"] as? String == "connect", "invalid connect directive")
        try expect(connect["documentConsentVersion"] as? Int == 1, "connect fixture requires consent v1")
        for key in ["commandId", "jobId", "workspaceId", "runtimeHostId", "runtimeType", "idempotencyKey"] {
            try expect(result[key] as? String == request[key] as? String, "provision fixture mismatch for \(key)")
        }
        let payload = request["payload"] as? [String: Any]
        try expect(result["externalAgentId"] as? String == payload?["slug"] as? String, "native identity must match the request")
    }

    private static func testVersionThirtyCloudReplicaSchema() throws {
        try withTemporaryDatabase { database, _, _ in
            try runMigrations(database: database)
            let tables = try schemaNames(database: database, type: "table")
            try expect(tables.isSuperset(of: ["cloud_deployments", "cloud_accounts", "workspace_sync_links", "sync_imports", "sync_import_items", "sync_outbox", "remote_object_versions", "cloud_replica_objects", "sync_conflicts", "sync_tombstones", "cloud_runtime_devices", "cloud_runtime_bindings", "cloud_dispatch_receipts", "attachment_sync_state"]), "PRD 1 replica tables are incomplete")
            let timestamp = fixedTimestamp
            try database.run("INSERT INTO local_profiles(id,display_name,created_at,updated_at) VALUES('profile','Local User',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO workspaces(id,profile_id,name,created_at,updated_at) VALUES('local','profile','Local',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO agents(id,workspace_id,name,status,created_at,updated_at) VALUES('local-agent','local','Local Agent','active',?,?)", [.text(timestamp), .text(timestamp)])
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM sync_outbox") == 0, "untouched local-only writes must not enter the cloud outbox")

            try database.run("INSERT INTO cloud_deployments(id,deployment_id,name,api_base_url,websocket_base_url,api_version,sync_contract_version,runtime_contract_version,marketplace_contract_version,created_at,updated_at) VALUES('dep','dep','Railway','https://relay.example/api/v1','wss://relay.example/events','v1','2026-07-12.prd1.v1','bridge.v1','swift-marketplace.v1',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO secret_references(id,scope,label,provider,keychain_service,keychain_account,created_at,updated_at) VALUES('sec-a','cloud','Access','test','Relay Console','a',?,?),('sec-r','cloud','Refresh','test','Relay Console','r',?,?)", [.text(timestamp), .text(timestamp), .text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO cloud_accounts(id,deployment_id,remote_user_id,display_name,access_secret_reference_id,refresh_secret_reference_id,created_at,updated_at) VALUES('acct','dep','remote-user','User','sec-a','sec-r',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO workspace_sync_links(id,local_workspace_id,deployment_id,account_id,remote_installation_id,remote_workspace_id,state,created_at,updated_at) VALUES('link','local','dep','acct','installation','remote-workspace','linked',?,?)", [.text(timestamp), .text(timestamp)])
            try database.transaction {
                try database.run("INSERT INTO agents(id,workspace_id,name,status,created_at,updated_at) VALUES('cloud-agent','local','Cloud Agent','active',?,?)", [.text(timestamp), .text(timestamp)])
                let queued = try scalarCount(database, "SELECT COUNT(*) AS count FROM sync_outbox WHERE object_type='agent' AND object_id='cloud-agent'")
                try expect(queued == 1, "linked writes must create one outbox item in the record transaction")
            }
            try database.run("UPDATE sync_apply_guard SET active=1 WHERE id=1")
            try database.run("UPDATE agents SET name='Remote Apply' WHERE id='cloud-agent'")
            try database.run("UPDATE sync_apply_guard SET active=0 WHERE id=1")
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM sync_outbox WHERE object_id='cloud-agent'") == 1, "pull application must not echo into the outbox")
        }
    }

    private static func testVersionThirtyOneSnapshotRetentionCleanup() throws {
        try withTemporaryDatabase { database, _, _ in
            try applyMigrations(database, through: 30)
            try database.run("INSERT INTO local_profiles(id,display_name,created_at,updated_at) VALUES('profile','Local User',?,?)", [.text(fixedTimestamp), .text(fixedTimestamp)])
            try database.run("INSERT INTO workspaces(id,profile_id,name,created_at,updated_at) VALUES('workspace','profile','Local',?,?)", [.text(fixedTimestamp), .text(fixedTimestamp)])
            try database.run("INSERT INTO runtime_dashboard_snapshots(id,workspace_id,state,refreshed_at,stale_after_seconds,local_status_state,local_status_reason,retry_available,read_only,snapshot_json,created_at,updated_at) VALUES('runtime-snapshot','workspace','ready',?,300,'ready','test',0,1,'{}',?,?)", [.text(fixedTimestamp), .text(fixedTimestamp), .text(fixedTimestamp)])
            try database.run("INSERT INTO applications_catalog_snapshots(id,workspace_id,state,view,search_query,response_count,demo_fallback_used,read_only,snapshot_json,created_at,updated_at,redaction_status) VALUES('app-snapshot','workspace','ready','catalog','',0,0,1,'{}',?,?,'private-state-excluded')", [.text(fixedTimestamp), .text(fixedTimestamp)])

            try runMigrations(database: database)

            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM runtime_dashboard_snapshots") == 0, "runtime dashboard cache history should be cleared")
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM applications_catalog_snapshots") == 0, "application catalog cache history should be cleared")
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM schema_migrations WHERE version=31") == 1, "snapshot retention cleanup migration should be recorded")
        }
    }

    private static func testVersionThirtyTwoMessageHistoryCursorIndex() throws {
        try withTemporaryDatabase { database, _, _ in
            try runMigrations(database: database)
            let indexes = try schemaNames(database: database, type: "index")
            try expect(
                indexes.contains("idx_messages_thread_session_created_id"),
                "message history pagination requires a stable thread/session/time/id index"
            )
        }
    }

    private static func testVersionThirtyThreeAgentDocuments() throws {
        try withTemporaryDatabase { database, _, _ in
            try runMigrations(database: database)
            let tables = try schemaNames(database: database, type: "table")
            let indexes = try schemaNames(database: database, type: "index")
            let triggers = try schemaNames(database: database, type: "trigger")
            try expect(tables.contains("agent_documents"), "agent document mirror table is missing")
            try expect(indexes.contains("idx_agent_documents_workspace_agent"), "agent document lookup index is missing")
            try expect(
                triggers.isSuperset(of: [
                    "trg_agent_documents_cloud_upsert",
                    "trg_agent_documents_cloud_update",
                    "trg_agent_documents_cloud_delete"
                ]),
                "agent document cloud outbox triggers are incomplete"
            )
        }
    }

    private static func testVersionThirtyFiveRepairsCachedCloudRuntimeTypes() throws {
        try withTemporaryDatabase { database, _, _ in
            try applyMigrations(database, through: 34)
            let timestamp = fixedTimestamp
            try database.run("INSERT INTO local_profiles(id,display_name,created_at,updated_at) VALUES('profile-runtime','Cloud User',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO workspaces(id,profile_id,name,created_at,updated_at) VALUES('workspace-runtime','profile-runtime','Cloud Workspace',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO cloud_deployments(id,deployment_id,name,api_base_url,websocket_base_url,api_version,sync_contract_version,runtime_contract_version,marketplace_contract_version,created_at,updated_at) VALUES('dep-runtime','dep-runtime','Railway','https://relay.example/api/v1','wss://relay.example/events','v1','sync.v1','runtime.v1','marketplace.v1',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO secret_references(id,scope,label,provider,keychain_service,keychain_account,created_at,updated_at) VALUES('sec-runtime-a','cloud','Access','test','Relay Console','a',?,?),('sec-runtime-r','cloud','Refresh','test','Relay Console','r',?,?)", [.text(timestamp), .text(timestamp), .text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO cloud_accounts(id,deployment_id,remote_user_id,display_name,access_secret_reference_id,refresh_secret_reference_id,created_at,updated_at) VALUES('acct-runtime','dep-runtime','remote-user','User','sec-runtime-a','sec-runtime-r',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO workspace_sync_links(id,local_workspace_id,deployment_id,account_id,remote_installation_id,remote_workspace_id,state,created_at,updated_at) VALUES('link-runtime','workspace-runtime','dep-runtime','acct-runtime','installation','remote-workspace','offline',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO harnesses(id,runtime_type,display_name,mode,config_json,status,built_in,created_at,updated_at) VALUES('harness-cloud-runtime','hermes','Relay Cloud','app_managed','{}','active',0,?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO agents(id,workspace_id,name,status,source,external_id,created_at,updated_at) VALUES('agent-cloud-runtime','workspace-runtime','GapMiner','active','railway_sync','gapminer',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO runtime_bindings(id,agent_id,harness_id,runtime_type,adapter_kind,routing_mode,external_agent_id,config_json,created_at,updated_at) VALUES('binding-cloud-runtime','agent-cloud-runtime','harness-cloud-runtime','hermes','railway_cloud','railway','remote-gapminer','{}',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO cloud_replica_objects(sync_link_id,object_type,remote_object_id,local_object_id,server_version,payload_json,updated_at) VALUES('link-runtime','agent','remote-gapminer','agent-cloud-runtime','1','{\"name\":\"GapMiner\",\"source\":\"openclaw\"}',?)", [.text(timestamp)])

            try runMigrations(database: database)

            let binding = try unwrap(database.get("SELECT runtime_type FROM runtime_bindings WHERE id='binding-cloud-runtime'"), "missing repaired cloud binding")
            let harness = try unwrap(database.get("SELECT runtime_type FROM harnesses WHERE id='harness-cloud-runtime'"), "missing repaired cloud harness")
            try expect(try text(binding, "runtime_type") == "openclaw", "cached GapMiner source should repair its cloud binding to OpenClaw")
            try expect(try text(harness, "runtime_type") == "openclaw", "cached GapMiner source should repair its cloud harness to OpenClaw")
        }
    }

    private static func testVersionThirtySevenSplitsCloudHarnessesByRuntime() throws {
        try withTemporaryDatabase { database, _, _ in
            try applyMigrations(database, through: 36)
            let timestamp = fixedTimestamp
            try database.run("INSERT INTO local_profiles(id,display_name,created_at,updated_at) VALUES('profile-split','Cloud User',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO workspaces(id,profile_id,name,created_at,updated_at) VALUES('workspace-split','profile-split','Cloud Workspace',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO cloud_deployments(id,deployment_id,name,api_base_url,websocket_base_url,api_version,sync_contract_version,runtime_contract_version,marketplace_contract_version,created_at,updated_at) VALUES('dep-split','dep-split','Railway','https://relay.example/api/v1','wss://relay.example/events','v1','sync.v1','runtime.v1','marketplace.v1',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO secret_references(id,scope,label,provider,keychain_service,keychain_account,created_at,updated_at) VALUES('sec-split-a','cloud','Access','test','Relay Console','a',?,?),('sec-split-r','cloud','Refresh','test','Relay Console','r',?,?)", [.text(timestamp), .text(timestamp), .text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO cloud_accounts(id,deployment_id,remote_user_id,display_name,access_secret_reference_id,refresh_secret_reference_id,created_at,updated_at) VALUES('acct-split','dep-split','remote-user','User','sec-split-a','sec-split-r',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO workspace_sync_links(id,local_workspace_id,deployment_id,account_id,remote_installation_id,remote_workspace_id,state,created_at,updated_at) VALUES('link-split','workspace-split','dep-split','acct-split','installation','remote-workspace','offline',?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO harnesses(id,runtime_type,display_name,mode,config_json,status,built_in,created_at,updated_at) VALUES('legacy-shared-cloud-harness','hermes','Relay Cloud','app_managed','{}','active',0,?,?)", [.text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO agents(id,workspace_id,name,status,source,external_id,created_at,updated_at) VALUES('agent-gapminer','workspace-split','GapMiner','active','railway_sync','gapminer',?,?),('agent-jeff','workspace-split','Jeff Hermes','active','railway_sync','jeff-hermes',?,?)", [.text(timestamp), .text(timestamp), .text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO runtime_bindings(id,agent_id,harness_id,runtime_type,adapter_kind,routing_mode,external_agent_id,config_json,created_at,updated_at) VALUES('binding-gapminer','agent-gapminer','legacy-shared-cloud-harness','openclaw','railway_cloud','railway','gapminer','{}',?,?),('binding-jeff','agent-jeff','legacy-shared-cloud-harness','hermes','railway_cloud','railway','jeff-hermes','{}',?,?)", [.text(timestamp), .text(timestamp), .text(timestamp), .text(timestamp)])
            try database.run("INSERT INTO cloud_replica_objects(sync_link_id,object_type,remote_object_id,local_object_id,server_version,payload_json,updated_at) VALUES('link-split','agent','remote-gapminer','agent-gapminer','1','{\"name\":\"GapMiner\",\"runtimeType\":\"openclaw\"}',?),('link-split','agent','remote-jeff','agent-jeff','1','{\"name\":\"Jeff Hermes\",\"runtimeType\":\"hermes\"}',?)", [.text(timestamp), .text(timestamp)])

            try runMigrations(database: database)

            let gapMiner = try unwrap(database.get("SELECT b.runtime_type,b.harness_id,h.runtime_type AS harness_runtime FROM runtime_bindings b JOIN harnesses h ON h.id=b.harness_id WHERE b.id='binding-gapminer'"), "missing GapMiner binding")
            let jeff = try unwrap(database.get("SELECT b.runtime_type,b.harness_id,h.runtime_type AS harness_runtime FROM runtime_bindings b JOIN harnesses h ON h.id=b.harness_id WHERE b.id='binding-jeff'"), "missing Jeff binding")
            try expect(try text(gapMiner, "runtime_type") == "openclaw", "GapMiner binding must remain OpenClaw")
            try expect(try text(gapMiner, "harness_runtime") == "openclaw", "GapMiner harness must be OpenClaw")
            try expect(try text(jeff, "runtime_type") == "hermes", "Jeff binding must remain Hermes")
            try expect(try text(jeff, "harness_runtime") == "hermes", "Jeff harness must be Hermes")
            try expect(try text(gapMiner, "harness_id") != text(jeff, "harness_id"), "different runtimes must not share a cloud harness")
        }
    }

    private static func testVersionThirtyEightSeparatesLocalHarnessesFromCloudProxies() throws {
        try withTemporaryDatabase { database, _, _ in
            try applyMigrations(database, through: 37)
            let timestamp = fixedTimestamp
            try database.run(
                "INSERT INTO harnesses(id,runtime_type,display_name,mode,config_json,status,built_in,created_at,updated_at) VALUES('local-openclaw','openclaw','OpenClaw','app_managed','{\"kind\":\"external_harness_install\",\"source\":\"managed\",\"installPath\":\"/tmp/openclaw\",\"lifecycleState\":\"connected\"}','active',0,?,?),('cloud-openclaw','openclaw','Relay Cloud OpenClaw','app_managed','{\"executionAuthority\":\"railway\"}','active',0,?,?)",
                [.text(timestamp), .text(timestamp), .text(timestamp), .text("2026-01-02T00:00:00Z")]
            )

            try runMigrations(database: database)

            let data = LocalDataService(database: database, eventBus: RelayEventBus(), appVersion: "migration-test")
            let selected = try unwrap(data.getHarnessByRuntimeType(.openclaw), "missing local OpenClaw harness")
            try expect(selected.id == "local-openclaw", "local lifecycle must ignore a newer Relay Cloud proxy")
            let proxy = try unwrap(database.get("SELECT mode,config_json FROM harnesses WHERE id='cloud-openclaw'"), "missing Relay Cloud proxy")
            let config = try text(proxy, "config_json")
            try expect(try text(proxy, "mode") == "app_managed", "cloud proxy mode should remain app managed")
            try expect(config.contains("cloud_runtime_proxy"), "cloud proxy must carry an explicit kind")
            try expect(config.contains("railway"), "cloud proxy must retain Railway execution authority")
        }
    }

    private static func testSchemaThirtyEightUpgradeThroughRuntimeAuthority() throws {
        try withTemporaryDatabase { database, _, _ in
            try applyMigrations(database, through: 38)
            let timestamp = fixedTimestamp
            try database.run(
                "INSERT INTO local_profiles(id,display_name,created_at,updated_at) VALUES('profile-authority','Local User',?,?)",
                [.text(timestamp), .text(timestamp)]
            )
            try database.run(
                "INSERT INTO workspaces(id,profile_id,name,created_at,updated_at) VALUES('workspace-authority','profile-authority','Release Upgrade',?,?)",
                [.text(timestamp), .text(timestamp)]
            )
            try database.run(
                "INSERT INTO harnesses(id,runtime_type,display_name,mode,config_json,status,built_in,created_at,updated_at) VALUES('harness-authority','hermes','User-managed Hermes','user_managed','{}','active',0,?,?)",
                [.text(timestamp), .text(timestamp)]
            )
            try database.run(
                "INSERT INTO agents(id,workspace_id,name,status,source,external_id,created_at,updated_at) VALUES('agent-authority','workspace-authority','Upgrade Agent','active','hermes','upgrade-agent',?,?)",
                [.text(timestamp), .text(timestamp)]
            )
            try database.run(
                "INSERT INTO runtime_bindings(id,agent_id,harness_id,runtime_type,adapter_kind,routing_mode,external_agent_id,config_json,created_at,updated_at) VALUES('binding-authority','agent-authority','harness-authority','hermes','hermes','local','upgrade-agent','{}',?,?)",
                [.text(timestamp), .text(timestamp)]
            )
            try database.run(
                "INSERT INTO agent_documents(id,workspace_id,agent_id,runtime_type,root,folder,filename,document_kind,content,content_hash,created_at,updated_at) VALUES('document-authority','workspace-authority','agent-authority','hermes','agent','','SOUL.md','soul','# Upgrade Agent','hash',?,?)",
                [.text(timestamp), .text(timestamp)]
            )

            try runMigrations(database: database)

            let tables = try schemaNames(database: database, type: "table")
            let indexes = try schemaNames(database: database, type: "index")
            try expect(
                tables.isSuperset(of: ["runtime_hosts", "runtime_observations", "agent_identity_suppressions"]),
                "runtime authority tables are missing after the schema 38 upgrade"
            )
            try expect(indexes.contains("idx_runtime_bindings_connect_linked"), "Relay Connect link index is missing after migration 40")
            try expect(
                try columns(database: database, table: "agents").isSuperset(of: ["lifecycle_status", "lifecycle_reason", "retired_at"]),
                "agent lifecycle columns are missing after migration 39"
            )
            try expect(
                try columns(database: database, table: "runtime_bindings").isSuperset(of: [
                    "runtime_host_id", "canonical_agent_id", "assignment_epoch", "ownership_state",
                    "host_status", "connect_linked", "connect_remote_agent_id"
                ]),
                "runtime authority or Relay Connect binding columns are missing"
            )
            try expect(
                try columns(database: database, table: "agent_documents").isSuperset(of: [
                    "desired_version", "applied_version", "sync_state", "last_sync_error", "tombstoned_at"
                ]),
                "managed-document reconciliation columns are missing"
            )
            let binding = try unwrap(
                database.get("SELECT runtime_host_id,assignment_epoch,ownership_state,host_status,connect_linked FROM runtime_bindings WHERE id='binding-authority'"),
                "existing runtime binding was lost during upgrade"
            )
            try expect(try text(binding, "runtime_host_id") == "local_host_workspace-authority", "existing local binding was not assigned to the migrated local host")
            try expect(try integer(binding, "assignment_epoch") == 0, "existing binding received an unexpected assignment epoch")
            try expect(try text(binding, "ownership_state") == "local", "existing binding lost local execution ownership")
            try expect(try text(binding, "host_status") == "online", "existing binding did not receive the local host state")
            try expect(try integer(binding, "connect_linked") == 0, "existing binding was incorrectly linked to Relay Connect")
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM runtime_hosts WHERE id='local_host_workspace-authority' AND product_mode='local' AND status='online'") == 1, "local runtime host was not created")
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM agent_documents WHERE id='document-authority' AND desired_version='1' AND applied_version='0' AND sync_state='saved'") == 1, "existing agent document was not preserved with reconciliation defaults")
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM agents WHERE id='agent-authority' AND lifecycle_status='active'") == 1, "existing agent was not preserved with active lifecycle state")
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM schema_migrations WHERE version IN (39,40)") == 2, "migrations 39 and 40 were not recorded")
        }
    }

    private static func testCloudAgentDocumentWorkspace() throws {
        try withTemporaryDatabase { database, _, root in
            try runMigrations(database: database)
            let paths = try AppPathsService(basePath: root).ensure()
            let timestamp = fixedTimestamp
            try database.run(
                "INSERT INTO local_profiles(id,display_name,created_at,updated_at) VALUES('profile-cloud-docs','Cloud User',?,?)",
                [.text(timestamp), .text(timestamp)]
            )
            try database.run(
                "INSERT INTO workspaces(id,profile_id,name,created_at,updated_at) VALUES('workspace-cloud-docs','profile-cloud-docs','Cloud Workspace',?,?)",
                [.text(timestamp), .text(timestamp)]
            )
            try database.run(
                "INSERT INTO harnesses(id,runtime_type,display_name,mode,config_json,status,built_in,created_at,updated_at) VALUES('harness-cloud-docs','openclaw','Relay Cloud OpenClaw','app_managed','{}','active',0,?,?)",
                [.text(timestamp), .text(timestamp)]
            )
            try database.run(
                "INSERT INTO agents(id,workspace_id,name,status,source,created_at,updated_at) VALUES('agent-cloud-docs','workspace-cloud-docs','GapMiner','active','openclaw',?,?)",
                [.text(timestamp), .text(timestamp)]
            )
            try database.run(
                "INSERT INTO runtime_bindings(id,agent_id,harness_id,runtime_type,adapter_kind,routing_mode,external_agent_id,config_json,created_at,updated_at) VALUES('binding-cloud-docs','agent-cloud-docs','harness-cloud-docs','openclaw','railway_cloud','railway','remote-gapminer','{}',?,?)",
                [.text(timestamp), .text(timestamp)]
            )

            let data = LocalDataService(
                database: database,
                eventBus: RelayEventBus(),
                appVersion: "migration-test"
            )
            let workspace = RuntimeWorkspaceService(
                paths: paths,
                nativeFilePermissions: NativeFilePermissionService(data: data),
                database: database
            )
            let agent = try data.getAgent("agent-cloud-docs")
            let snapshot = workspace.snapshot(for: agent)
            let cloudRoot = try unwrap(snapshot.roots.first, "missing Relay Cloud workspace root")
            try expect(cloudRoot.kind == .agentWorkspace, "cloud agent should expose a canonical workspace")
            try expect(!cloudRoot.isReadOnly, "cloud agent workspace should be editable")

            let soul = try workspace.saveMarkdown(
                agent: agent,
                rootId: cloudRoot.rootId,
                folderRelativePath: "",
                filename: "SOUL.md",
                markdown: "# GapMiner\n"
            )
            _ = try workspace.saveMarkdown(
                agent: agent,
                rootId: cloudRoot.rootId,
                folderRelativePath: "memory",
                filename: "MEMORY.md",
                markdown: "# Persistent memory\n"
            )
            _ = try workspace.saveMarkdown(
                agent: agent,
                rootId: cloudRoot.rootId,
                folderRelativePath: "skills/research",
                filename: "SKILL.md",
                markdown: "# Research skill\n"
            )

            try expect(
                try workspace.readFile(
                    agent: agent,
                    rootId: cloudRoot.rootId,
                    relativePath: soul.relativePath
                ).markdown == "# GapMiner\n",
                "cloud workspace should read its canonical document"
            )
            try expect(
                workspace.userFileGroups(for: agent, section: .instructions)
                    .flatMap(\.items).contains { $0.relativePath == "SOUL.md" },
                "cloud instructions should expose SOUL.md"
            )
            try expect(
                workspace.userFileGroups(for: agent, section: .memory)
                    .flatMap(\.items).contains { $0.relativePath == "memory/MEMORY.md" },
                "cloud memory should expose MEMORY.md"
            )
            try expect(
                workspace.userFileGroups(for: agent, section: .skills)
                    .flatMap(\.items).contains { $0.mainFileRelativePath == "skills/research/SKILL.md" },
                "cloud skills should expose installed skill packages"
            )
        }
    }

    private static func testCurrentUpdateRollbackSchemaCompatibility() throws {
        try withTemporaryDatabase { database, _, _ in
            try applyMigrations(database, through: 30)
            let coreTables = ["local_profiles", "workspaces", "harnesses", "threads", "thread_sessions", "messages", "secret_references"]
            let columnsBefore = try Dictionary(uniqueKeysWithValues: coreTables.map { ($0, try columns(database: database, table: $0)) })

            try database.run(
                "INSERT INTO local_profiles(id,display_name,created_at,updated_at) VALUES('profile-update','Update Owner',?,?)",
                [.text(fixedTimestamp), .text(fixedTimestamp)]
            )
            try database.run(
                "INSERT INTO workspaces(id,profile_id,name,created_at,updated_at) VALUES('workspace-update','profile-update','Update Workspace',?,?)",
                [.text(fixedTimestamp), .text(fixedTimestamp)]
            )
            try database.run(
                "INSERT INTO harnesses(id,runtime_type,display_name,mode,config_json,status,built_in,created_at,updated_at) VALUES('harness-update','hermes','User-managed Hermes','user_managed','{\"runtimeOwnership\":\"user_managed\"}','active',0,?,?)",
                [.text(fixedTimestamp), .text(fixedTimestamp)]
            )
            try database.run(
                "INSERT INTO threads(id,workspace_id,title,thread_type,active_session_id,status,read_state,unread_count,is_archived,created_at,updated_at) VALUES('thread-update','workspace-update','Update Conversation','direct','session-update','active','read',0,0,?,?)",
                [.text(fixedTimestamp), .text(fixedTimestamp)]
            )
            try database.run(
                "INSERT INTO thread_sessions(id,thread_id,sequence_number,status,is_read_only,started_at,created_at,updated_at) VALUES('session-update','thread-update',1,'active',0,?,?,?)",
                [.text(fixedTimestamp), .text(fixedTimestamp), .text(fixedTimestamp)]
            )
            try database.run(
                "INSERT INTO messages(id,thread_id,thread_session_id,sender_type,sender_name,content,content_format,metadata_json,created_at) VALUES('message-update','thread-update','session-update','user','Update Owner','Preserved through update and rollback','plain','{}',?)",
                [.text(fixedTimestamp)]
            )
            try database.run(
                "INSERT INTO secret_references(id,scope,label,provider,keychain_service,keychain_account,created_at,updated_at) VALUES('secret-update','continuity','Provider Token','keychain','com.relayconsole.app','continuity-account',?,?)",
                [.text(fixedTimestamp), .text(fixedTimestamp)]
            )
            try database.run(
                "INSERT INTO runtime_dashboard_snapshots(id,workspace_id,state,refreshed_at,stale_after_seconds,local_status_state,local_status_reason,retry_available,read_only,snapshot_json,created_at,updated_at) VALUES('cache-update','workspace-update','ready',?,300,'ready','rebuildable',0,1,'{}',?,?)",
                [.text(fixedTimestamp), .text(fixedTimestamp), .text(fixedTimestamp)]
            )

            try runMigrations(database: database)

            for table in coreTables {
                try expect(try columns(database: database, table: table) == columnsBefore[table], "current update changed the previous schema contract for \(table)")
            }
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM local_profiles WHERE id='profile-update'") == 1, "update lost the local profile")
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM workspaces WHERE id='workspace-update'") == 1, "update lost the workspace")
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM harnesses WHERE id='harness-update' AND mode='user_managed'") == 1, "update lost the user-managed runtime record")
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM messages WHERE id='message-update' AND content='Preserved through update and rollback'") == 1, "update lost conversation content")
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM secret_references WHERE id='secret-update' AND keychain_account='continuity-account'") == 1, "update lost the stable Keychain reference")
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM runtime_dashboard_snapshots") == 0, "update did not remove the explicitly rebuildable cache")
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM schema_migrations WHERE version IN (31,32)") == 2, "current update migrations were not recorded")

            let previousContractRow = try unwrap(
                database.get(
                    "SELECT p.display_name, w.name AS workspace_name, h.mode, t.title, s.sequence_number, m.content, r.keychain_service, r.keychain_account FROM local_profiles p JOIN workspaces w ON w.profile_id=p.id JOIN harnesses h ON h.id='harness-update' JOIN threads t ON t.workspace_id=w.id JOIN thread_sessions s ON s.thread_id=t.id JOIN messages m ON m.thread_session_id=s.id JOIN secret_references r ON r.id='secret-update' WHERE p.id='profile-update'"
                ),
                "previous schema query returned no restored lifecycle row"
            )
            try expect(try text(previousContractRow, "display_name") == "Update Owner", "previous schema contract could not read the profile after update")
            try expect(try text(previousContractRow, "content") == "Preserved through update and rollback", "previous schema contract could not read the conversation after update")
            try expect(try text(previousContractRow, "keychain_account") == "continuity-account", "previous schema contract could not read the Keychain reference after update")
        }
    }

    private static func testBoundedCloudLinkCheckpoint() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("RelayConsoleCloudCheckpointTests", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let paths = try AppPathsService(basePath: root).ensure()
        let database = DatabaseService(databasePath: paths.databasePath)
        try database.open()
        defer {
            database.close()
            try? FileManager.default.removeItem(at: root)
        }
        try runMigrations(database: database)
        let timestamp = fixedTimestamp
        try database.run("INSERT INTO local_profiles(id,display_name,created_at,updated_at) VALUES('profile','Local User',?,?)", [.text(timestamp), .text(timestamp)])
        try database.run("INSERT INTO workspaces(id,profile_id,name,created_at,updated_at) VALUES('workspace','profile','Local',?,?)", [.text(timestamp), .text(timestamp)])
        try database.run("INSERT INTO agents(id,workspace_id,name,status,created_at,updated_at) VALUES('agent','workspace','Local Agent','active',?,?)", [.text(timestamp), .text(timestamp)])
        try database.run("INSERT INTO agent_preferences(id,workspace_id,agent_id,avatar_reference,avatar_state,response_presentation,created_at,updated_at) VALUES('pref','workspace','agent','avatars/comic/sheet-09_avatar-005.png','illustrated','markdown',?,?)", [.text(timestamp), .text(timestamp)])
        try database.run("INSERT INTO threads(id,workspace_id,title,status,created_at,updated_at) VALUES('thread','workspace','Conversation','active',?,?)", [.text(timestamp), .text(timestamp)])
        try database.run("INSERT INTO messages(id,thread_id,sender_type,sender_name,content,metadata_json,created_at) VALUES('message','thread','agent','Local Agent','Safe message',? ,?)", [.text("{\"artifactContract\":{\"cronDirectoryRootPath\":\"/Users/private/workspace\",\"safeLabel\":\"kept\"}}"), .text(timestamp)])
        try database.run("INSERT INTO runtime_dashboard_snapshots(id,workspace_id,state,refreshed_at,stale_after_seconds,local_status_state,local_status_reason,retry_available,read_only,snapshot_json,created_at,updated_at) VALUES('large-cache','workspace','ready',?,300,'ready','test',0,1,?,?,?)", [.text(timestamp), .text(String(repeating: "x", count: 2 * 1_024 * 1_024)), .text(timestamp), .text(timestamp)])

        let data = LocalDataService(database: database, eventBus: RelayEventBus(), appVersion: "test")
        let secrets = SecretService(database: database, store: MemorySecretStore())
        let connections = CloudRelayConnectionService(database: database, secrets: secrets)
        let entitlement = RelayEntitlementService(
            database: database,
            data: data,
            secrets: secrets,
            connections: connections
        )
        let sync = CloudRelaySyncService(
            database: database,
            paths: paths,
            data: data,
            connections: connections,
            entitlement: entitlement
        )
        let checkpoint = try sync.createBackupCheckpoint(workspaceId: "workspace")
        let bytes = try Data(contentsOf: checkpoint.url)
        let text = String(decoding: bytes, as: UTF8.self)

        try expect(checkpoint.url.pathExtension == "jsonl", "cloud checkpoint should be a workspace JSONL export")
        try expect(bytes.count < 256 * 1_024, "rebuildable local caches must not inflate a cloud-link checkpoint")
        try expect(text.contains("\"objectType\":\"agent\""), "checkpoint should contain supported workspace records")
        try expect(text.contains("\"avatarUrl\"") && text.contains("sheet-09_avatar-005.png"), "agent payload should carry a web-resolvable shared avatar")
        try expect(text.contains("\"safeLabel\":\"kept\""), "checkpoint should retain safe nested message metadata")
        try expect(!text.contains("cronDirectoryRootPath") && !text.contains("/Users/private/workspace"), "checkpoint must recursively remove unrestricted local paths")
        try expect(!text.contains(String(repeating: "x", count: 128)), "checkpoint must exclude rebuildable runtime dashboard cache content")
        try expect(checkpoint.sha256.count == 64, "checkpoint should have a verified SHA-256 digest")
    }

    private static func testProviderActionMigrationRunsAfterLegacyVersionTwentyEight() throws {
        try withTemporaryDatabase { database, _, _ in
            try applyMigrations(database, through: 27)
            try database.run(
                "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
                [.integer(28), .text("team_relay_cycle_controls"), .text(fixedTimestamp)]
            )

            try runMigrations(database: database)

            let tables = try schemaNames(database: database, type: "table")
            try expect(
                tables.isSuperset(of: [
                    "marketplace_provider_action_definitions",
                    "marketplace_action_permission_maps",
                    "marketplace_provider_action_approvals",
                    "marketplace_provider_action_executions"
                ]),
                "provider action tables should be created after a legacy version 28 migration"
            )
            let providerMigration = try database.get("SELECT name FROM schema_migrations WHERE version = 29")
            let providerMigrationName = try providerMigration.map { try text($0, "name") }
            try expect(
                providerMigrationName == "marketplace_provider_action_framework",
                "provider action framework should be recorded as schema version 29"
            )
        }
    }

    private static func testVersionTwentyNineTablesIndexesAndColumns() throws {
        try withTemporaryDatabase { database, _, _ in
            try runMigrations(database: database)

            let tables = try schemaNames(database: database, type: "table")
            let indexes = try schemaNames(database: database, type: "index")
            let profileColumns = try columns(database: database, table: "local_profiles")
            let workspaceColumns = try columns(database: database, table: "workspaces")
            let threadColumns = try columns(database: database, table: "threads")
            let messageColumns = try columns(database: database, table: "messages")
            let sessionColumns = try columns(database: database, table: "thread_sessions")
            let readStateColumns = try columns(database: database, table: "thread_read_states")
            let wrapUpColumns = try columns(database: database, table: "thread_wrap_up_reports")
            let draftColumns = try columns(database: database, table: "chat_composer_drafts")
            let attachmentColumns = try columns(database: database, table: "chat_attachments")
            let referenceColumns = try columns(database: database, table: "chat_document_references")
            let agentColumns = try columns(database: database, table: "agents")
            let companyColumns = try columns(database: database, table: "companies")
            let departmentColumns = try columns(database: database, table: "departments")
            let teamColumns = try columns(database: database, table: "teams")
            let managerColumns = try columns(database: database, table: "agent_manager_relationships")
            let provisioningColumns = try columns(database: database, table: "agent_provisioning_jobs")
            let agentPreferenceColumns = try columns(database: database, table: "agent_preferences")
            let taskColumns = try columns(database: database, table: "agent_tasks")
            let taskRunColumns = try columns(database: database, table: "agent_task_runs")
            let memoryColumns = try columns(database: database, table: "agent_team_memory")
            let handoverColumns = try columns(database: database, table: "agent_team_handovers")
            let runtimeSnapshotColumns = try columns(database: database, table: "runtime_dashboard_snapshots")
            let runtimeRowColumns = try columns(database: database, table: "runtime_dashboard_rows")
            let runtimeActionCapabilityColumns = try columns(database: database, table: "runtime_action_capabilities")
            let runtimeActionRunColumns = try columns(database: database, table: "runtime_action_runs")
            let structuredJobColumns = try columns(database: database, table: "runtime_structured_jobs")
            let missingToolColumns = try columns(database: database, table: "runtime_missing_tool_events")
            let recoveryColumns = try columns(database: database, table: "runtime_recovery_records")
            let applicationsNavigationColumns = try columns(database: database, table: "applications_navigation_records")
            let marketplaceCatalogColumns = try columns(database: database, table: "marketplace_catalog_apps")
            let applicationsSnapshotColumns = try columns(database: database, table: "applications_catalog_snapshots")
            let providerConnectionColumns = try columns(database: database, table: "applications_provider_connections")
            let providerAuthorizationColumns = try columns(database: database, table: "applications_provider_authorization_flows")
            let providerSnapshotColumns = try columns(database: database, table: "applications_provider_connection_snapshots")
            let marketplaceInstallColumns = try columns(database: database, table: "applications_marketplace_installs")
            let marketplaceInstallSnapshotColumns = try columns(database: database, table: "applications_marketplace_install_snapshots")
            let providerActionDefinitionColumns = try columns(database: database, table: "marketplace_provider_action_definitions")
            let actionPermissionMapColumns = try columns(database: database, table: "marketplace_action_permission_maps")
            let providerActionApprovalColumns = try columns(database: database, table: "marketplace_provider_action_approvals")
            let providerActionExecutionColumns = try columns(database: database, table: "marketplace_provider_action_executions")
            let toolRequestColumns = try columns(database: database, table: "applications_tool_requests")
            let neededToolsSnapshotColumns = try columns(database: database, table: "applications_needed_tools_snapshots")
            let workSafetyTaskColumns = try columns(database: database, table: "work_safety_tasks")
            let workSafetyTaskRunColumns = try columns(database: database, table: "work_safety_task_runs")
            let workSafetyTaskEventColumns = try columns(database: database, table: "work_safety_task_events")
            let workSafetyApprovalColumns = try columns(database: database, table: "work_safety_approvals")
            let workSafetyApprovalStepColumns = try columns(database: database, table: "work_safety_approval_steps")
            let workSafetyApprovalNoteColumns = try columns(database: database, table: "work_safety_approval_notes")
            let permissionPolicyColumns = try columns(database: database, table: "permission_policies")
            let auditLogColumns = try columns(database: database, table: "audit_log_records")
            let securityMetricColumns = try columns(database: database, table: "security_metric_snapshots")
            let nativeFilePermissionColumns = try columns(database: database, table: "native_file_permissions")
            let settingsAlertColumns = try columns(database: database, table: "settings_alerts")
            let settingsNotificationPreferenceColumns = try columns(database: database, table: "settings_notification_preferences")
            let settingsDecisionGateDispositionColumns = try columns(database: database, table: "settings_decision_gate_dispositions")
            let settingsLocalAccountExportColumns = try columns(database: database, table: "settings_local_account_exports")
            let insightsReportSnapshotColumns = try columns(database: database, table: "insights_report_snapshots")

            try expect(
                tables.isSuperset(of: [
                    "schema_migrations",
                    "local_profiles",
                    "workspaces",
                    "harnesses",
                    "agents",
                    "runtime_bindings",
                    "threads",
                    "messages",
                    "runtime_sessions",
                    "runtime_dispatches",
                    "settings",
                    "event_log",
                    "secret_references",
                    "bridge_plugin_installations",
                    "thread_sessions",
                    "thread_participants",
                    "thread_read_states",
                    "thread_wrap_up_reports",
                    "chat_composer_drafts",
                    "chat_attachments",
                    "chat_document_references",
                    "companies",
                    "departments",
                    "teams",
                    "agent_manager_relationships",
                    "agent_provisioning_jobs",
                    "agent_preferences",
                    "agent_tasks",
                    "agent_task_runs",
                    "agent_team_memory",
                    "agent_team_handovers",
                    "runtime_dashboard_snapshots",
                    "runtime_dashboard_rows",
                    "runtime_action_capabilities",
                    "runtime_action_runs",
                    "runtime_structured_jobs",
                    "runtime_missing_tool_events",
                    "runtime_recovery_records",
                    "applications_navigation_records",
                    "marketplace_catalog_apps",
                    "applications_catalog_snapshots",
                    "applications_provider_connections",
                    "applications_provider_authorization_flows",
                    "applications_provider_connection_snapshots",
                    "applications_marketplace_installs",
                    "applications_marketplace_install_snapshots",
                    "marketplace_provider_action_definitions",
                    "marketplace_action_permission_maps",
                    "marketplace_provider_action_approvals",
                    "marketplace_provider_action_executions",
                    "applications_tool_requests",
                    "applications_needed_tools_snapshots",
                    "work_safety_tasks",
                    "work_safety_task_runs",
                    "work_safety_task_events",
                    "work_safety_approvals",
                    "work_safety_approval_steps",
                    "work_safety_approval_notes",
                    "permission_policies",
                    "audit_log_records",
                    "security_metric_snapshots",
                    "native_file_permissions",
                    "settings_alerts",
                    "settings_notification_preferences",
                    "settings_decision_gate_dispositions",
                    "settings_local_account_exports",
                    "insights_report_snapshots"
                ]),
                "version 29 tables are missing"
            )
            try expect(
                indexes.isSuperset(of: [
                    "idx_workspaces_profile_id",
                    "idx_harnesses_builtin_runtime",
                    "idx_agents_workspace_id",
                    "idx_runtime_bindings_agent_id",
                    "idx_runtime_bindings_harness_id",
                    "idx_threads_workspace_status",
                    "idx_messages_thread_created",
                    "idx_runtime_sessions_thread_agent",
                    "idx_runtime_dispatches_thread",
                    "idx_runtime_dispatches_status",
                    "idx_settings_scope_key",
                    "idx_event_log_timestamp",
                    "idx_event_log_category",
                    "idx_event_log_dispatch",
                    "idx_bridge_plugin_installations_harness",
                    "idx_runtime_bindings_hermes_profile",
                    "idx_runtime_bindings_external_agent",
                    "idx_local_profiles_updated_at",
                    "idx_workspaces_profile_type",
                    "idx_thread_sessions_sequence",
                    "idx_thread_sessions_status",
                    "idx_thread_participants_thread",
                    "idx_thread_participants_identity",
                    "idx_thread_read_states_scope",
                    "idx_thread_read_states_profile",
                    "idx_thread_wrap_up_reports_thread",
                    "idx_thread_wrap_up_reports_workspace",
                    "idx_threads_workspace_type_status",
                    "idx_threads_active_session",
                    "idx_threads_archive_state",
                    "idx_messages_thread_session",
                    "idx_chat_composer_drafts_scope",
                    "idx_chat_composer_drafts_updated",
                    "idx_chat_attachments_thread_status",
                    "idx_chat_attachments_message",
                    "idx_chat_attachments_profile",
                    "idx_chat_document_references_message",
                    "idx_companies_workspace",
                    "idx_departments_workspace",
                    "idx_departments_company",
                    "idx_teams_workspace",
                    "idx_teams_department",
                    "idx_agent_manager_relationship_unique",
                    "idx_agent_manager_relationship_workspace",
                    "idx_agent_provisioning_jobs_workspace",
                    "idx_agent_provisioning_jobs_agent",
                    "idx_agent_provisioning_jobs_binding",
                    "idx_agent_preferences_agent",
                    "idx_agent_preferences_workspace",
                    "idx_agent_tasks_workspace_status",
                    "idx_agent_tasks_assigned_agent",
                    "idx_agent_tasks_target_agent",
                    "idx_agent_tasks_target_team",
                    "idx_agent_task_runs_task",
                    "idx_agent_task_runs_workspace",
                    "idx_agent_task_runs_agent",
                    "idx_agent_team_memory_team",
                    "idx_agent_team_memory_workspace",
                    "idx_agent_team_handovers_team",
                    "idx_agent_team_handovers_workspace",
                    "idx_runtime_dashboard_snapshots_workspace",
                    "idx_runtime_dashboard_snapshots_state",
                    "idx_runtime_dashboard_rows_snapshot",
                    "idx_runtime_dashboard_rows_workspace",
                    "idx_runtime_dashboard_rows_harness",
                    "idx_runtime_action_capabilities_workspace",
                    "idx_runtime_action_capabilities_dispatch",
                    "idx_runtime_action_capabilities_harness",
                    "idx_runtime_action_runs_idempotency",
                    "idx_runtime_action_runs_workspace",
                    "idx_runtime_action_runs_dispatch",
                    "idx_runtime_action_runs_retention",
                    "idx_runtime_structured_jobs_workspace",
                    "idx_runtime_structured_jobs_dispatch",
                    "idx_runtime_structured_jobs_action_run",
                    "idx_runtime_missing_tools_workspace",
                    "idx_runtime_missing_tools_dispatch",
                    "idx_runtime_missing_tools_agent",
                    "idx_runtime_recovery_workspace",
                    "idx_runtime_recovery_dispatch",
                    "idx_runtime_recovery_job",
                    "idx_applications_navigation_unique",
                    "idx_applications_navigation_policy",
                    "idx_marketplace_catalog_apps_slug",
                    "idx_marketplace_catalog_apps_category",
                    "idx_marketplace_catalog_apps_risk",
                    "idx_marketplace_catalog_apps_state",
                    "idx_marketplace_catalog_apps_source",
                    "idx_applications_catalog_snapshots_workspace",
                    "idx_applications_catalog_snapshots_state",
                    "idx_applications_provider_connections_unique",
                    "idx_applications_provider_connections_app",
                    "idx_applications_provider_connections_status",
                    "idx_applications_provider_connections_auth",
                    "idx_applications_provider_connections_secret_refs",
                    "idx_applications_provider_authorization_workspace",
                    "idx_applications_provider_authorization_app",
                    "idx_applications_provider_authorization_connection",
                    "idx_applications_provider_snapshots_workspace",
                    "idx_applications_provider_snapshots_app",
                    "idx_applications_provider_snapshots_state",
                    "idx_applications_marketplace_installs_active_target",
                    "idx_applications_marketplace_installs_workspace",
                    "idx_applications_marketplace_installs_app",
                    "idx_applications_marketplace_installs_agent",
                    "idx_applications_marketplace_installs_drift",
                    "idx_applications_marketplace_install_snapshots_workspace",
                    "idx_applications_marketplace_install_snapshots_app",
                    "idx_applications_marketplace_install_snapshots_state",
                    "idx_marketplace_provider_action_definitions_unique",
                    "idx_marketplace_provider_action_definitions_app",
                    "idx_marketplace_provider_action_definitions_kind",
                    "idx_marketplace_action_permission_maps_scope",
                    "idx_marketplace_action_permission_maps_install",
                    "idx_marketplace_action_permission_maps_connection",
                    "idx_marketplace_action_permission_maps_agent",
                    "idx_marketplace_provider_action_approvals_idempotency",
                    "idx_marketplace_provider_action_approvals_status",
                    "idx_marketplace_provider_action_approvals_app",
                    "idx_marketplace_provider_action_approvals_install",
                    "idx_marketplace_provider_action_executions_idempotency",
                    "idx_marketplace_provider_action_executions_status",
                    "idx_marketplace_provider_action_executions_app",
                    "idx_marketplace_provider_action_executions_approval",
                    "idx_applications_tool_requests_workspace",
                    "idx_applications_tool_requests_capability",
                    "idx_applications_tool_requests_app",
                    "idx_applications_tool_requests_agent",
                    "idx_applications_tool_requests_open_dedupe",
                    "idx_applications_needed_tools_snapshots_workspace",
                    "idx_applications_needed_tools_snapshots_app",
                    "idx_applications_needed_tools_snapshots_state",
                    "idx_work_safety_tasks_workspace_status",
                    "idx_work_safety_tasks_assigned_agent",
                    "idx_work_safety_tasks_thread",
                    "idx_work_safety_tasks_approval",
                    "idx_work_safety_tasks_action",
                    "idx_work_safety_tasks_schedule",
                    "idx_work_safety_task_runs_task",
                    "idx_work_safety_task_runs_workspace",
                    "idx_work_safety_task_runs_action",
                    "idx_work_safety_task_events_task",
                    "idx_work_safety_task_events_workspace",
                    "idx_work_safety_task_events_approval",
                    "idx_work_safety_approvals_workspace_status",
                    "idx_work_safety_approvals_task",
                    "idx_work_safety_approvals_resolver",
                    "idx_work_safety_approvals_expiry",
                    "idx_work_safety_approval_steps_approval",
                    "idx_work_safety_approval_steps_workspace",
                    "idx_work_safety_approval_notes_approval",
                    "idx_work_safety_approval_notes_workspace",
                    "idx_permission_policies_workspace",
                    "idx_permission_policies_lookup",
                    "idx_permission_policies_effect",
                    "idx_permission_policies_actor",
                    "idx_audit_log_workspace_time",
                    "idx_audit_log_event_time",
                    "idx_audit_log_resource",
                    "idx_audit_log_actor",
                    "idx_audit_log_correlation",
                    "idx_security_metric_snapshots_workspace",
                    "idx_security_metric_snapshots_window",
                    "idx_native_file_permissions_workspace",
                    "idx_native_file_permissions_target",
                    "idx_native_file_permissions_task",
                    "idx_native_file_permissions_tool_request",
                    "idx_native_file_permissions_action_run",
                    "idx_settings_alerts_workspace",
                    "idx_settings_alerts_read",
                    "idx_settings_alerts_expiry",
                    "idx_settings_alerts_source",
                    "idx_settings_notification_preferences_scope",
                    "idx_settings_notification_preferences_workspace",
                    "idx_settings_decision_gate_dispositions_unique",
                    "idx_settings_decision_gate_dispositions_workspace",
                    "idx_settings_decision_gate_dispositions_decision",
                    "idx_settings_local_account_exports_workspace",
                    "idx_settings_local_account_exports_profile",
                    "idx_thread_wrap_up_reports_archive",
                    "idx_insights_report_snapshots_workspace",
                    "idx_insights_report_snapshots_type"
                ]),
                "version 29 indexes are missing"
            )
            try expect(
                profileColumns.isSuperset(of: [
                    "id",
                    "display_name",
                    "email",
                    "avatar_url",
                    "telemetry_enabled",
                    "crash_reporting_enabled",
                    "theme",
                    "created_at",
                    "updated_at"
                ]),
                "version 6 profile columns are missing"
            )
            try expect(
                workspaceColumns.isSuperset(of: [
                    "id",
                    "profile_id",
                    "name",
                    "default_folder_path",
                    "workspace_type",
                    "settings_json",
                    "created_at",
                    "updated_at"
                ]),
                "version 6 workspace columns are missing"
            )
            try expect(
                threadColumns.isSuperset(of: [
                    "thread_type",
                    "active_session_id",
                    "read_state",
                    "unread_count",
                    "is_archived",
                    "archived_at",
                    "last_read_at",
                    "latest_wrap_up_report_id"
                ]),
                "version 7 thread columns are missing"
            )
            try expect(messageColumns.contains("thread_session_id"), "version 7 message session column is missing")
            try expect(
                sessionColumns.isSuperset(of: [
                    "id",
                    "thread_id",
                    "sequence_number",
                    "status",
                    "is_read_only",
                    "relay_run_state",
                    "relay_pause_reason",
                    "relay_reply_limit",
                    "started_at",
                    "ended_at",
                    "created_at",
                    "updated_at"
                ]),
                "version 28 session columns are missing"
            )
            try expect(
                readStateColumns.isSuperset(of: ["id", "thread_id", "profile_id", "last_read_message_id", "last_read_at", "unread_count", "created_at", "updated_at"]),
                "version 7 read-state columns are missing"
            )
            try expect(
                wrapUpColumns.isSuperset(of: ["id", "thread_id", "session_id", "workspace_id", "status", "title", "markdown", "summary", "metadata_json", "message_count", "provider", "model", "error_json", "completed_at", "archived_at", "retry_count", "last_retry_at", "created_at", "updated_at", "redaction_status"]),
                "version 27 wrap-up columns are missing"
            )
            try expect(
                draftColumns.isSuperset(of: ["id", "thread_id", "profile_id", "content", "metadata_json", "created_at", "updated_at"]),
                "version 8 composer draft columns are missing"
            )
            try expect(
                attachmentColumns.isSuperset(of: [
                    "id",
                    "thread_id",
                    "message_id",
                    "profile_id",
                    "file_name",
                    "mime_type",
                    "byte_size",
                    "sha256",
                    "kind",
                    "status",
                    "progress",
                    "provenance_json",
                    "error_json",
                    "created_at",
                    "updated_at"
                ]),
                "version 9 attachment columns are missing"
            )
            try expect(
                referenceColumns.isSuperset(of: [
                    "id",
                    "message_id",
                    "title",
                    "reference_kind",
                    "display_path",
                    "token_count",
                    "is_sensitive",
                    "is_redacted",
                    "metadata_json",
                    "created_at"
                ]),
                "version 9 document reference columns are missing"
            )
            try expect(
                agentColumns.isSuperset(of: [
                    "role",
                    "source",
                    "external_id",
                    "group_type",
                    "family_label",
                    "company_id",
                    "department_id",
                    "team_id",
                    "manager_agent_id",
                    "classification",
                    "model",
                    "response_presentation",
                    "provisioning_status",
                    "current_task_id",
                    "metrics_json",
                    "budget_json"
                ]),
                "version 10 agent org columns are missing"
            )
            try expect(
                companyColumns.isSuperset(of: ["id", "workspace_id", "name", "industry", "status", "metadata_json", "created_at", "updated_at"]),
                "version 10 company columns are missing"
            )
            try expect(
                departmentColumns.isSuperset(of: ["id", "workspace_id", "company_id", "name", "color_hex", "head_agent_id", "agentops_room_id", "status", "metadata_json", "created_at", "updated_at"]),
                "version 10 department columns are missing"
            )
            try expect(
                teamColumns.isSuperset(of: ["id", "workspace_id", "department_id", "name", "lead_agent_id", "agentops_room_id", "status", "metadata_json", "created_at", "updated_at"]),
                "version 10 team columns are missing"
            )
            try expect(
                managerColumns.isSuperset(of: ["id", "workspace_id", "manager_agent_id", "report_agent_id", "relationship_type", "metadata_json", "created_at", "updated_at"]),
                "version 10 manager relationship columns are missing"
            )
            try expect(
                provisioningColumns.isSuperset(of: ["id", "workspace_id", "requested_by_profile_id", "harness_id", "runtime_type", "status", "stage", "message", "error_json", "created_agent_id", "runtime_binding_id", "external_agent_id", "payload_json", "files_metadata_json", "created_at", "updated_at", "completed_at"]),
                "version 12 provisioning job columns are missing"
            )
            try expect(
                agentPreferenceColumns.isSuperset(of: ["id", "workspace_id", "agent_id", "cosmetic_display_name", "avatar_reference", "avatar_state", "response_presentation", "metadata_json", "created_at", "updated_at"]),
                "version 11 agent preference columns are missing"
            )
            try expect(
                taskColumns.isSuperset(of: ["id", "workspace_id", "assigned_agent_id", "target_agent_id", "target_team_id", "title", "message", "priority", "target_type", "status", "requires_approval", "scheduled_at", "time_zone", "recurrence", "last_error", "thread_id", "metadata_json", "archived_at", "created_at", "updated_at"]),
                "version 13 task columns are missing"
            )
            try expect(
                taskRunColumns.isSuperset(of: ["id", "workspace_id", "task_id", "agent_id", "dispatch_id", "status", "tokens_used", "started_at", "completed_at", "error_json", "metadata_json", "created_at", "updated_at"]),
                "version 13 task run columns are missing"
            )
            try expect(
                memoryColumns.isSuperset(of: ["id", "workspace_id", "team_id", "title", "memory_type", "content", "is_sensitive", "metadata_json", "created_by_agent_id", "created_at", "updated_at"]),
                "version 13 team memory columns are missing"
            )
            try expect(
                handoverColumns.isSuperset(of: ["id", "workspace_id", "team_id", "from_agent_id", "title", "content", "is_sensitive", "metadata_json", "created_at", "updated_at"]),
                "version 13 team handover columns are missing"
            )
            try expect(
                runtimeSnapshotColumns.isSuperset(of: ["id", "workspace_id", "state", "refreshed_at", "last_successful_refresh_at", "stale_after_seconds", "local_status_state", "local_status_reason", "disabled_reason", "error_json", "retry_available", "read_only", "snapshot_json", "created_at", "updated_at"]),
                "version 14 runtime dashboard snapshot columns are missing"
            )
            try expect(
                runtimeRowColumns.isSuperset(of: ["id", "snapshot_id", "workspace_id", "row_kind", "runtime_type", "harness_id", "connected_app_id", "display_name", "status", "reachability", "active_dispatch_count", "failed_dispatch_count", "retryable_dispatch_count", "assigned_agent_count", "latest_dispatch_id", "last_activity_at", "row_json", "created_at", "updated_at"]),
                "version 14 runtime dashboard row columns are missing"
            )
            try expect(
                runtimeActionCapabilityColumns.isSuperset(of: ["id", "workspace_id", "action_kind", "display_name", "availability", "state_kind", "reason_code", "message", "recovery", "scope_type", "runtime_type", "harness_id", "dispatch_id", "agent_id", "destructive", "dry_run_supported", "execution_supported", "read_only", "stale_after_seconds", "evaluated_at", "source", "redaction_status", "capability_json", "created_at", "updated_at"]),
                "version 15 runtime action capability columns are missing"
            )
            try expect(
                runtimeActionRunColumns.isSuperset(of: ["id", "workspace_id", "capability_id", "action_kind", "status", "state_kind", "reason_code", "idempotency_key", "actor_id", "scope_type", "runtime_type", "harness_id", "dispatch_id", "agent_id", "destructive", "dry_run", "execution_attempted", "request_json", "result_json", "failure_json", "retention_expires_at", "action_run_json", "created_at", "updated_at", "completed_at", "redaction_status"]),
                "version 15 runtime action run columns are missing"
            )
            try expect(
                structuredJobColumns.isSuperset(of: ["id", "workspace_id", "dispatch_id", "action_run_id", "job_type", "status", "title", "retryable", "context_usage_json", "participant_health_json", "follow_up_failure_json", "recovery_json", "source_host_excluded", "metadata_json", "structured_job_json", "created_at", "updated_at", "completed_at", "redaction_status"]),
                "version 16 runtime structured job columns are missing"
            )
            try expect(
                missingToolColumns.isSuperset(of: ["id", "workspace_id", "dispatch_id", "agent_id", "tool_name", "status", "request_json", "auto_install_attempted", "fake_grant_created", "source", "missing_tool_json", "created_at", "updated_at", "redaction_status"]),
                "version 16 runtime missing tool columns are missing"
            )
            try expect(
                recoveryColumns.isSuperset(of: ["id", "workspace_id", "dispatch_id", "job_id", "state", "retryable", "reason_code", "message", "follow_up_action", "source_host_excluded", "recovery_json", "recovery_record_json", "created_at", "updated_at", "resolved_at", "redaction_status"]),
                "version 16 runtime recovery columns are missing"
            )
            try expect(
                applicationsNavigationColumns.isSuperset(of: ["id", "workspace_id", "section_key", "label", "policy", "state_kind", "reason_code", "visible_to_roles_json", "message", "navigation_json", "created_at", "updated_at", "redaction_status"]),
                "version 17 applications navigation columns are missing"
            )
            try expect(
                marketplaceCatalogColumns.isSuperset(of: ["id", "workspace_id", "slug", "name", "summary", "description", "category", "source_type", "risk_level", "auth_type", "connection_type", "capabilities_json", "runtime_support_json", "role_manifest_json", "availability", "availability_reason", "connection_state", "install_state", "installed_agent_count", "installed_agent_ids_json", "docs_url", "website_url", "beta_notice", "icon_initials", "icon_color_name", "read_only", "local_app_excluded", "review_excluded", "app_json", "created_at", "updated_at", "redaction_status"]),
                "version 17 marketplace catalog app columns are missing"
            )
            try expect(
                applicationsSnapshotColumns.isSuperset(of: ["id", "workspace_id", "state", "view", "search_query", "selected_category", "risk_level", "selected_app_id", "response_count", "demo_fallback_used", "read_only", "snapshot_json", "created_at", "updated_at", "redaction_status"]),
                "version 17 applications catalog snapshot columns are missing"
            )
            try expect(
                providerConnectionColumns.isSuperset(of: ["id", "workspace_id", "app_id", "app_slug", "provider_key", "provider_name", "connection_status", "authorization_state", "credential_ownership", "user_owned_credentials_required", "credential_requirements_json", "secret_reference_ids_json", "account_label", "connected_handle", "callback_url", "required_scopes_json", "granted_scopes_json", "selected_capabilities_json", "health_json", "sender_identities_json", "install_policy", "last_checked_at", "last_error", "manual_evidence_note", "reauthorize_required", "disconnecting", "beta_blocked", "connection_json", "created_at", "updated_at", "redaction_status"]),
                "version 18 provider connection columns are missing"
            )
            try expect(
                providerAuthorizationColumns.isSuperset(of: ["id", "workspace_id", "app_id", "connection_id", "provider_key", "state", "callback_url", "authorization_url", "deep_link_url", "manual_evidence_note", "error_message", "started_by_actor_id", "started_at", "completed_at", "flow_json", "created_at", "updated_at", "redaction_status"]),
                "version 18 provider authorization columns are missing"
            )
            try expect(
                providerSnapshotColumns.isSuperset(of: ["id", "workspace_id", "app_id", "state", "connection_count", "authorization_flow_count", "selected_connection_id", "read_only", "snapshot_json", "created_at", "updated_at", "redaction_status"]),
                "version 18 provider connection snapshot columns are missing"
            )
            try expect(
                marketplaceInstallColumns.isSuperset(of: ["id", "workspace_id", "app_id", "app_slug", "connection_id", "agent_id", "runtime_binding_id", "harness_id", "runtime_type", "role_id", "role_label", "selected_capabilities_json", "approval_profile_id", "runtime_format", "target_mode", "risk_acknowledged", "install_status", "drift_status", "last_installed_at", "removed_at", "failure_message", "metadata_json", "created_by_actor_id", "install_json", "created_at", "updated_at", "redaction_status"]),
                "version 19 marketplace install columns are missing"
            )
            try expect(
                marketplaceInstallSnapshotColumns.isSuperset(of: ["id", "workspace_id", "app_id", "state", "install_count", "compatible_agent_count", "selected_install_id", "read_only", "snapshot_json", "created_at", "updated_at", "redaction_status"]),
                "version 19 marketplace install snapshot columns are missing"
            )
            try expect(
                providerActionDefinitionColumns.isSuperset(of: ["id", "workspace_id", "app_id", "app_slug", "provider_key", "action_key", "display_name", "action_kind", "risk_level", "adapter_kind", "default_permission", "enabled", "definition_json", "created_at", "updated_at", "redaction_status"]),
                "version 29 provider action definition columns are missing"
            )
            try expect(
                actionPermissionMapColumns.isSuperset(of: ["id", "workspace_id", "app_id", "app_slug", "connection_id", "install_id", "agent_id", "policy_preset", "permissions_json", "map_json", "created_by_actor_id", "updated_by_actor_id", "created_at", "updated_at", "redaction_status"]),
                "version 29 provider action permission map columns are missing"
            )
            try expect(
                providerActionApprovalColumns.isSuperset(of: ["id", "workspace_id", "app_id", "app_slug", "connection_id", "install_id", "agent_id", "provider_action_id", "action_key", "approval_status", "proposed_payload_hash", "idempotency_key", "expires_at", "resolved_at", "execution_id", "approval_json", "created_at", "updated_at", "redaction_status"]),
                "version 29 provider action approval columns are missing"
            )
            try expect(
                providerActionExecutionColumns.isSuperset(of: ["id", "workspace_id", "app_id", "app_slug", "connection_id", "install_id", "agent_id", "provider_action_id", "action_key", "permission", "execution_status", "idempotency_key", "approval_id", "adapter_kind", "execution_json", "started_at", "completed_at", "created_at", "updated_at", "redaction_status"]),
                "version 29 provider action execution columns are missing"
            )
            try expect(
                toolRequestColumns.isSuperset(of: ["id", "workspace_id", "requested_capability", "normalized_capability", "app_id", "app_slug", "agent_id", "thread_id", "dispatch_id", "missing_tool_event_id", "related_task_id", "related_record_id", "campaign", "reason", "required_action", "evidence", "request_status", "policy_allowed", "tool_available", "tool_connected", "tool_granted", "availability_state", "suggested_apps_json", "metadata_json", "request_json", "requested_at", "last_seen_at", "resolved_at", "resolution_note", "created_by_actor_id", "updated_by_actor_id", "created_at", "updated_at", "redaction_status"]),
                "version 20 tool request columns are missing"
            )
            try expect(
                neededToolsSnapshotColumns.isSuperset(of: ["id", "workspace_id", "app_id", "state", "query_status", "open_request_count", "connected_count", "granted_count", "unavailable_count", "selected_request_id", "read_only", "snapshot_json", "created_at", "updated_at", "redaction_status"]),
                "version 20 needed tools snapshot columns are missing"
            )
            try expect(
                workSafetyTaskColumns.isSuperset(of: ["id", "workspace_id", "title", "message", "task_status", "target_type", "target_id", "assigned_agent_id", "thread_id", "runtime_binding_id", "action_run_id", "dispatch_id", "structured_job_id", "approval_required", "approval_id", "scheduled_message_id", "source_host_record_id", "scheduled_at", "recurrence_rule", "priority", "risk_level", "metadata_json", "task_json", "created_at", "updated_at", "completed_at", "redaction_status"]),
                "version 21 work-safety task columns are missing"
            )
            try expect(
                workSafetyTaskRunColumns.isSuperset(of: ["id", "workspace_id", "task_id", "run_status", "action_run_id", "dispatch_id", "structured_job_id", "attempt", "started_at", "completed_at", "failure_message", "metadata_json", "run_json", "created_at", "updated_at", "redaction_status"]),
                "version 21 work-safety task run columns are missing"
            )
            try expect(
                workSafetyTaskEventColumns.isSuperset(of: ["id", "workspace_id", "task_id", "run_id", "approval_id", "event_type", "status", "detail_json", "event_json", "occurred_at", "redaction_status"]),
                "version 21 work-safety task event columns are missing"
            )
            try expect(
                workSafetyApprovalColumns.isSuperset(of: ["id", "workspace_id", "task_id", "title", "description", "approval_status", "risk_level", "requested_by_agent_id", "resolver_agent_id", "expires_at", "resolved_at", "metadata_json", "approval_json", "created_at", "updated_at", "redaction_status"]),
                "version 21 work-safety approval columns are missing"
            )
            try expect(
                workSafetyApprovalStepColumns.isSuperset(of: ["id", "workspace_id", "approval_id", "label", "value", "step_status", "sort_index", "step_json", "redaction_status"]),
                "version 21 work-safety approval step columns are missing"
            )
            try expect(
                workSafetyApprovalNoteColumns.isSuperset(of: ["id", "workspace_id", "approval_id", "author_agent_id", "note", "note_json", "created_at", "redaction_status"]),
                "version 21 work-safety approval note columns are missing"
            )
            try expect(
                permissionPolicyColumns.isSuperset(of: ["id", "workspace_id", "policy_name", "effect", "policy_status", "role_targets_json", "resource_type", "resource_id", "action", "priority", "reason_code", "message", "metadata_json", "created_by_actor_id", "updated_by_actor_id", "policy_json", "created_at", "updated_at", "redaction_status"]),
                "version 22 permission policy columns are missing"
            )
            try expect(
                auditLogColumns.isSuperset(of: ["id", "workspace_id", "actor_id", "actor_type", "event_type", "resource_type", "resource_id", "severity", "message", "correlation_id", "task_id", "approval_id", "action_run_id", "dispatch_id", "thread_id", "harness_id", "source", "context_json", "write_status", "record_json", "created_at", "redaction_status"]),
                "version 23 audit log columns are missing"
            )
            try expect(
                securityMetricColumns.isSuperset(of: ["id", "workspace_id", "window_started_at", "window_ended_at", "generated_at", "audit_event_count", "denied_action_count", "permission_denied_count", "approval_decision_count", "policy_mutation_count", "task_transition_count", "tool_request_transition_count", "command_rejection_count", "high_risk_execution_count", "file_permission_change_count", "export_reset_attempt_count", "recovery_event_count", "audit_write_failure_count", "redaction_applied_count", "category_counts_json", "snapshot_json", "redaction_status"]),
                "version 23 security metric columns are missing"
            )
            try expect(
                nativeFilePermissionColumns.isSuperset(of: ["id", "workspace_id", "target_kind", "display_name", "display_path", "path_hash", "bookmark_ref", "access_level", "permission_status", "related_task_id", "related_tool_request_id", "related_action_run_id", "last_validated_at", "last_synced_at", "failure_reason", "metadata_json", "permission_json", "created_by_actor_id", "updated_by_actor_id", "revoked_at", "created_at", "updated_at", "redaction_status"]),
                "version 24 native file permission columns are missing"
            )
            try expect(
                settingsAlertColumns.isSuperset(of: ["id", "workspace_id", "title", "message", "severity", "category", "source_kind", "source_id", "action_label", "action_target", "expires_at", "read_at", "metadata_json", "alert_json", "created_at", "updated_at", "redaction_status"]),
                "version 25 settings alert columns are missing"
            )
            try expect(
                settingsNotificationPreferenceColumns.isSuperset(of: ["id", "workspace_id", "profile_id", "in_app_alerts_enabled", "unread_badge_enabled", "email_delivery_state", "mobile_delivery_state", "metadata_json", "preferences_json", "created_at", "updated_at", "redaction_status"]),
                "version 25 settings notification preference columns are missing"
            )
            try expect(
                settingsDecisionGateDispositionColumns.isSuperset(of: ["id", "workspace_id", "decision_id", "surface", "disposition_state", "reason_code", "current_ui_state", "missing_prerequisites", "activation_requirement", "release_impact", "metadata_json", "disposition_json", "created_at", "updated_at", "redaction_status"]),
                "version 26 settings decision gate disposition columns are missing"
            )
            try expect(
                settingsLocalAccountExportColumns.isSuperset(of: ["id", "workspace_id", "profile_id", "export_status", "file_name", "record_count", "includes_secrets", "export_metadata_json", "export_json", "created_at", "updated_at", "redaction_status"]),
                "version 26 settings local account export columns are missing"
            )
            try expect(
                insightsReportSnapshotColumns.isSuperset(of: ["id", "workspace_id", "title", "summary", "snapshot_type", "period_label", "range_start", "range_end", "payload_json", "archived_at", "created_at", "updated_at", "redaction_status"]),
                "version 27 insights report snapshot columns are missing"
            )
        }
    }

    private static func testInertSeedSettingsAndNoProductSeeds() throws {
        try withTemporaryDatabase { database, _, _ in
            try runMigrations(database: database)

            let settingsRows = try database.all(
                "SELECT key, value_json FROM settings WHERE scope = 'app' AND scope_id IS NULL ORDER BY key"
            )
            let settings = try Dictionary(uniqueKeysWithValues: settingsRows.map { row in
                (try text(row, "key"), try text(row, "value_json"))
            })

            try expect(settings == [
                "diagnostics.enabled": "false",
                "message.maxLength": "32000"
            ], "default settings were not the expected inert seed values")

            for table in productSeedTables {
                let count = try scalarCount(database, "SELECT COUNT(*) AS count FROM \(table)")
                try expect(count == 0, "\(table) should not contain migration seed rows")
            }
        }
    }

    private static func testGeneratedWelcomeCleanupMigration() throws {
        try withTemporaryDatabase { database, _, _ in
            try applyMigrations(database, through: 4)
            try seedLegacyWelcomeRows(database)

            try expect(
                try scalarCount(database, "SELECT COUNT(*) AS count FROM messages") == 5,
                "legacy message seed did not insert"
            )

            try runMigrations(database: database)

            let rows = try database.all("SELECT id, content, metadata_json FROM messages ORDER BY id")
            let ids = try Set(rows.map { try text($0, "id") })

            try expect(ids == ["msg-agent-keep-001", "msg-user-keep-001"], "welcome cleanup removed the wrong rows")
            for row in rows {
                let content = try text(row, "content")
                let metadata = try text(row, "metadata_json")
                try expect(!content.contains("Hi, fake local welcome."), "legacy generated welcome content remained")
                try expect(!content.contains("Welcome to Relay Console"), "legacy generated welcome content remained")
                try expect(!metadata.contains("agent_welcome"), "legacy generated welcome metadata remained")
            }
        }
    }

    private static func testProfileWorkspacePreferencesMigration() throws {
        try withTemporaryDatabase { database, _, _ in
            try applyMigrations(database, through: 5)
            try database.run(
                "INSERT INTO local_profiles (id, display_name, created_at, updated_at) VALUES ('prof-v006-001', 'Existing Profile', ?, ?)",
                [.text(fixedTimestamp), .text(fixedTimestamp)]
            )
            try database.run(
                "INSERT INTO workspaces (id, profile_id, name, default_folder_path, created_at, updated_at) VALUES ('wks-v006-001', 'prof-v006-001', 'Existing Workspace', NULL, ?, ?)",
                [.text(fixedTimestamp), .text(fixedTimestamp)]
            )

            try runMigrations(database: database)

            let profile = try unwrap(
                database.get("SELECT * FROM local_profiles WHERE id = 'prof-v006-001'"),
                "missing migrated profile row"
            )
            let workspace = try unwrap(
                database.get("SELECT * FROM workspaces WHERE id = 'wks-v006-001'"),
                "missing migrated workspace row"
            )
            try expect(try optionalText(profile, "email") == nil, "migration should not invent profile email")
            try expect(try optionalText(profile, "avatar_url") == nil, "migration should not invent profile avatar")
            try expect(try integer(profile, "telemetry_enabled") == 1, "migration should default telemetry to enabled")
            try expect(try integer(profile, "crash_reporting_enabled") == 1, "migration should default crash reporting to enabled")
            try expect(try text(profile, "theme") == "classic", "migration should default theme to classic")
            try expect(try text(workspace, "workspace_type") == "personal", "migration should default workspace type to personal")
            try expect(try text(workspace, "settings_json") == "{}", "migration should default workspace settings to empty object")
        }
    }

    private static func testChatMigrationPreservesExistingDirectRowsAndSessions() throws {
        try withTemporaryDatabase { database, _, _ in
            try applyMigrations(database, through: 6)
            try database.run(
                "INSERT INTO local_profiles (id, display_name, created_at, updated_at) VALUES ('prof-chat-001', 'Existing Profile', ?, ?)",
                [.text(fixedTimestamp), .text(fixedTimestamp)]
            )
            try database.run(
                "INSERT INTO workspaces (id, profile_id, name, created_at, updated_at) VALUES ('wks-chat-001', 'prof-chat-001', 'Existing Workspace', ?, ?)",
                [.text(fixedTimestamp), .text(fixedTimestamp)]
            )
            try database.run(
                """
                INSERT INTO threads (
                  id, workspace_id, title, selected_agent_id, status, last_message_snippet, last_message_at, created_at, updated_at
                )
                VALUES ('thr-chat-001', 'wks-chat-001', 'Existing Direct Thread', NULL, 'active', 'Retained user message.', ?, ?, ?)
                """,
                [.text(fixedTimestamp), .text(fixedTimestamp), .text(fixedTimestamp)]
            )
            try database.run(
                """
                INSERT INTO messages (
                  id, thread_id, sender_type, sender_id, sender_name, content, content_format, metadata_json, created_at
                )
                VALUES ('msg-chat-001', 'thr-chat-001', 'user', NULL, 'Local User', 'Retained user message.', 'plain', '{}', ?)
                """,
                [.text(fixedTimestamp)]
            )

            try runMigrations(database: database)

            let thread = try unwrap(database.get("SELECT * FROM threads WHERE id = 'thr-chat-001'"), "missing migrated thread")
            try expect(try text(thread, "thread_type") == "direct", "migration should default existing threads to direct")
            try expect(try text(thread, "active_session_id") == "chs-thr-chat-001", "migration should link active session")
            try expect(try text(thread, "read_state") == "read", "migration should not invent unread state")
            try expect(try integer(thread, "unread_count") == 0, "migration should not invent unread count")
            try expect(try integer(thread, "is_archived") == 0, "active thread should not be archived")

            let session = try unwrap(database.get("SELECT * FROM thread_sessions WHERE thread_id = 'thr-chat-001'"), "missing backfilled session")
            try expect(try text(session, "id") == "chs-thr-chat-001", "session id should be deterministic from source thread")
            try expect(try integer(session, "sequence_number") == 1, "backfilled session should be first cycle")
            try expect(try text(session, "status") == "active", "backfilled session should be active")

            let message = try unwrap(database.get("SELECT * FROM messages WHERE id = 'msg-chat-001'"), "missing migrated message")
            try expect(try text(message, "thread_session_id") == "chs-thr-chat-001", "existing message should link to backfilled session")
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM messages") == 1, "chat migration should not insert transcript rows")
            try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM thread_wrap_up_reports") == 0, "chat migration should not seed wrap-up reports")
        }
    }

    private static func testAgentOrgMigrationPreservesExistingAgents() throws {
        try withTemporaryDatabase { database, _, _ in
            try applyMigrations(database, through: 9)
            try database.run(
                "INSERT INTO local_profiles (id, display_name, created_at, updated_at) VALUES ('prof-org-001', 'Existing Profile', ?, ?)",
                [.text(fixedTimestamp), .text(fixedTimestamp)]
            )
            try database.run(
                "INSERT INTO workspaces (id, profile_id, name, created_at, updated_at) VALUES ('wks-org-001', 'prof-org-001', 'Existing Workspace', ?, ?)",
                [.text(fixedTimestamp), .text(fixedTimestamp)]
            )
            try database.run(
                """
                INSERT INTO harnesses (
                  id, runtime_type, display_name, mode, config_json, status, built_in, created_at, updated_at
                ) VALUES (
                  'hrn-org-001', 'hermes', 'Hermes', 'app_managed', '{}', 'active', 1, ?, ?
                )
                """,
                [.text(fixedTimestamp), .text(fixedTimestamp)]
            )
            try database.run(
                """
                INSERT INTO agents (id, workspace_id, name, description, status, created_at, updated_at)
                VALUES ('agt-org-001', 'wks-org-001', 'Existing Agent', NULL, 'active', ?, ?)
                """,
                [.text(fixedTimestamp), .text(fixedTimestamp)]
            )
            try database.run(
                """
                INSERT INTO runtime_bindings (
                  id, agent_id, harness_id, runtime_type, adapter_kind, routing_mode,
                  external_agent_id, hermes_profile_slug, hermes_home_path,
                  hermes_identity_file_path, workspace_folder_path, config_json,
                  created_at, updated_at
                ) VALUES (
                  'rb-org-001', 'agt-org-001', 'hrn-org-001', 'hermes',
                  'app_managed', 'local', 'external-agent-001', NULL, NULL,
                  NULL, NULL, '{}', ?, ?
                )
                """,
                [.text(fixedTimestamp), .text(fixedTimestamp)]
            )

            try runMigrations(database: database)

            let agent = try unwrap(database.get("SELECT * FROM agents WHERE id = 'agt-org-001'"), "missing migrated agent")
            try expect(try text(agent, "name") == "Existing Agent", "agent name should be preserved")
            try expect(try optionalText(agent, "company_id") == nil, "migration should not invent company placement")
            try expect(try optionalText(agent, "department_id") == nil, "migration should not invent department placement")
            try expect(try optionalText(agent, "team_id") == nil, "migration should not invent team placement")
            try expect(try optionalText(agent, "manager_agent_id") == nil, "migration should not invent manager")
            try expect(try optionalText(agent, "response_presentation") == nil, "migration should not invent response presentation")
            try expect(try text(agent, "metrics_json") == "{}", "migration should default metrics to empty object")
            try expect(try text(agent, "budget_json") == "{}", "migration should default budget to empty object")
            try expect(
                try scalarCount(database, "SELECT COUNT(*) AS count FROM runtime_bindings WHERE agent_id = 'agt-org-001'") == 1,
                "runtime binding should be preserved"
            )
            for table in ["companies", "departments", "teams", "agent_manager_relationships", "agent_provisioning_jobs", "agent_preferences", "agent_tasks", "agent_task_runs", "agent_team_memory", "agent_team_handovers"] {
                try expect(try scalarCount(database, "SELECT COUNT(*) AS count FROM \(table)") == 0, "\(table) should not be seeded")
            }
        }
    }

    private static func testRedactionBehaviorOnMigratedStore() throws {
        try withTemporaryDatabase { database, databasePath, _ in
            try runMigrations(database: database)

            let data = LocalDataService(database: database, eventBus: RelayEventBus(), appVersion: "test")
            let sensitiveA = "migration-sensitive-value-001"
            let sensitiveB = "migration-sensitive-value-002"

            _ = try data.upsertHarness(
                runtimeType: .hermes,
                displayName: "Hermes Agent",
                mode: .appManaged,
                config: [
                    "command": .string("run --token=\(sensitiveA)"),
                    "nested": .object(["auth": .string("bearer \(sensitiveB)")])
                ]
            )
            _ = try data.log(
                severity: "info",
                category: "migration",
                message: "token=\(sensitiveA)",
                detail: ["credential": .string("credential=\(sensitiveB)")]
            )

            let harnessRow = try unwrap(
                database.get("SELECT config_json FROM harnesses WHERE runtime_type = 'hermes' LIMIT 1"),
                "missing redacted harness row"
            )
            let logRow = try unwrap(
                database.get("SELECT message, detail_json FROM event_log WHERE category = 'migration' LIMIT 1"),
                "missing redacted log row"
            )
            let persisted = [
                try text(harnessRow, "config_json"),
                try text(logRow, "message"),
                try text(logRow, "detail_json")
            ].joined(separator: "\n")

            try expect(persisted.contains("[REDACTED]"), "redacted fields did not contain marker")
            try expect(!persisted.contains(sensitiveA), "first sensitive value was persisted")
            try expect(!persisted.contains(sensitiveB), "second sensitive value was persisted")

            let sqliteBytes = try Data(contentsOf: databasePath)
            let sqliteText = String(decoding: sqliteBytes, as: UTF8.self)
            try expect(!sqliteText.contains(sensitiveA), "first sensitive value appeared in SQLite bytes")
            try expect(!sqliteText.contains(sensitiveB), "second sensitive value appeared in SQLite bytes")
        }
    }

    private static func testFixtureManifestMatchesSchema() throws {
        let manifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/baseline/v005-clean-local-store-001/manifest.md")
        let manifest = try String(contentsOf: manifestPath, encoding: .utf8)

        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(manifest.contains("\(field):"), "fixture manifest is missing \(field)")
        }

        try expect(manifest.contains("VC-0100"), "fixture manifest must link migration command id")
        try expect(manifest.contains("RelayConsoleMigrationTests"), "fixture manifest must name consuming test")
        try expect(manifest.contains("v005-clean-local-store-001"), "fixture manifest must name stable case id")

        let profileWorkspaceManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/profile-workspace/v006-profile-preferences-001/manifest.md")
        let profileWorkspaceManifest = try String(contentsOf: profileWorkspaceManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(profileWorkspaceManifest.contains("\(field):"), "profile workspace manifest is missing \(field)")
        }
        try expect(profileWorkspaceManifest.contains("VC-0100"), "profile workspace manifest must link migration command id")
        try expect(profileWorkspaceManifest.contains("ITC-0009"), "profile workspace manifest must link ITC-0009")

        let chatManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/chat-content/v007-thread-session-read-state-001/manifest.md")
        let chatManifest = try String(contentsOf: chatManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(chatManifest.contains("\(field):"), "chat migration manifest is missing \(field)")
        }
        try expect(chatManifest.contains("VC-0100"), "chat migration manifest must link migration command id")
        try expect(chatManifest.contains("ITC-0013"), "chat migration manifest must link ITC-0013")

        let composerDraftManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/chat-content/v008-composer-drafts-001/manifest.md")
        let composerDraftManifest = try String(contentsOf: composerDraftManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(composerDraftManifest.contains("\(field):"), "composer draft migration manifest is missing \(field)")
        }
        try expect(composerDraftManifest.contains("VC-0100"), "composer draft migration manifest must link migration command id")
        try expect(composerDraftManifest.contains("ITC-0015"), "composer draft migration manifest must link ITC-0015")

        let attachmentsManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/chat-content/v009-attachments-references-001/manifest.md")
        let attachmentsManifest = try String(contentsOf: attachmentsManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(attachmentsManifest.contains("\(field):"), "attachments migration manifest is missing \(field)")
        }
        try expect(attachmentsManifest.contains("VC-0100"), "attachments migration manifest must link migration command id")
        try expect(attachmentsManifest.contains("ITC-0016"), "attachments migration manifest must link ITC-0016")

        let agentOrgManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/agents-org/v010-org-provisioning-001/manifest.md")
        let agentOrgManifest = try String(contentsOf: agentOrgManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(agentOrgManifest.contains("\(field):"), "agent org migration manifest is missing \(field)")
        }
        try expect(agentOrgManifest.contains("VC-0100"), "agent org migration manifest must link migration command id")
        try expect(agentOrgManifest.contains("ITC-0021"), "agent org migration manifest must link ITC-0021")

        let agentPreferenceManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/agents-org/v011-agent-preferences-001/manifest.md")
        let agentPreferenceManifest = try String(contentsOf: agentPreferenceManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(agentPreferenceManifest.contains("\(field):"), "agent preference migration manifest is missing \(field)")
        }
        try expect(agentPreferenceManifest.contains("VC-0100"), "agent preference migration manifest must link migration command id")
        try expect(agentPreferenceManifest.contains("ITC-0022"), "agent preference migration manifest must link ITC-0022")

        let provisioningLifecycleManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/agents-org/v012-provisioning-lifecycle-001/manifest.md")
        let provisioningLifecycleManifest = try String(contentsOf: provisioningLifecycleManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(provisioningLifecycleManifest.contains("\(field):"), "provisioning lifecycle migration manifest is missing \(field)")
        }
        try expect(provisioningLifecycleManifest.contains("VC-0100"), "provisioning lifecycle migration manifest must link migration command id")
        try expect(provisioningLifecycleManifest.contains("ITC-0023"), "provisioning lifecycle migration manifest must link ITC-0023")

        let runtimeDashboardManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/runtime-replay/v014-runtime-dashboard-snapshots-001/manifest.md")
        let runtimeDashboardManifest = try String(contentsOf: runtimeDashboardManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(runtimeDashboardManifest.contains("\(field):"), "runtime dashboard migration manifest is missing \(field)")
        }
        try expect(runtimeDashboardManifest.contains("VC-0100"), "runtime dashboard migration manifest must link migration command id")
        try expect(runtimeDashboardManifest.contains("ITC-0029"), "runtime dashboard migration manifest must link ITC-0029")

        let runtimeActionManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/runtime-replay/v015-runtime-action-runs-001/manifest.md")
        let runtimeActionManifest = try String(contentsOf: runtimeActionManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(runtimeActionManifest.contains("\(field):"), "runtime action migration manifest is missing \(field)")
        }
        try expect(runtimeActionManifest.contains("VC-0100"), "runtime action migration manifest must link migration command id")
        try expect(runtimeActionManifest.contains("ITC-0030"), "runtime action migration manifest must link ITC-0030")

        let runtimeRecoveryManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/runtime-replay/v016-runtime-recovery-records-001/manifest.md")
        let runtimeRecoveryManifest = try String(contentsOf: runtimeRecoveryManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(runtimeRecoveryManifest.contains("\(field):"), "runtime recovery migration manifest is missing \(field)")
        }
        try expect(runtimeRecoveryManifest.contains("VC-0100"), "runtime recovery migration manifest must link migration command id")
        try expect(runtimeRecoveryManifest.contains("ITC-0031"), "runtime recovery migration manifest must link ITC-0031")

        let applicationsManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/applications/v017-marketplace-catalog-001/manifest.md")
        let applicationsManifest = try String(contentsOf: applicationsManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(applicationsManifest.contains("\(field):"), "applications migration manifest is missing \(field)")
        }
        try expect(applicationsManifest.contains("VC-0100"), "applications migration manifest must link migration command id")
        try expect(applicationsManifest.contains("ITC-0032"), "applications migration manifest must link ITC-0032")

        let providerManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/applications/v018-provider-connections-001/manifest.md")
        let providerManifest = try String(contentsOf: providerManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(providerManifest.contains("\(field):"), "provider connection migration manifest is missing \(field)")
        }
        try expect(providerManifest.contains("VC-0100"), "provider connection migration manifest must link migration command id")
        try expect(providerManifest.contains("ITC-0033"), "provider connection migration manifest must link ITC-0033")

        let installManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/applications/v019-marketplace-installs-001/manifest.md")
        let installManifest = try String(contentsOf: installManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(installManifest.contains("\(field):"), "marketplace install migration manifest is missing \(field)")
        }
        try expect(installManifest.contains("VC-0100"), "marketplace install migration manifest must link migration command id")
        try expect(installManifest.contains("ITC-0034"), "marketplace install migration manifest must link ITC-0034")

        let neededToolsManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/applications/v020-needed-tools-001/manifest.md")
        let neededToolsManifest = try String(contentsOf: neededToolsManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(neededToolsManifest.contains("\(field):"), "Needed Tools migration manifest is missing \(field)")
        }
        try expect(neededToolsManifest.contains("VC-0100"), "Needed Tools migration manifest must link migration command id")
        try expect(neededToolsManifest.contains("ITC-0036"), "Needed Tools migration manifest must link ITC-0036")

        let workSafetyManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/work-safety/v011-approvals-permissions-001/manifest.md")
        let workSafetyManifest = try String(contentsOf: workSafetyManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(workSafetyManifest.contains("\(field):"), "work-safety migration manifest is missing \(field)")
        }
        try expect(workSafetyManifest.contains("VC-0100"), "work-safety migration manifest must link migration command id")
        try expect(workSafetyManifest.contains("ITC-0038"), "work-safety migration manifest must link ITC-0038")
        try expect(workSafetyManifest.contains("standalone Approvals"), "work-safety migration manifest must preserve standalone Approvals exclusion")

        let permissionManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/work-safety/v012-permission-policy-authority-001/manifest.md")
        let permissionManifest = try String(contentsOf: permissionManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(permissionManifest.contains("\(field):"), "permission policy migration manifest is missing \(field)")
        }
        try expect(permissionManifest.contains("VC-0100"), "permission policy migration manifest must link migration command id")
        try expect(permissionManifest.contains("ITC-0041"), "permission policy migration manifest must link ITC-0041")
        try expect(permissionManifest.contains("Default policies are installed by PermissionPolicyService"), "permission policy migration manifest must keep default policy rows out of migration seeds")

        let auditManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/work-safety/v013-audit-security-metrics-001/manifest.md")
        let auditManifest = try String(contentsOf: auditManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(auditManifest.contains("\(field):"), "audit security migration manifest is missing \(field)")
        }
        try expect(auditManifest.contains("VC-0100"), "audit security migration manifest must link migration command id")
        try expect(auditManifest.contains("ITC-0042"), "audit security migration manifest must link ITC-0042")
        try expect(auditManifest.contains("audit_log_records"), "audit security migration manifest must name audit_log_records")
        try expect(auditManifest.contains("security_metric_snapshots"), "audit security migration manifest must name security_metric_snapshots")

        let nativeFilePermissionManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/work-safety/v014-native-file-permissions-001/manifest.md")
        let nativeFilePermissionManifest = try String(contentsOf: nativeFilePermissionManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(nativeFilePermissionManifest.contains("\(field):"), "native file permission migration manifest is missing \(field)")
        }
        try expect(nativeFilePermissionManifest.contains("VC-0100"), "native file permission migration manifest must link migration command id")
        try expect(nativeFilePermissionManifest.contains("ITC-0045"), "native file permission migration manifest must link ITC-0045")
        try expect(nativeFilePermissionManifest.contains("native_file_permissions"), "native file permission migration manifest must name native_file_permissions")

        let settingsAlertManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/settings/v025-alerts-notifications-001/manifest.md")
        let settingsAlertManifest = try String(contentsOf: settingsAlertManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(settingsAlertManifest.contains("\(field):"), "settings alerts migration manifest is missing \(field)")
        }
        try expect(settingsAlertManifest.contains("VC-0100"), "settings alerts migration manifest must link migration command id")
        try expect(settingsAlertManifest.contains("ITC-0049"), "settings alerts migration manifest must link ITC-0049")
        try expect(settingsAlertManifest.contains("settings_alerts"), "settings alerts migration manifest must name settings_alerts")
        try expect(settingsAlertManifest.contains("settings_notification_preferences"), "settings alerts migration manifest must name settings_notification_preferences")

        let settingsSecurityManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/settings/v026-security-lifecycle-001/manifest.md")
        let settingsSecurityManifest = try String(contentsOf: settingsSecurityManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(settingsSecurityManifest.contains("\(field):"), "settings security migration manifest is missing \(field)")
        }
        try expect(settingsSecurityManifest.contains("VC-0100"), "settings security migration manifest must link migration command id")
        try expect(settingsSecurityManifest.contains("ITC-0050"), "settings security migration manifest must link ITC-0050")
        try expect(settingsSecurityManifest.contains("settings_decision_gate_dispositions"), "settings security migration manifest must name decision dispositions")
        try expect(settingsSecurityManifest.contains("settings_local_account_exports"), "settings security migration manifest must name local account exports")

        let insightsReportsManifestPath = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Tests/Fixtures/migrations/reports/v027-insights-reports-001/manifest.md")
        let insightsReportsManifest = try String(contentsOf: insightsReportsManifestPath, encoding: .utf8)
        for field in [
            "id",
            "layer",
            "productArea",
            "requirementIds",
            "sourceMapIds",
            "fixtureKind",
            "owner",
            "status",
            "secretsPolicy",
            "files",
            "expectedChecks",
            "determinism",
            "noFakeProductSeed",
            "noSimulatedRuntimeOutput",
            "noGeneratedWelcome",
            "privateStateExclusions",
            "redactionReview",
            "failureHandling"
        ] {
            try expect(insightsReportsManifest.contains("\(field):"), "Insights reports migration manifest is missing \(field)")
        }
        try expect(insightsReportsManifest.contains("VC-0100"), "Insights reports migration manifest must link migration command id")
        try expect(insightsReportsManifest.contains("ITC-0051"), "Insights reports migration manifest must link ITC-0051")
        try expect(insightsReportsManifest.contains("insights_report_snapshots"), "Insights reports migration manifest must name report snapshots")
        try expect(insightsReportsManifest.contains("thread_wrap_up_reports"), "Insights reports migration manifest must name wrap-up report archive columns")
    }

    private static func withTemporaryDatabase(_ body: (DatabaseService, URL, URL) throws -> Void) throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("RelayConsoleMigrationTests", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let databasePath = root.appendingPathComponent("relay-console.sqlite")
        let database = DatabaseService(databasePath: databasePath)
        try database.open()
        defer {
            database.close()
            try? FileManager.default.removeItem(at: root)
        }
        try body(database, databasePath, root)
    }

    private static func applyMigrations(_ database: DatabaseService, through version: Int) throws {
        for migration in migrations where migration.version <= version {
            try database.transaction {
                try migration.up(database)
                try database.run(
                    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
                    [.integer(Int64(migration.version)), .text(migration.name), .text(fixedTimestamp)]
                )
            }
        }
    }

    private static func seedLegacyWelcomeRows(_ database: DatabaseService) throws {
        try database.run(
            "INSERT INTO local_profiles (id, display_name, created_at, updated_at) VALUES ('prof-migration-001', 'Fixture Profile', ?, ?)",
            [.text(fixedTimestamp), .text(fixedTimestamp)]
        )
        try database.run(
            "INSERT INTO workspaces (id, profile_id, name, created_at, updated_at) VALUES ('wks-migration-001', 'prof-migration-001', 'Fixture Workspace', ?, ?)",
            [.text(fixedTimestamp), .text(fixedTimestamp)]
        )
        try database.run(
            """
            INSERT INTO threads (
              id, workspace_id, title, status, created_at, updated_at
            ) VALUES (
              'thr-migration-001', 'wks-migration-001', 'Fixture Thread', 'active', ?, ?
            )
            """,
            [.text(fixedTimestamp), .text(fixedTimestamp)]
        )

        for message in legacyMessages {
            try database.run(
                """
                INSERT INTO messages (
                  id, thread_id, sender_type, sender_name, content, metadata_json, created_at
                ) VALUES (
                  ?, 'thr-migration-001', ?, ?, ?, ?, ?
                )
                """,
                [
                    .text(message.id),
                    .text(message.senderType),
                    .text(message.senderName),
                    .text(message.content),
                    .text(message.metadata),
                    .text(fixedTimestamp)
                ]
            )
        }
    }

    private static let legacyMessages: [(id: String, senderType: String, senderName: String, content: String, metadata: String)] = [
        ("msg-agent-keep-001", "agent", "Hermes Agent", "Retained agent response.", "{}"),
        ("msg-delete-content-001", "agent", "Hermes Agent", "Hi, fake local welcome.", "{}"),
        ("msg-delete-content-002", "agent", "Hermes Agent", "Welcome to Relay Console", "{}"),
        ("msg-delete-metadata-001", "agent", "Hermes Agent", "Legacy metadata welcome.", "{\"kind\":\"agent_welcome\"}"),
        ("msg-user-keep-001", "user", "Local user", "Retained user message.", "{}")
    ]

    private static let productSeedTables = [
        "local_profiles",
        "workspaces",
        "harnesses",
        "agents",
        "runtime_bindings",
        "threads",
        "messages",
        "runtime_sessions",
        "runtime_dispatches",
        "event_log",
        "secret_references",
        "bridge_plugin_installations",
        "thread_sessions",
        "thread_participants",
        "thread_read_states",
        "thread_wrap_up_reports",
        "chat_composer_drafts",
        "chat_attachments",
        "chat_document_references",
        "companies",
        "departments",
        "teams",
        "agent_manager_relationships",
        "agent_provisioning_jobs",
        "agent_preferences",
        "agent_tasks",
        "agent_task_runs",
        "agent_team_memory",
        "agent_team_handovers",
        "runtime_dashboard_snapshots",
        "runtime_dashboard_rows",
        "runtime_action_capabilities",
        "runtime_action_runs",
        "runtime_structured_jobs",
        "runtime_missing_tool_events",
        "runtime_recovery_records",
        "applications_navigation_records",
        "marketplace_catalog_apps",
        "applications_catalog_snapshots",
        "applications_provider_connections",
        "applications_provider_authorization_flows",
        "applications_provider_connection_snapshots",
        "applications_marketplace_installs",
        "applications_marketplace_install_snapshots",
        "marketplace_provider_action_definitions",
        "marketplace_action_permission_maps",
        "marketplace_provider_action_approvals",
        "marketplace_provider_action_executions",
        "applications_tool_requests",
        "applications_needed_tools_snapshots",
        "work_safety_tasks",
        "work_safety_task_runs",
        "work_safety_task_events",
        "work_safety_approvals",
        "work_safety_approval_steps",
        "work_safety_approval_notes",
        "permission_policies",
        "audit_log_records",
        "security_metric_snapshots",
        "native_file_permissions",
        "settings_alerts",
        "settings_notification_preferences",
        "settings_decision_gate_dispositions",
        "settings_local_account_exports",
        "insights_report_snapshots"
    ]

    private static func schemaNames(database: DatabaseService, type: String) throws -> Set<String> {
        let rows = try database.all(
            "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%'",
            [.text(type)]
        )
        return try Set(rows.map { try text($0, "name") })
    }

    private static func columns(database: DatabaseService, table: String) throws -> Set<String> {
        try Set(database.all("PRAGMA table_info(\(table))").map { try text($0, "name") })
    }

    private static func scalarCount(_ database: DatabaseService, _ sql: String) throws -> Int64 {
        let row = try unwrap(database.get(sql), "missing count row")
        return try integer(row, "count")
    }

    private static func text(_ row: [String: SQLiteValue], _ column: String) throws -> String {
        guard case .text(let value)? = row[column] else {
            throw MigrationTestFailure("missing text column \(column)")
        }
        return value
    }

    private static func optionalText(_ row: [String: SQLiteValue], _ column: String) throws -> String? {
        switch row[column] {
        case .text(let value):
            return value
        case .null:
            return nil
        default:
            throw MigrationTestFailure("missing optional text column \(column)")
        }
    }

    private static func integer(_ row: [String: SQLiteValue], _ column: String) throws -> Int64 {
        guard case .integer(let value)? = row[column] else {
            throw MigrationTestFailure("missing integer column \(column)")
        }
        return value
    }

    private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        guard try condition() else {
            throw MigrationTestFailure(message)
        }
    }

    private static func unwrap<T>(_ value: T?, _ message: String) throws -> T {
        guard let value else {
            throw MigrationTestFailure(message)
        }
        return value
    }
}

private struct MigrationTestFailure: Error, CustomStringConvertible {
    var description: String
    init(_ description: String) {
        self.description = description
    }
}
