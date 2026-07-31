import { AuditLogService } from "./audit-log.service";

const AUDIT_SECRET = "audit-test-secret-with-at-least-32-bytes";

function makeRepoMock(overrides: Partial<any> = {}) {
  return {
    create: jest.fn().mockImplementation((input) => ({
      id: "audit-1",
      ...input,
    })),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    ...overrides,
  };
}

function makeService(
  repo = makeRepoMock(),
  secret: string | null = AUDIT_SECRET,
) {
  const config = {
    get: jest.fn((key: string) =>
      key === "AUDIT_IDENTIFIER_HASH_SECRET"
        ? (secret ?? undefined)
        : undefined,
    ),
  };
  return {
    repo,
    service: new AuditLogService(repo as any, config as any),
  };
}

describe("AuditLogService", () => {
  it("preserves bounded authenticated IDs and normalizes optional fields", async () => {
    const { repo, service } = makeService();

    await expect(
      service.record({
        actorType: "user",
        actorId: "user-1",
        workspaceId: "ws-1",
        eventType: "billing.subscription.updated",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: "audit-1",
        actorType: "user",
        actorId: "user-1",
        workspaceId: "ws-1",
        eventType: "billing.subscription.updated",
      }),
    );

    expect(repo.create).toHaveBeenCalledWith({
      actorType: "user",
      actorId: "user-1",
      workspaceId: "ws-1",
      eventType: "billing.subscription.updated",
      resourceType: null,
      resourceId: null,
      ipAddress: null,
      userAgent: null,
      metadata: null,
    });
  });

  it("tokenizes anonymous account and network identifiers in separate domains", async () => {
    const { repo, service } = makeService();
    await service.record({
      actorType: "anonymous",
      actorId: " Person@Example.COM ",
      eventType: "auth.login.failed",
      ipAddress: "203.0.113.20",
    });
    await service.record({
      actorType: "anonymous",
      actorId: "person@example.com",
      eventType: "auth.login.failed",
      ipAddress: "203.0.113.20",
    });

    const first = repo.create.mock.calls[0][0];
    const second = repo.create.mock.calls[1][0];
    expect(first.actorId).toMatch(/^account:v1:[A-Za-z0-9_-]{43}$/);
    expect(first.ipAddress).toMatch(/^network:v1:[A-Za-z0-9_-]{43}$/);
    expect(first.actorId).toBe(second.actorId);
    expect(first.ipAddress).toBe(second.ipAddress);
    expect(first.actorId).not.toBe(first.ipAddress);
    expect(JSON.stringify(first)).not.toContain("person@example.com");
    expect(JSON.stringify(first)).not.toContain("203.0.113.20");
  });

  it("drops privacy tokens when the non-production key is absent", async () => {
    const { repo, service } = makeService(makeRepoMock(), null);
    await service.record({
      actorType: "anonymous",
      actorId: "person@example.com",
      eventType: "auth.login.failed",
      ipAddress: "203.0.113.20",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: null, ipAddress: null }),
    );
  });

  it("removes log controls, bounds client text, and drops sensitive metadata", async () => {
    const { repo, service } = makeService();
    const rawUserAgent = `Browser\r\nForged: value\u202e${"x".repeat(400)}`;
    await service.record({
      actorType: "anonymous",
      actorId: "person@example.com",
      eventType: "auth.login.failed\r\nforged",
      resourceType: "session\r\nforged",
      userAgent: rawUserAgent,
      ipAddress: "not-an-ip\r\nforged",
      metadata: {
        reason: "credentials_rejected\r\nforged",
        email: "person@example.com",
        token: "secret-token",
        ...JSON.parse(
          '{"__proto__":{"polluted":true},"constructor":"blocked"}',
        ),
        nested: {
          note: `safe\u2028${"y".repeat(400)}`,
        },
      },
    });

    const stored = repo.create.mock.calls[0][0];
    expect(stored.actorType).toBe("anonymous");
    expect(stored.eventType).toBe("auth.login.failed forged");
    expect(stored.resourceType).toBe("session forged");
    expect(stored.ipAddress).toBeNull();
    expect(stored.userAgent).toHaveLength(160);
    expect(stored.userAgent).not.toMatch(/[\r\n\u202e]/);
    expect(stored.metadata.reason).toBe("credentials_rejected forged");
    expect(stored.metadata).not.toHaveProperty("email");
    expect(stored.metadata).not.toHaveProperty("token");
    expect(
      Object.prototype.hasOwnProperty.call(stored.metadata, "__proto__"),
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(stored.metadata, "constructor"),
    ).toBe(false);
    expect(stored.metadata.nested.note.length).toBeLessThanOrEqual(256);
    expect(JSON.stringify(stored)).not.toContain("secret-token");
  });

  it("never echoes a database exception into the application log", async () => {
    const repo = makeRepoMock({
      save: jest
        .fn()
        .mockRejectedValue(
          new Error("password=database-secret\r\nforged log line"),
        ),
    });
    const { service } = makeService(repo);
    const warn = jest
      .spyOn((service as any).logger, "warn")
      .mockImplementation(() => undefined);

    await expect(
      service.record({
        actorType: "user",
        actorId: "user-1",
        eventType: "billing.subscription.updated\r\nforged",
      }),
    ).resolves.toBeNull();

    expect(warn).toHaveBeenCalledWith({
      event: "audit.write_failed",
      eventType: "billing.subscription.updated forged",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("database-secret");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("forged log line");
  });

  it("skips noisy websocket disconnect audit events", async () => {
    const { repo, service } = makeService();

    await expect(
      service.record({
        actorType: "user",
        actorId: "user-1",
        eventType: "realtime.websocket.disconnected",
      }),
    ).resolves.toBeNull();

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("skips high-volume success and marketplace preview noise", async () => {
    const { repo, service } = makeService();

    for (const eventType of [
      "auth.web.login.success",
      "auth.login.success",
      "bridge.device.auth.success",
      "marketplace.approval_profile.selected",
      "marketplace.pack.previewed",
      "marketplace.runtime_format.selected",
      "marketplace.outlook.approval.skipped",
    ]) {
      await expect(
        service.record({
          actorType: "user",
          actorId: "user-1",
          eventType,
        }),
      ).resolves.toBeNull();
    }

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });
});
