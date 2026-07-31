import { AgentCloudDocumentService } from "./agent-cloud-document.service";

function repo() {
  const queryBuilder = {
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
  } as any;
  for (const method of ["addSelect", "where", "andWhere", "orderBy"]) {
    queryBuilder[method].mockReturnValue(queryBuilder);
  }
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((value) => ({ ...value })),
    save: jest.fn(async (value) => value),
    createQueryBuilder: jest.fn(() => queryBuilder),
    queryBuilder,
  } as any;
}

describe("AgentCloudDocumentService", () => {
  it("resolves a runtime external id without querying the UUID primary key", async () => {
    const agents = repo();
    const objects = repo();
    const changes = repo();
    agents.findOne.mockResolvedValueOnce({
      id: "bc948e27-db21-4fd7-9b20-3ebefa89b4ef",
      workspaceId: "workspace-a",
      externalId: "john_doe",
      source: "hermes",
    });
    const service = new AgentCloudDocumentService(
      agents,
      objects,
      changes,
      repo(),
    );

    await service.list("workspace-a", "john_doe", "");

    expect(agents.findOne).toHaveBeenCalledTimes(1);
    expect(agents.findOne).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-a", externalId: "john_doe" },
    });
  });

  it("resolves imported Swift documents through their canonical agent mapping", async () => {
    const agents = repo();
    const objects = repo();
    const changes = repo();
    agents.findOne.mockResolvedValueOnce({
      id: "canonical-agent",
      workspaceId: "workspace-a",
      externalId: "john_doe",
      source: "hermes",
    });
    objects.find.mockResolvedValueOnce([
      {
        objectId: "local-document",
        payload: {
          agentId: "local-agent",
          runtimeType: "hermes",
          root: "agent",
          folder: "",
          filename: "SOUL.md",
          documentKind: "instruction",
          content: "# John Doe",
          contentHash: "hash",
          updatedAt: "2026-07-21T10:00:00.000Z",
        },
      },
    ]);
    objects.findOne.mockResolvedValueOnce({
      objectId: "local-agent",
      sourceObjectId: "local-agent",
      canonicalObjectId: "canonical-agent",
    });
    const service = new AgentCloudDocumentService(
      agents,
      objects,
      changes,
      repo(),
    );

    const result = await service.list("workspace-a", "canonical-agent", "");

    expect(result.files).toEqual([
      expect.objectContaining({ filename: "SOUL.md", size: 10 }),
    ]);
  });

  it("persists edits and emits a desktop change-feed event", async () => {
    const agents = repo();
    const objects = repo();
    const changes = repo();
    const managedDocuments = repo();
    agents.findOne.mockResolvedValueOnce({
      id: "canonical-agent",
      workspaceId: "workspace-a",
      externalId: "john_doe",
      source: "hermes",
    });
    objects.find.mockResolvedValueOnce([]);
    objects.findOne.mockResolvedValueOnce({
      objectId: "local-agent",
      sourceObjectId: "local-agent",
      canonicalObjectId: "canonical-agent",
    });
    const service = new AgentCloudDocumentService(
      agents,
      objects,
      changes,
      repo(),
      managedDocuments,
    );

    await service.write("workspace-a", "user-a", "canonical-agent", "skills", [
      {
        filename: "SKILL.md",
        content: "# Skill",
      },
    ]);

    expect(objects.save).not.toHaveBeenCalled();
    expect(managedDocuments.save).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "canonical-agent",
        runtimeType: "hermes",
        folder: "skills",
        filename: "SKILL.md",
        desiredContent: "# Skill",
        syncState: "pending",
      }),
    );
    expect(changes.save).toHaveBeenCalledWith(
      expect.objectContaining({
        changeType: "upsert",
        objectType: "agent_document",
        actorUserId: "user-a",
      }),
    );
  });

  it("rejects a new file when the bounded document count is exhausted", async () => {
    const agents = repo();
    const objects = repo();
    const changes = repo();
    agents.findOne.mockResolvedValueOnce({
      id: "canonical-agent",
      workspaceId: "workspace-a",
      externalId: "john_doe",
      source: "hermes",
    });
    objects.find.mockResolvedValueOnce(
      Array.from({ length: 2_000 }, (_, index) => ({
        objectId: `document-${index}`,
        payload: {
          agentId: "canonical-agent",
          runtimeType: "hermes",
          root: "agent",
          folder: "memory",
          filename: `entry-${index}.md`,
          documentKind: "memory",
          content: "",
          contentHash: "hash",
          updatedAt: "2026-07-24T00:00:00.000Z",
        },
      })),
    );
    objects.findOne.mockResolvedValueOnce({
      objectId: "local-agent",
      sourceObjectId: "local-agent",
      canonicalObjectId: "canonical-agent",
    });
    const service = new AgentCloudDocumentService(
      agents,
      objects,
      changes,
      repo(),
    );

    await expect(
      service.write("workspace-a", "user-a", "canonical-agent", "memory", [
        { filename: "one-too-many.md", content: "bounded" },
      ]),
    ).rejects.toThrow("AGENT_DOCUMENT_COUNT_LIMIT_EXCEEDED");
    expect(objects.save).not.toHaveBeenCalled();
  });

  it("filters legacy arbitrary files and audits document listing without paths or content", async () => {
    const agents = repo();
    const objects = repo();
    const changes = repo();
    const runtimeBindings = repo();
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    agents.findOne.mockResolvedValueOnce({
      id: "canonical-agent",
      workspaceId: "workspace-a",
      externalId: "john_doe",
      source: "hermes",
    });
    objects.find.mockResolvedValueOnce([
      {
        objectId: "native-document",
        payload: {
          agentId: "canonical-agent",
          runtimeType: "hermes",
          root: "agent",
          folder: "",
          filename: "SOUL.md",
          content: "Allowed instructions.",
          contentHash: "hash-1",
          updatedAt: "2026-07-26T10:00:00.000Z",
        },
      },
      {
        objectId: "legacy-arbitrary-document",
        payload: {
          agentId: "canonical-agent",
          runtimeType: "hermes",
          root: "agent",
          folder: "",
          filename: "notes.md",
          content: "Must not be exposed.",
          contentHash: "hash-2",
          updatedAt: "2026-07-26T10:00:00.000Z",
        },
      },
    ]);
    objects.findOne.mockResolvedValueOnce(null);
    const service = new AgentCloudDocumentService(
      agents,
      objects,
      changes,
      runtimeBindings,
      undefined,
      audit as any,
    );

    const result = await service.list(
      "workspace-a",
      "canonical-agent",
      "",
      "user-a",
    );

    expect(result.files.map((file) => file.filename)).toEqual(["SOUL.md"]);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "native_agent.document.list",
        metadata: expect.objectContaining({
          documentCount: 1,
          contentRedacted: true,
          pathRedacted: true,
        }),
      }),
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain("SOUL.md");
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(
      "Allowed instructions",
    );
  });

  it("rejects arbitrary root Markdown writes outside the native document contract", async () => {
    const agents = repo();
    agents.findOne.mockResolvedValueOnce({
      id: "canonical-agent",
      workspaceId: "workspace-a",
      externalId: "john_doe",
      source: "hermes",
    });
    const service = new AgentCloudDocumentService(
      agents,
      repo(),
      repo(),
      repo(),
    );

    await expect(
      service.write("workspace-a", "user-a", "canonical-agent", "", [
        { filename: "notes.md", content: "Not a supported root role." },
      ]),
    ).rejects.toThrow("NATIVE_AGENT_DOCUMENT_PATH_NOT_ALLOWED");
  });
});
