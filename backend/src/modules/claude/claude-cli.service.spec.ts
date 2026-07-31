import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClaudeCliService } from "./claude-cli.service";
import { EventsGateway } from "../../gateways/events.gateway";

describe("ClaudeCliService", () => {
  it("requires a structured-prompt-capable bridge control subscriber", async () => {
    const eventsGateway = {
      hasBridgeControlSubscribers: jest.fn().mockReturnValue(false),
      emitToBridgeControls: jest.fn(),
    };
    const bridgeControlCoordinator = {
      registerRequest: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string) =>
        key === "CLAUDE_CODE_LOCAL_CONTROL_TIMEOUT_MS" ? "120000" : undefined,
      ),
    };

    const service = new ClaudeCliService(
      configService as unknown as ConfigService,
      eventsGateway as unknown as EventsGateway,
      bridgeControlCoordinator as never,
    );

    await expect(
      service.runStructuredPrompt({
        workspaceId: "ws-1",
        prompt: "hello",
        schema: { type: "object" },
        repoKey: "repo-1",
      }),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(eventsGateway.hasBridgeControlSubscribers).toHaveBeenCalledWith(
      "ws-1",
      EventsGateway.STRUCTURED_PROMPT_BRIDGE_CAPABILITY,
      null,
      "claude_code",
    );
    expect(eventsGateway.emitToBridgeControls).not.toHaveBeenCalled();
  });

  it("emits structured prompt requests only to compatible bridge controls", async () => {
    const eventsGateway = {
      hasBridgeControlSubscribers: jest.fn().mockReturnValue(true),
      emitToBridgeControls: jest.fn(),
    };
    const bridgeControlCoordinator = {
      registerRequest: jest.fn().mockResolvedValue({
        type: "claude.cli.structured_prompt.result",
        data: {
          requestId: "req-1",
          output: { ok: true },
          model: "gpt-5.4",
        },
      }),
    };
    const configService = {
      get: jest.fn((key: string) =>
        key === "CLAUDE_CODE_LOCAL_CONTROL_TIMEOUT_MS" ? "120000" : undefined,
      ),
    };

    const service = new ClaudeCliService(
      configService as unknown as ConfigService,
      eventsGateway as unknown as EventsGateway,
      bridgeControlCoordinator as never,
    );

    const result = await service.runStructuredPrompt({
      workspaceId: "ws-1",
      prompt: "hello",
      schema: { type: "object" },
      model: "gpt-5.4",
      repoKey: "repo-1",
    });

    expect(result).toEqual({
      output: { ok: true },
      model: "gpt-5.4",
    });
    expect(eventsGateway.emitToBridgeControls).toHaveBeenCalledWith(
      "ws-1",
      "claude.cli.structured_prompt",
      expect.objectContaining({
        prompt: "hello",
        model: "gpt-5.4",
      }),
      EventsGateway.STRUCTURED_PROMPT_BRIDGE_CAPABILITY,
      null,
      "claude_code",
    );
    const emittedPayload = eventsGateway.emitToBridgeControls.mock.calls[0][2];
    expect(emittedPayload).not.toHaveProperty("cwd");
    expect(emittedPayload).toHaveProperty("repoKey", "repo-1");
  });

  it("rejects absent or unsafe repository keys before dispatch", async () => {
    const eventsGateway = {
      hasBridgeControlSubscribers: jest.fn().mockReturnValue(true),
      emitToBridgeControls: jest.fn(),
    };
    const service = new ClaudeCliService(
      { get: jest.fn() } as unknown as ConfigService,
      eventsGateway as unknown as EventsGateway,
      { registerRequest: jest.fn() } as never,
    );

    await expect(
      service.runStructuredPrompt({
        workspaceId: "ws-1",
        prompt: "hello",
        schema: { type: "object" },
      }),
    ).rejects.toThrow(/opaque repoKey/);
    await expect(
      service.runStructuredPrompt({
        workspaceId: "ws-1",
        prompt: "hello",
        schema: { type: "object" },
        repoKey: "../../etc",
      }),
    ).rejects.toThrow(/opaque repoKey/);
    expect(eventsGateway.emitToBridgeControls).not.toHaveBeenCalled();
  });
});
