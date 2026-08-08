import { ForbiddenException } from "@nestjs/common";
import { createHmac } from "crypto";
import { Readable } from "stream";
import { RelaySyncService } from "./relay-sync.service";

const ATTACHMENT_SECRET = "attachment-signing-secret";
const DEFAULT_ATTACHMENT_CLAIMS = {
  v: 1,
  rowId: "10000000-0000-4000-8000-000000000001",
  attachmentId: "att_20000000-0000-4000-8000-000000000001",
  workspaceId: "30000000-0000-4000-8000-000000000001",
  installationId: "40000000-0000-4000-8000-000000000001",
  contentType: "text/plain",
  byteSize: 5,
  sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  exp: Date.now() + 5 * 60_000,
  nonce: "50000000-0000-4000-8000-000000000001",
};

function attachmentToken(
  overrides: Partial<typeof DEFAULT_ATTACHMENT_CLAIMS> = {},
) {
  const encoded = Buffer.from(
    JSON.stringify({ ...DEFAULT_ATTACHMENT_CLAIMS, ...overrides }),
  ).toString("base64url");
  const signature = createHmac("sha256", ATTACHMENT_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function repository() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((input) => ({ ...input })),
    save: jest.fn(async (input) => input),
    update: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
  } as any;
}

function buildService(
  configOverrides: Record<string, string | undefined> = {},
) {
  const deployments = repository();
  const installations = repository();
  const links = repository();
  const imports = repository();
  const changes = repository();
  const attachments = repository();
  const ownerLeases = repository();
  const membership = {
    ensureWorkspaceAccess: jest.fn().mockResolvedValue(undefined),
    ensureWorkspaceAdminAccess: jest.fn().mockResolvedValue(undefined),
  } as any;
  const transactionManager = {
    query: jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          storageLimit: "1073741824",
          attachmentLimit: "52428800",
          usedBytes: "0",
        },
      ]),
    getRepository: jest.fn(() => attachments),
  } as any;
  const dataSource = {
    getRepository: jest.fn(() => attachments),
    transaction: jest.fn(async (callback) => callback(transactionManager)),
    query: jest.fn(),
  } as any;
  const config = {
    get: jest.fn(
      (key: string) =>
        (
          ({
            CLAWCHAT_DEPLOYMENT_ID: "deployment-test",
            ATTACHMENT_SIGNING_SECRET: "attachment-signing-secret",
            ...configOverrides,
          }) as Record<string, string>
        )[key],
    ),
  } as any;
  const audit = { record: jest.fn() } as any;
  const events = { emitToWorkspace: jest.fn() } as any;
  const messageService = { routeSynchronizedUserMessage: jest.fn() } as any;
  const service = new RelaySyncService(
    dataSource,
    config,
    membership,
    audit,
    events,
    messageService,
    deployments,
    installations,
    links,
    imports,
    changes,
    attachments,
    ownerLeases,
  );

  return {
    service,
    dataSource,
    membership,
    deployments,
    installations,
    links,
    imports,
    changes,
    attachments,
    ownerLeases,
    transactionManager,
  };
}

describe("RelaySyncService tenant isolation", () => {
  it("rejects obsolete or malformed client versions before registering an installation", async () => {
    const { service, deployments, installations } = buildService();
    deployments.findOne.mockResolvedValue({
      id: "deployment-row",
      deploymentKey: "deployment-test",
    });

    for (const clientVersion of ["0.0.9", "development"]) {
      await expect(
        service.registerInstallation("user-a", {
          deploymentKey: "deployment-test",
          installationPublicId: `installation-${clientVersion}`,
          clientKind: "relay_console_swift",
          clientVersion,
        }),
      ).rejects.toThrow(
        clientVersion === "development"
          ? "CLIENT_VERSION_INVALID"
          : "CLIENT_UPGRADE_REQUIRED",
      );
    }

    expect(installations.findOne).not.toHaveBeenCalled();
    expect(installations.save).not.toHaveBeenCalled();
  });

  it("scopes a Mac installation identity to the authenticated account", async () => {
    const { service, deployments, installations } = buildService();
    deployments.findOne.mockResolvedValue({
      id: "deployment-row",
      deploymentKey: "deployment-test",
    });
    installations.findOne.mockResolvedValue(null);
    installations.create.mockImplementation((value) => value);
    installations.save.mockImplementation(async (value) => ({
      id: "installation-user-b",
      ...value,
    }));

    await service.registerInstallation("user-b", {
      deploymentKey: "deployment-test",
      installationPublicId: "shared-mac-installation",
      clientKind: "relay_console_swift",
      clientVersion: "2026.7.7",
    });

    expect(installations.findOne).toHaveBeenCalledWith({
      where: {
        deploymentId: "deployment-row",
        userId: "user-b",
        installationPublicId: "shared-mac-installation",
      },
    });
    expect(installations.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-b",
        installationPublicId: "shared-mac-installation",
      }),
    );
  });

  it("never falls back to a JWT secret for attachment upload signing", () => {
    const { service } = buildService({
      ATTACHMENT_SIGNING_SECRET: undefined,
      JWT_SECRET: "jwt-access-secret-that-must-not-sign-attachments",
    });

    expect(() =>
      (service as any).attachmentStorage.issueUploadToken({}),
    ).toThrow("ATTACHMENT_SIGNING_SECRET_MISSING");
  });

  it("stops a foreign-workspace change-feed read before querying sync data", async () => {
    const { service, membership, changes, dataSource } = buildService();
    membership.ensureWorkspaceAccess.mockRejectedValueOnce(
      new ForbiddenException("WORKSPACE_ACCESS_DENIED"),
    );

    await expect(service.changeFeed("user-a", "workspace-b")).rejects.toThrow(
      "WORKSPACE_ACCESS_DENIED",
    );

    expect(changes.find).not.toHaveBeenCalled();
    expect(dataSource.getRepository).not.toHaveBeenCalled();
  });

  it("finishes a canonical snapshot at its captured workspace watermark", async () => {
    const { service, changes } = buildService();
    changes.findOne.mockResolvedValue({ sequence: "42" });
    jest.spyOn(service as any, "nativeWorkspaceSnapshot").mockResolvedValue([
      {
        sequence: "0",
        objectType: "message",
        objectId: "message-1",
        payload: { content: "durable" },
      },
    ]);

    await expect(
      service.changeFeed("user-a", "workspace-a", "0", 200),
    ).resolves.toEqual({
      changes: [
        expect.objectContaining({
          objectType: "message",
          objectId: "message-1",
        }),
      ],
      cursor: "42",
      hasMore: false,
    });
  });

  it("forces a canonical rebuild when a client cursor predates the retained feed", async () => {
    const { service, changes } = buildService();
    changes.findOne
      .mockResolvedValueOnce({ sequence: "100" })
      .mockResolvedValueOnce({ sequence: "125" });
    jest.spyOn(service as any, "nativeWorkspaceSnapshot").mockResolvedValue([]);

    await expect(
      service.changeFeed("user-a", "workspace-a", "50", 200),
    ).resolves.toEqual({
      changes: [],
      cursor: "125",
      hasMore: false,
    });
  });

  it("rejects an import whose persisted workspace or installation no longer matches its link", async () => {
    const { service, imports, links } = buildService();
    imports.findOne.mockResolvedValue({
      id: "import-a",
      syncLinkId: "link-a",
      workspaceId: "workspace-a",
      installationId: "installation-a",
    });
    links.findOne.mockResolvedValue({
      id: "link-a",
      workspaceId: "workspace-b",
      installationId: "installation-a",
      userId: "user-a",
    });

    await expect(service.importStatus("user-a", "import-a")).rejects.toThrow(
      "IMPORT_LINK_SCOPE_MISMATCH",
    );
  });

  it("requires attachment negotiation to use the authenticated account's active installation and link", async () => {
    const { service, deployments, installations, links } = buildService();
    deployments.findOne.mockResolvedValue({
      id: "deployment-row",
      deploymentKey: "deployment-test",
    });
    installations.findOne.mockResolvedValue({
      id: "installation-a",
      deploymentId: "deployment-row",
      userId: "user-b",
      revokedAt: null,
    });

    await expect(
      service.negotiateAttachment("user-a", {
        workspaceId: "workspace-a",
        installationId: "installation-a",
        sourceAttachmentId: "local-attachment-a",
        fileName: "notes.txt",
        contentType: "text/plain",
        byteSize: 5,
        sha256: "0".repeat(64),
        provenance: {},
      }),
    ).rejects.toThrow("INSTALLATION_ACCOUNT_MISMATCH");

    expect(links.findOne).not.toHaveBeenCalled();
  });

  it("negotiates a quota-reserved binary upload whose signed claims bind the full scope", async () => {
    const {
      service,
      deployments,
      installations,
      links,
      attachments,
      transactionManager,
    } = buildService();
    deployments.findOne.mockResolvedValue({
      id: "deployment-row",
      deploymentKey: "deployment-test",
    });
    installations.findOne.mockResolvedValue({
      id: DEFAULT_ATTACHMENT_CLAIMS.installationId,
      deploymentId: "deployment-row",
      userId: "user-a",
      revokedAt: null,
    });
    links.findOne.mockResolvedValue({
      workspaceId: DEFAULT_ATTACHMENT_CLAIMS.workspaceId,
      installationId: DEFAULT_ATTACHMENT_CLAIMS.installationId,
      userId: "user-a",
      status: "active",
      attachmentPolicy: "all_supported",
    });

    const result = await service.negotiateAttachment("user-a", {
      workspaceId: DEFAULT_ATTACHMENT_CLAIMS.workspaceId,
      installationId: DEFAULT_ATTACHMENT_CLAIMS.installationId,
      sourceAttachmentId: "local-attachment-a",
      fileName: "notes.txt",
      contentType: "text/plain",
      byteSize: 5,
      sha256: DEFAULT_ATTACHMENT_CLAIMS.sha256.toUpperCase(),
      provenance: {},
    });
    const [encodedClaims, signature] = result.upload.token.split(".");
    const claims = JSON.parse(
      Buffer.from(encodedClaims, "base64url").toString("utf8"),
    );

    expect(
      createHmac("sha256", ATTACHMENT_SECRET)
        .update(encodedClaims)
        .digest("base64url"),
    ).toBe(signature);
    expect(claims).toEqual(
      expect.objectContaining({
        v: 1,
        rowId: result.attachment.id,
        attachmentId: result.attachment.attachmentId,
        workspaceId: DEFAULT_ATTACHMENT_CLAIMS.workspaceId,
        installationId: DEFAULT_ATTACHMENT_CLAIMS.installationId,
        contentType: "text/plain",
        byteSize: 5,
        sha256: DEFAULT_ATTACHMENT_CLAIMS.sha256,
      }),
    );
    expect(result.upload).toEqual(
      expect.objectContaining({
        method: "POST",
        requiredContentLength: 5,
        authorization: "Bearer",
        contract: "clawchat.relay.attachment-binary.v1",
      }),
    );
    expect(transactionManager.query.mock.calls[0][0]).toContain(
      "pg_advisory_xact_lock",
    );
    expect(
      transactionManager.query.mock.calls.some(([sql]: [string]) =>
        sql.includes('"storageLimit"'),
      ),
    ).toBe(true);
    expect(attachments.save).toHaveBeenCalledTimes(1);
  });

  it("fails closed before token issuance when the atomic workspace storage reservation is exhausted", async () => {
    const {
      service,
      deployments,
      installations,
      links,
      attachments,
      transactionManager,
    } = buildService();
    deployments.findOne.mockResolvedValue({
      id: "deployment-row",
      deploymentKey: "deployment-test",
    });
    installations.findOne.mockResolvedValue({
      id: DEFAULT_ATTACHMENT_CLAIMS.installationId,
      deploymentId: "deployment-row",
      userId: "user-a",
      revokedAt: null,
    });
    links.findOne.mockResolvedValue({
      workspaceId: DEFAULT_ATTACHMENT_CLAIMS.workspaceId,
      installationId: DEFAULT_ATTACHMENT_CLAIMS.installationId,
      userId: "user-a",
      status: "active",
      attachmentPolicy: "all_supported",
    });
    transactionManager.query
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          storageLimit: "100",
          attachmentLimit: "50",
          usedBytes: "98",
        },
      ]);

    await expect(
      service.negotiateAttachment("user-a", {
        workspaceId: DEFAULT_ATTACHMENT_CLAIMS.workspaceId,
        installationId: DEFAULT_ATTACHMENT_CLAIMS.installationId,
        sourceAttachmentId: "local-attachment-a",
        fileName: "notes.txt",
        contentType: "text/plain",
        byteSize: 5,
        sha256: DEFAULT_ATTACHMENT_CLAIMS.sha256,
        provenance: {},
      }),
    ).rejects.toThrow("ATTACHMENT_STORAGE_QUOTA_EXCEEDED");

    expect(attachments.save).not.toHaveBeenCalled();
  });

  it("does not accept a signed upload token issued for a different attachment row", async () => {
    const { service, dataSource } = buildService();
    const rowA = "10000000-0000-4000-8000-000000000001";
    const rowB = "10000000-0000-4000-8000-000000000002";
    const token = attachmentToken({
      rowId: rowA,
      byteSize: 5,
      sha256:
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    });

    await expect(
      service.uploadAttachmentContent(
        rowB,
        token,
        Readable.from(Buffer.from("hello")),
        { contentLength: 5, contentType: "text/plain" },
      ),
    ).rejects.toThrow("ATTACHMENT_UPLOAD_TOKEN_INVALID");

    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it("grants exactly one concurrent consumer and binds every signed field in the atomic claim", async () => {
    const { service, dataSource } = buildService();
    const rowId = DEFAULT_ATTACHMENT_CLAIMS.rowId;
    const token = attachmentToken();
    let owner: string | undefined;
    let claimSql = "";
    let chunkSql = "";
    let claimParameters: unknown[] = [];
    dataSource.query.mockImplementation(
      async (sql: string, parameters: unknown[]) => {
        if (sql.includes('"uploadAttemptCount" = "uploadAttemptCount" + 1')) {
          claimSql = sql;
          claimParameters = parameters;
          if (owner) return [];
          owner = parameters[2] as string;
          return [
            {
              id: rowId,
              attachmentId: DEFAULT_ATTACHMENT_CLAIMS.attachmentId,
              byteSize: "5",
              sha256: DEFAULT_ATTACHMENT_CLAIMS.sha256,
            },
          ];
        }
        if (sql.includes('INSERT INTO "relay_sync_attachment_chunks"')) {
          chunkSql = sql;
          return (parameters[2] as number[]).map((chunkIndex) => ({
            chunkIndex,
          }));
        }
        if (sql.includes("status = 'available'")) {
          return [
            {
              attachmentId: DEFAULT_ATTACHMENT_CLAIMS.attachmentId,
              status: "available",
              byteSize: "5",
            },
          ];
        }
        return [];
      },
    );

    const results = await Promise.allSettled([
      service.uploadAttachmentContent(
        rowId,
        token,
        Readable.from(Buffer.from("hello")),
        { contentLength: 5, contentType: "text/plain" },
      ),
      service.uploadAttachmentContent(
        rowId,
        token,
        Readable.from(Buffer.from("hello")),
        { contentLength: 5, contentType: "text/plain" },
      ),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(claimSql).toContain('"uploadTokenHash" = $2');
    expect(claimSql).toContain('"attachmentId" = $4');
    expect(claimSql).toContain('"workspaceId" = $5::uuid');
    expect(claimSql).toContain('"sourceInstallationId" = $6');
    expect(claimSql).toContain('"contentType" = $7');
    expect(claimSql).toContain('"byteSize" = $8::bigint');
    expect(claimSql).toContain("lower(sha256) = $9");
    expect(claimSql).toContain('"uploadClaimExpiresAt" <= now()');
    expect(chunkSql).toContain("WITH renewed_claim AS");
    expect(chunkSql).toContain('"uploadClaimExpiresAt" = LEAST');
    expect(chunkSql).toContain("WHERE EXISTS (SELECT 1 FROM renewed_claim)");
    expect(claimParameters.slice(3, 10)).toEqual([
      DEFAULT_ATTACHMENT_CLAIMS.attachmentId,
      DEFAULT_ATTACHMENT_CLAIMS.workspaceId,
      DEFAULT_ATTACHMENT_CLAIMS.installationId,
      DEFAULT_ATTACHMENT_CLAIMS.contentType,
      DEFAULT_ATTACHMENT_CLAIMS.byteSize,
      DEFAULT_ATTACHMENT_CLAIMS.sha256,
      DEFAULT_ATTACHMENT_CLAIMS.exp,
    ]);
  });

  it("rejects framing mismatches before consuming the stream or touching storage", async () => {
    const { service, dataSource } = buildService();
    let consumed = false;
    const body = Readable.from(
      (async function* () {
        consumed = true;
        yield Buffer.from("hello");
      })(),
    );

    await expect(
      service.uploadAttachmentContent(
        DEFAULT_ATTACHMENT_CLAIMS.rowId,
        attachmentToken(),
        body,
        { contentLength: 5, contentType: "application/json" },
      ),
    ).rejects.toThrow("ATTACHMENT_CONTENT_TYPE_MISMATCH");

    expect(consumed).toBe(false);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it("never publishes a digest mismatch and releases only its own upload claim", async () => {
    const { service, dataSource } = buildService();
    const token = attachmentToken({ sha256: "0".repeat(64) });
    let uploadVersion = "";
    const statements: string[] = [];
    dataSource.query.mockImplementation(
      async (sql: string, parameters: unknown[]) => {
        statements.push(sql);
        if (sql.includes('"uploadAttemptCount" = "uploadAttemptCount" + 1')) {
          uploadVersion = parameters[2] as string;
          return [{ id: DEFAULT_ATTACHMENT_CLAIMS.rowId }];
        }
        if (sql.includes('INSERT INTO "relay_sync_attachment_chunks"')) {
          return (parameters[2] as number[]).map((chunkIndex) => ({
            chunkIndex,
          }));
        }
        return [];
      },
    );

    await expect(
      service.uploadAttachmentContent(
        DEFAULT_ATTACHMENT_CLAIMS.rowId,
        token,
        Readable.from(Buffer.from("hello")),
        { contentLength: 5, contentType: "text/plain" },
      ),
    ).rejects.toThrow("ATTACHMENT_HASH_MISMATCH");

    expect(uploadVersion).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(statements.some((sql) => sql.includes("status = 'available'"))).toBe(
      false,
    );
    expect(
      statements.some(
        (sql) =>
          sql.includes("status = 'negotiated'") &&
          sql.includes('"uploadClaimToken" = $2::uuid'),
      ),
    ).toBe(true);
  });

  it("streams only the published storage version in contiguous bounded chunks", async () => {
    const { service, attachments, dataSource } = buildService();
    attachments.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: DEFAULT_ATTACHMENT_CLAIMS.rowId,
        attachmentId: DEFAULT_ATTACHMENT_CLAIMS.attachmentId,
        workspaceId: DEFAULT_ATTACHMENT_CLAIMS.workspaceId,
        fileName: "hello.txt",
        contentType: "text/plain",
        byteSize: "5",
        sha256: DEFAULT_ATTACHMENT_CLAIMS.sha256,
        provenance: {},
        status: "available",
        deletedAt: null,
        storageVersion: DEFAULT_ATTACHMENT_CLAIMS.nonce,
        storageKey: `postgres-chunks:${DEFAULT_ATTACHMENT_CLAIMS.rowId}`,
      }),
    });
    let page = 0;
    dataSource.query.mockImplementation(async (sql: string) => {
      expect(sql).toContain('"uploadVersion" = $2::uuid');
      if (page++ === 0) {
        return [
          { chunkIndex: 0, byteLength: 2, content: Buffer.from("he") },
          { chunkIndex: 1, byteLength: 3, content: Buffer.from("llo") },
        ];
      }
      return [];
    });

    const download = await service.downloadAttachment(
      "user-a",
      DEFAULT_ATTACHMENT_CLAIMS.workspaceId,
      DEFAULT_ATTACHMENT_CLAIMS.attachmentId,
    );
    const content: Buffer[] = [];
    for await (const chunk of download.chunks) content.push(chunk);

    expect(Buffer.concat(content).toString()).toBe("hello");
    expect(download.metadata).toEqual(
      expect.objectContaining({
        contentType: "text/plain",
        byteSize: 5,
        sha256: DEFAULT_ATTACHMENT_CLAIMS.sha256,
      }),
    );
  });

  it("rejects execution ownership when the agent belongs to another workspace", async () => {
    const { service, dataSource, ownerLeases } = buildService();
    const agentRepository = repository();
    const bridgeRepository = repository();
    agentRepository.findOne.mockResolvedValue({
      id: "agent-b",
      workspaceId: "workspace-b",
    });
    bridgeRepository.findOne.mockResolvedValue({
      id: "device-a",
      workspaceId: "workspace-a",
      revokedAt: null,
    });
    dataSource.getRepository
      .mockReturnValueOnce(agentRepository)
      .mockReturnValueOnce(bridgeRepository);

    await expect(
      service.acquireOwnerLease("user-a", {
        workspaceId: "workspace-a",
        agentId: "agent-b",
        bridgeDeviceId: "device-a",
        ownerKind: "bridge",
        ttlSeconds: 60,
      }),
    ).rejects.toThrow("AGENT_WORKSPACE_MISMATCH");

    expect(ownerLeases.save).not.toHaveBeenCalled();
  });

  it("rejects a synchronized Swift Marketplace connection", async () => {
    const { service } = buildService();
    const marketplaceConnections = repository();
    marketplaceConnections.save.mockImplementation(async (value: any) => ({
      id: "cloud-visible-connection",
      ...value,
    }));
    const manager = {
      getRepository: jest.fn(() => marketplaceConnections),
      delete: jest.fn(),
    } as any;

    await expect((service as any).mirrorCanonicalDomain(manager, {
      workspaceId: "workspace-a",
      installationId: "installation-a",
      userId: "user-a",
      operation: "upsert",
      existingCanonicalId: null,
      record: {
        objectType: "application_connection",
        objectId: "local-connection-a",
        payload: {
          appSlug: "google-docs",
          providerName: "Google Docs",
          selectedCapabilities: ["document_read"],
          executionAuthority: "swift",
          executionAuthorityVersion: "marketplace-execution-authority.v1",
          executionAvailability: "device_runtime_required",
          secretMaterialSynchronized: false,
        },
      },
    })).rejects.toThrow("MARKETPLACE_EXECUTION_AUTHORITY_RAILWAY_REQUIRED");
    expect(marketplaceConnections.save).not.toHaveBeenCalled();
  });

  it("materializes a Swift Hermes agent with its runtime identity and binding", async () => {
    const { service } = buildService();
    const agents = repository();
    const bindings = repository();
    agents.findOne.mockResolvedValue(null);
    agents.save.mockImplementation(async (value: any) => ({
      id: "canonical-agent",
      ...value,
    }));
    bindings.findOne.mockResolvedValue(null);
    const manager = {
      getRepository: jest
        .fn()
        .mockReturnValueOnce(agents)
        .mockReturnValueOnce(bindings),
      delete: jest.fn(),
    } as any;

    const canonicalId = await (service as any).mirrorCanonicalDomain(manager, {
      workspaceId: "workspace-a",
      installationId: "installation-a",
      userId: "user-a",
      operation: "upsert",
      existingCanonicalId: null,
      record: {
        objectType: "agent",
        objectId: "local-agent",
        payload: {
          name: "John Doe",
          runtimeType: "hermes",
          runtimeExternalAgentId: "john_doe",
          runtimeRoutingMode: "explicit_only",
          groupType: "business",
          groupLabel: "Marketing",
        },
      },
    });

    expect(canonicalId).toBe("canonical-agent");
    expect(agents.save).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "hermes",
        externalId: "john_doe",
        groupType: "business",
        groupLabel: "Marketing",
      }),
    );
    expect(bindings.save).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "canonical-agent",
        runtimeType: "hermes",
        adapterKind: "hermes_bridge",
        routingMode: "explicit_only",
        configMetadata: expect.objectContaining({
          runtimeExternalAgentId: "john_doe",
        }),
      }),
    );
  });

  it("collapses a first desktop document scan onto an existing cloud path", async () => {
    const { service } = buildService();
    const agentMapping = repository();
    agentMapping.findOne.mockResolvedValue({
      canonicalObjectId: "canonical-agent",
    });
    const managedDocuments = repository();
    managedDocuments.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: "agd_cloud",
        workspaceId: "workspace-a",
        agentId: "canonical-agent",
        runtimeType: "hermes",
        relativePath: "SOUL.md",
        folder: "",
        filename: "SOUL.md",
        desiredVersion: "1",
        desiredContent: "old",
        desiredHash: "old-hash",
        byteSize: "3",
        legacyObjectId: "agd_cloud",
        tombstonedAt: null,
      }),
    });
    managedDocuments.find.mockResolvedValue([]);
    const manager = {
      query: jest.fn(),
      getRepository: jest
        .fn()
        .mockReturnValueOnce(agentMapping)
        .mockReturnValueOnce(managedDocuments),
      create: jest.fn((_entity, value) => ({ ...value })),
      save: jest.fn(async (value) => ({ sequence: "9", ...value })),
    } as any;

    const result = await (service as any).applyRecord(manager, {
      workspaceId: "workspace-a",
      installationId: "installation-a",
      userId: "user-a",
      record: {
        objectType: "agent_document",
        objectId: "agd_local",
        payload: {
          agentId: "local-agent",
          runtimeType: "hermes",
          root: "agent",
          folder: "",
          filename: "SOUL.md",
          documentKind: "instruction",
          content: "new",
        },
      },
    });

    expect(result.canonicalObjectId).toBe("agd_cloud");
    expect(managedDocuments.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "agd_cloud",
        legacyObjectId: "agd_cloud",
        agentId: "canonical-agent",
        desiredContent: "new",
        desiredVersion: "2",
      }),
    );
  });
});
