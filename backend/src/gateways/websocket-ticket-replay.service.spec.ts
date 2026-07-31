import { WebsocketTicketReplayService } from "./websocket-ticket-replay.service";

const binding = {
  jti: "ticket-id-1",
  userId: "user-1",
  sessionId: "session-1",
  workspaceId: "workspace-1",
};

function buildService(clientOverrides: Record<string, unknown> = {}) {
  const config = { get: jest.fn() };
  const client = {
    isReady: true,
    set: jest.fn().mockResolvedValue("OK"),
    eval: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    ...clientOverrides,
  };
  const service = new WebsocketTicketReplayService(config as any);
  (service as any).client = client;
  return { service, client, config };
}

describe("WebsocketTicketReplayService", () => {
  it("registers only one short-lived ticket record", async () => {
    const { service, client } = buildService();

    await service.register(binding, 60);

    expect(client.set).toHaveBeenCalledWith(
      "clawchat:ws-ticket:ticket-id-1",
      expect.stringMatching(/^[a-f0-9]{64}$/),
      { EX: 60, NX: true },
    );
  });

  it("fails when a ticket identifier already exists", async () => {
    const { service } = buildService({
      set: jest.fn().mockResolvedValue(null),
    });

    await expect(service.register(binding, 60)).rejects.toThrow(
      "WEBSOCKET_TICKET_STATE_CONFLICT",
    );
  });

  it("atomically compares and deletes the exact ticket binding", async () => {
    const { service, client } = buildService();

    await service.consume(binding);

    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("DEL", KEYS[1])'),
      {
        keys: ["clawchat:ws-ticket:ticket-id-1"],
        arguments: [expect.stringMatching(/^[a-f0-9]{64}$/)],
      },
    );
  });

  it("permits only one winner for concurrent ticket consumption", async () => {
    let available = true;
    const { service } = buildService({
      eval: jest.fn().mockImplementation(async () => {
        if (!available) return 0;
        available = false;
        return 1;
      }),
    });

    const results = await Promise.allSettled([
      service.consume(binding),
      service.consume(binding),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
  });

  it.each([
    [0, "WEBSOCKET_TICKET_REPLAYED_OR_EXPIRED"],
    [-1, "WEBSOCKET_TICKET_BINDING_MISMATCH"],
  ])("fails closed for Redis consume result %i", async (result, message) => {
    const { service } = buildService({
      eval: jest.fn().mockResolvedValue(result),
    });

    await expect(service.consume(binding)).rejects.toThrow(message);
  });

  it("requires Redis instead of using a process-local replay fallback", async () => {
    const config = { get: jest.fn() };
    const service = new WebsocketTicketReplayService(config as any);

    await expect(service.register(binding, 60)).rejects.toThrow(
      "WEBSOCKET_TICKET_REDIS_REQUIRED",
    );
  });
});
