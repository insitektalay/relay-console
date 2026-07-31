import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventsGateway } from "../../gateways/events.gateway";
import { BridgeControlCoordinatorService } from "../../gateways/bridge-control-coordinator.service";

@Injectable()
export class ClaudeCliService {
  constructor(
    private readonly configService: ConfigService,
    private readonly eventsGateway: EventsGateway,
    private readonly bridgeControlCoordinator: BridgeControlCoordinatorService,
  ) {}

  async runStructuredPrompt<T extends Record<string, unknown>>(input: {
    workspaceId: string;
    prompt: string;
    schema: Record<string, unknown>;
    model?: string | null;
    timeoutMs?: number;
    maxTurns?: number;
    repoKey?: string;
  }): Promise<{ output: T; model: string | null }> {
    const timeoutMs =
      input.timeoutMs ??
      Number(
        this.configService.get<string>(
          "CLAUDE_CODE_LOCAL_CONTROL_TIMEOUT_MS",
        ) ?? "120000",
      );
    const requiredCapability =
      EventsGateway.STRUCTURED_PROMPT_BRIDGE_CAPABILITY;
    const repoKey = input.repoKey?.trim() ?? "";
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(repoKey)) {
      throw new BadRequestException(
        "A registered opaque repoKey is required for local runtime execution",
      );
    }

    if (
      !this.eventsGateway.hasBridgeControlSubscribers(
        input.workspaceId,
        requiredCapability,
        null,
        "claude_code",
      )
    ) {
      throw new ServiceUnavailableException(
        "No bridge control client with structured-prompt support is connected for this workspace",
      );
    }

    const requestId = randomUUID();
    const pending = this.bridgeControlCoordinator.registerRequest<{
      requestId: string;
      output: T;
      model?: string | null;
    }>(
      requestId,
      [
        "claude.cli.structured_prompt.result",
        "claude.cli.structured_prompt.error",
      ],
      timeoutMs + 15_000,
      {
        workspaceId: input.workspaceId,
        runtimeType: "claude_code",
        targetBridgeDeviceId: null,
      },
    );

    this.eventsGateway.emitToBridgeControls(
      input.workspaceId,
      "claude.cli.structured_prompt",
      {
        requestId,
        prompt: input.prompt,
        schema: input.schema,
        model: input.model?.trim() || null,
        timeoutMs,
        repoKey,
        maxTurns:
          input.maxTurns ??
          Number(
            this.configService.get<string>(
              "CLAUDE_CODE_LOCAL_CONTROL_MAX_TURNS",
            ) ?? "8",
          ),
      },
      requiredCapability,
      null,
      "claude_code",
    );

    try {
      const response = await pending;
      return {
        output: response.data.output,
        model:
          typeof response.data.model === "string" ? response.data.model : null,
      };
    } catch (error) {
      if (error instanceof GatewayTimeoutException) {
        throw new GatewayTimeoutException(
          "Timed out waiting for local Claude CLI execution",
        );
      }
      throw error;
    }
  }
}
