import { WorkManagementExecutors2 } from "./work-management-02.executors";

describe("WorkManagementExecutors2 Jotform", () => {
  it("passes the documented operation form through the OAuth MCP path", async () => {
    const connection = { id: "connection-jotform", metadata: {} };
    const callRead = jest.fn().mockResolvedValue({ content: [] });
    const service = {
      oauth: {
        getConnectionWithSecrets: jest.fn().mockResolvedValue(connection),
        refreshIfNeeded: jest
          .fn()
          .mockResolvedValue({ accessToken: "oauth-access-token" }),
      },
      credentials: { decrypt: jest.fn().mockReturnValue({}) },
      registry: {
        getTool: jest.fn().mockReturnValue({
          name: "jotform.read",
          capability: "jotform_read",
        }),
      },
      jotformMcp: { callRead },
      recordAudit: jest.fn().mockResolvedValue(undefined),
      ok: jest.fn((data, message) => ({ ok: true, data, message })),
      stringOrNull: (value: unknown) =>
        typeof value === "string" && value.trim() ? value.trim() : null,
      requiredString: (value: unknown, label: string) => {
        if (typeof value !== "string" || !value.trim()) {
          throw new Error(`${label} is required`);
        }
        return value.trim();
      },
    };

    await expect(
      WorkManagementExecutors2.executeJotform.call(
        service as never,
        {
          workspaceId: "workspace-1",
          connectionId: connection.id,
          agentId: "agent-1",
          toolName: "jotform_read",
          input: { operation: "user.forms.list" },
        } as never,
      ),
    ).resolves.toMatchObject({ ok: true });
    expect(callRead).toHaveBeenCalledWith("oauth-access-token", {
      operation: "user.forms.list",
    });
  });
});
