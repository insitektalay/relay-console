import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { BridgeService } from "../../../bridge/bridge.service";
import type { MarketplaceConnectorExecutorResult } from "../types";

export type LogseqCliCredentials = {
  sourceHostId: string;
  sourceHostType: "hermes_bridge" | "openclaw_bridge" | "runtime_host";
  graph: string;
};

@Injectable()
export class LogseqCliAdapter {
  constructor(private readonly bridge: BridgeService) {}

  async health(workspaceId: string, credentials: LogseqCliCredentials) {
    const response = await this.run(workspaceId, credentials, [
      "graph",
      "info",
    ]);
    const result = this.output(response, "Logseq graph health check failed");
    return {
      graph: credentials.graph,
      data: result,
    };
  }

  async execute(input: {
    workspaceId: string;
    toolName: string;
    credentials: LogseqCliCredentials;
    payload: Record<string, unknown>;
  }): Promise<MarketplaceConnectorExecutorResult> {
    const { argv, target } = this.argv(input.toolName, input.payload);
    const response = await this.run(input.workspaceId, input.credentials, argv);
    const result = this.output(response, "Logseq CLI action failed");
    const isWrite = input.toolName === "logseq_append_block";
    return {
      ok: true,
      data: result,
      safeSummary: isWrite
        ? "Logseq appended one bounded block to the selected page."
        : "Logseq returned bounded graph content.",
      auditMetadata: {
        authority: "device_local_source_host",
        command: argv.slice(0, 2).join(" "),
        targetHash: target ? this.hash(target) : null,
        outputBytes: Buffer.byteLength(JSON.stringify(result), "utf8"),
        contentLogged: false,
      },
    };
  }

  private run(
    workspaceId: string,
    credentials: LogseqCliCredentials,
    commandArguments: string[],
  ) {
    return this.bridge.callMarketplaceLocalCli({
      workspaceId,
      appSlug: "logseq",
      sourceHostId: credentials.sourceHostId,
      sourceHostType: credentials.sourceHostType,
      executable: "logseq",
      argv: [
        ...commandArguments,
        "--graph",
        this.graph(credentials.graph),
        "--output",
        "json",
      ],
      timeoutMs: 15_000,
      maxOutputBytes: 65_536,
    });
  }

  private output(
    response: Awaited<ReturnType<BridgeService["callMarketplaceLocalCli"]>>,
    fallback: string,
  ) {
    const stdout = typeof response.stdout === "string" ? response.stdout : "";
    if (response.status !== "ok" || response.exitCode !== 0) {
      throw new Error(response.error?.trim() || fallback);
    }
    if (Buffer.byteLength(stdout, "utf8") > 65_536) {
      throw new Error("Logseq CLI output exceeded the Relay response bound");
    }
    try {
      return JSON.parse(stdout || "null");
    } catch {
      throw new Error("Logseq CLI returned invalid bounded JSON");
    }
  }

  private argv(toolName: string, payload: Record<string, unknown>) {
    if (toolName === "logseq_list_pages") {
      const limit = this.integer(payload.limit, 1, 20, 10);
      return {
        argv: [
          "list",
          "page",
          "--limit",
          `${limit}`,
          "--offset",
          "0",
          "--sort",
          "updated-at",
          "--order",
          "desc",
        ],
        target: "recent-pages",
      };
    }
    if (toolName === "logseq_list_tasks") {
      const limit = this.integer(payload.limit, 1, 20, 10);
      return {
        argv: [
          "list",
          "task",
          "--limit",
          `${limit}`,
          "--offset",
          "0",
          "--sort",
          "updated-at",
          "--order",
          "desc",
        ],
        target: "recent-tasks",
      };
    }
    if (toolName === "logseq_show_page") {
      const page = this.text(payload.page, "page", 200);
      const level = this.integer(payload.level, 0, 3, 2);
      return {
        argv: ["show", "--page", page, "--level", `${level}`],
        target: page,
      };
    }
    if (toolName === "logseq_show_block") {
      const uuid = this.uuid(payload.uuid);
      const level = this.integer(payload.level, 0, 3, 2);
      return {
        argv: ["show", "--uuid", uuid, "--level", `${level}`],
        target: uuid,
      };
    }
    if (toolName === "logseq_append_block") {
      const page = this.text(payload.page, "page", 200);
      const content = this.text(payload.content, "content", 16_384);
      return {
        argv: [
          "upsert",
          "block",
          "--target-page",
          page,
          "--content",
          content,
          "--pos",
          "last-child",
        ],
        target: page,
      };
    }
    throw new BadRequestException("Unsupported Logseq CLI tool");
  }

  private graph(value: string) {
    const graph = this.text(value, "graph", 120);
    if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,119}$/u.test(graph)) {
      throw new BadRequestException(
        "Logseq graph must be an exact local DB graph name",
      );
    }
    return graph;
  }

  private uuid(value: unknown) {
    const uuid = this.text(value, "block UUID", 36);
    if (
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
        uuid,
      )
    ) {
      throw new BadRequestException("Logseq block UUID is invalid");
    }
    return uuid;
  }

  private text(value: unknown, name: string, maximum: number) {
    if (typeof value !== "string" || !value.trim() || value.length > maximum) {
      throw new BadRequestException(
        `Logseq ${name} is required and must be at most ${maximum} characters`,
      );
    }
    if (/\u0000|\r/.test(value)) {
      throw new BadRequestException(
        `Logseq ${name} contains unsupported control characters`,
      );
    }
    return value;
  }

  private integer(
    value: unknown,
    minimum: number,
    maximum: number,
    fallback: number,
  ) {
    const parsed = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
      throw new BadRequestException(
        `Logseq numeric value must be between ${minimum} and ${maximum}`,
      );
    }
    return parsed;
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex").slice(0, 16);
  }
}
