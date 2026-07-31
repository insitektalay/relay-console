import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { BridgeService } from "../../../bridge/bridge.service";
import type { MarketplaceConnectorExecutorResult } from "../types";

export type ObsidianCliCredentials = {
  sourceHostId: string;
  sourceHostType: "hermes_bridge" | "openclaw_bridge" | "runtime_host";
  vault: string;
};

@Injectable()
export class ObsidianCliAdapter {
  constructor(private readonly bridge: BridgeService) {}

  async health(workspaceId: string, credentials: ObsidianCliCredentials) {
    const response = await this.run(workspaceId, credentials, ["vault", "info=name"]);
    return this.output(response, "Obsidian vault health check failed").trim();
  }

  async execute(input: {
    workspaceId: string;
    toolName: string;
    credentials: ObsidianCliCredentials;
    payload: Record<string, unknown>;
  }): Promise<MarketplaceConnectorExecutorResult> {
    const { argv, path } = this.argv(input.toolName, input.payload);
    const response = await this.run(input.workspaceId, input.credentials, argv);
    const stdout = this.output(response, "Obsidian CLI action failed");
    const isSearch = input.toolName === "obsidian_search";
    let value: unknown = stdout;
    if (isSearch) {
      try {
        value = stdout.trim() ? JSON.parse(stdout) : [];
      } catch {
        throw new Error("Obsidian returned invalid bounded search JSON");
      }
    }
    return {
      ok: true,
      data: isSearch ? { matches: value } : { content: stdout },
      safeSummary: isSearch
        ? "Obsidian returned bounded vault search results."
        : input.toolName === "obsidian_read_note"
          ? "Obsidian returned one bounded note."
          : "Obsidian completed one bounded note mutation.",
      auditMetadata: {
        authority: "device_local_source_host",
        command: argv[0],
        pathHash: path ? this.hash(path) : null,
        outputBytes: Buffer.byteLength(stdout, "utf8"),
        contentLogged: false,
      },
    };
  }

  private async run(
    workspaceId: string,
    credentials: ObsidianCliCredentials,
    commandArguments: string[],
  ) {
    return this.bridge.callMarketplaceLocalCli({
      workspaceId,
      appSlug: "obsidian",
      sourceHostId: credentials.sourceHostId,
      sourceHostType: credentials.sourceHostType,
      executable: "obsidian",
      argv: [`vault=${this.vault(credentials.vault)}`, ...commandArguments],
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
      throw new Error("Obsidian CLI output exceeded the Relay response bound");
    }
    return stdout;
  }

  private argv(toolName: string, payload: Record<string, unknown>) {
    if (toolName === "obsidian_search") {
      const query = this.text(payload.query, "query", 200);
      const limit = this.integer(payload.limit, 1, 20, 10);
      const folder = this.optionalFolder(payload.folder);
      return {
        argv: [
          "search",
          `query=${query}`,
          `limit=${limit}`,
          "format=json",
          ...(folder ? [`path=${folder}`] : []),
        ],
        path: folder,
      };
    }
    const path = this.notePath(payload.path);
    if (toolName === "obsidian_read_note") {
      return { argv: ["read", `path=${path}`], path };
    }
    const content = this.text(payload.content, "content", 16_384);
    if (toolName === "obsidian_create_note") {
      return { argv: ["create", `path=${path}`, `content=${content}`], path };
    }
    if (toolName === "obsidian_append_note") {
      return { argv: ["append", `path=${path}`, `content=${content}`], path };
    }
    throw new BadRequestException("Unsupported Obsidian CLI tool");
  }

  private vault(value: string) {
    const vault = this.text(value, "vault", 120);
    if (/[/\\\u0000\r\n]/.test(vault)) {
      throw new BadRequestException("Obsidian vault must be an exact vault name or ID");
    }
    return vault;
  }

  private notePath(value: unknown) {
    const path = this.relativePath(value, "path", 240);
    if (!path.toLowerCase().endsWith(".md")) {
      throw new BadRequestException("Obsidian note path must end in .md");
    }
    return path;
  }

  private optionalFolder(value: unknown) {
    if (value === undefined || value === null || value === "") return null;
    return this.relativePath(value, "folder", 200);
  }

  private relativePath(value: unknown, name: string, maximum: number) {
    const path = this.text(value, name, maximum).replace(/\\/g, "/");
    const segments = path.split("/");
    if (
      path.startsWith("/") ||
      segments.some((segment) => !segment || segment === "." || segment === "..") ||
      [".obsidian", ".trash"].includes(segments[0]?.toLowerCase() ?? "")
    ) {
      throw new BadRequestException(`Obsidian ${name} must stay inside the selected vault`);
    }
    return path;
  }

  private text(value: unknown, name: string, maximum: number) {
    if (typeof value !== "string" || !value.trim() || value.length > maximum) {
      throw new BadRequestException(`Obsidian ${name} is required and must be at most ${maximum} characters`);
    }
    if (/\u0000|\r/.test(value)) {
      throw new BadRequestException(`Obsidian ${name} contains unsupported control characters`);
    }
    return value;
  }

  private integer(value: unknown, minimum: number, maximum: number, fallback: number) {
    const parsed = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
      throw new BadRequestException(`Obsidian limit must be between ${minimum} and ${maximum}`);
    }
    return parsed;
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex").slice(0, 16);
  }
}
