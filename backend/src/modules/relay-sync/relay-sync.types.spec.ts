import {
  assertMarketplaceExecutionAuthorityPayload,
  assertSafeSyncPayload,
  MARKETPLACE_EXECUTION_AUTHORITY_VERSION,
  RELAY_SYNC_OBJECT_TYPES,
} from "./relay-sync.types";

describe("Relay sync contract security", () => {
  it("declares every PRD 1 user-visible synchronization domain", () => {
    expect(RELAY_SYNC_OBJECT_TYPES).toEqual(
      expect.arrayContaining([
        "profile",
        "workspace",
        "agent",
        "agent_preference",
        "agent_document",
        "thread",
        "thread_session",
        "thread_participant",
        "message",
        "read_state",
        "thread_archive",
        "thread_wrap_up",
        "task",
        "run",
        "runtime_event",
        "artifact",
        "approval",
        "application_connection",
        "application_install",
        "application_assignment",
        "application_policy",
        "attachment",
        "dispatch_status",
      ]),
    );
  });

  it.each([
    { refresh_token: "secret" },
    { nested: { keychain_account: "value" } },
    { runtime_home: "/private/runtime" },
    { workspace_root: "/Users/person/code" },
    { log_content: "sensitive output" },
    { database_path: "/private/native.sqlite" },
    { accessToken: "bearer-value" },
    { nested: { workspaceRoot: "/private/workspace" } },
    { runtimeHome: "/private/runtime" },
  ])(
    "rejects forbidden payload fields without logging their values",
    (payload) => {
      expect(() => assertSafeSyncPayload(payload)).toThrow(
        /SYNC_PAYLOAD_FORBIDDEN_FIELD/,
      );
      try {
        assertSafeSyncPayload(payload);
      } catch (error) {
        expect(String((error as Error).message)).not.toContain("secret");
        expect(String((error as Error).message)).not.toContain("/Users");
        expect(String((error as Error).message)).not.toContain(
          "sensitive output",
        );
      }
    },
  );

  it("allows bounded safe metadata and explicit execution authority", () => {
    expect(() =>
      assertSafeSyncPayload({
        id: "agent-1",
        name: "Hermes",
        runtimeType: "hermes",
        capability: { supportsCancellation: true },
        executionAuthority: "swift",
        secretMaterialSynchronized: false,
        attachment: { contentType: "image/png", byteSize: 1024, sha256: "abc" },
      }),
    ).not.toThrow();
  });

  it.each([true, "false", null, { value: false }])(
    "rejects a non-false secret-material sync marker: %p",
    (secretMaterialSynchronized) => {
      expect(() =>
        assertSafeSyncPayload({ secretMaterialSynchronized }),
      ).toThrow(/SYNC_PAYLOAD_FORBIDDEN_FIELD/);
    },
  );

  it.each([
    "application_connection",
    "application_install",
    "application_policy",
  ] as const)(
    "requires a versioned redacted execution authority for %s",
    (objectType) => {
      expect(() =>
        assertMarketplaceExecutionAuthorityPayload(objectType, "upsert", {
          appSlug: "gmail",
          executionAuthority: "swift",
          executionAuthorityVersion: MARKETPLACE_EXECUTION_AUTHORITY_VERSION,
          executionAvailability: "device_runtime_required",
          secretMaterialSynchronized: false,
        }),
      ).not.toThrow();
      expect(() =>
        assertMarketplaceExecutionAuthorityPayload(objectType, "upsert", {
          appSlug: "gmail",
          executionAuthority: "swift",
          executionAuthorityVersion: "legacy",
          executionAvailability: "device_runtime_required",
          secretMaterialSynchronized: false,
        }),
      ).toThrow("MARKETPLACE_EXECUTION_AUTHORITY_VERSION_INVALID");
      expect(() =>
        assertMarketplaceExecutionAuthorityPayload(objectType, "upsert", {
          appSlug: "gmail",
          executionAuthority: "unknown",
          executionAuthorityVersion: MARKETPLACE_EXECUTION_AUTHORITY_VERSION,
          executionAvailability: "device_runtime_required",
          secretMaterialSynchronized: false,
        }),
      ).toThrow("MARKETPLACE_EXECUTION_AUTHORITY_INVALID");
    },
  );

  it("rejects synchronized secret material and false device availability", () => {
    expect(() =>
      assertMarketplaceExecutionAuthorityPayload(
        "application_connection",
        "upsert",
        {
          appSlug: "gmail",
          executionAuthority: "swift",
          executionAuthorityVersion: MARKETPLACE_EXECUTION_AUTHORITY_VERSION,
          executionAvailability: "available",
          secretMaterialSynchronized: false,
        },
      ),
    ).toThrow("MARKETPLACE_SWIFT_AUTHORITY_AVAILABILITY_INVALID");
    expect(() =>
      assertMarketplaceExecutionAuthorityPayload(
        "application_connection",
        "upsert",
        {
          appSlug: "gmail",
          executionAuthority: "railway",
          executionAuthorityVersion: MARKETPLACE_EXECUTION_AUTHORITY_VERSION,
          executionAvailability: "railway_broker_required",
          secretMaterialSynchronized: true,
        },
      ),
    ).toThrow("MARKETPLACE_SYNC_SECRET_BOUNDARY_INVALID");
    expect(() =>
      assertMarketplaceExecutionAuthorityPayload(
        "application_connection",
        "upsert",
        {
          appSlug: "",
          executionAuthority: "railway",
          executionAuthorityVersion: MARKETPLACE_EXECUTION_AUTHORITY_VERSION,
          executionAvailability: "railway_broker_required",
          secretMaterialSynchronized: false,
        },
      ),
    ).toThrow("MARKETPLACE_EXECUTION_AUTHORITY_APP_SLUG_INVALID");
    expect(() =>
      assertMarketplaceExecutionAuthorityPayload(
        "application_connection",
        "upsert",
        {
          appSlug: "gmail",
          executionAuthority: "railway",
          executionAuthorityVersion: MARKETPLACE_EXECUTION_AUTHORITY_VERSION,
          executionAvailability: "device_runtime_required",
          secretMaterialSynchronized: false,
        },
      ),
    ).toThrow("MARKETPLACE_RAILWAY_AUTHORITY_AVAILABILITY_INVALID");
  });

  it.each([
    { secret_material_synchronized: false },
    { secretMaterialSynchronized: false },
    { nested: { secret_material_synchronized: false } },
  ])("allows only the explicit false secret-material synchronization marker", (payload) => {
    expect(() => assertSafeSyncPayload(payload)).not.toThrow();
  });

  it.each([
    { secret_material_synchronized: true },
    { secret_material_synchronized: "false" },
    { secret_material_synchronized: null },
    { secret_material_synchronized: {} },
  ])("rejects any non-false secret-material synchronization marker", (payload) => {
    expect(() => assertSafeSyncPayload(payload)).toThrow(/SYNC_PAYLOAD_FORBIDDEN_FIELD/);
  });
});
