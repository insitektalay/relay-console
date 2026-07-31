import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { BridgeService } from "../../../bridge/bridge.service";
import type { MarketplaceConnectorExecutorResult } from "../types";

export type RoamResearchCliCredentials = {
  sourceHostId: string;
  sourceHostType: "hermes_bridge" | "openclaw_bridge" | "runtime_host";
  graph: string;
};

@Injectable()
export class RoamResearchCliAdapter {
  constructor(private readonly bridge: BridgeService) {}

  async health(workspaceId: string, credentials: RoamResearchCliCredentials) {
    const response = await this.run(
      workspaceId,
      credentials,
      ["get-graph-guidelines"],
      16_384,
    );
    this.output(response, 16_384, "Roam Research graph health check failed");
    return credentials.graph;
  }

  async execute(input: {
    workspaceId: string;
    toolName: string;
    credentials: RoamResearchCliCredentials;
    payload: Record<string, unknown>;
  }): Promise<MarketplaceConnectorExecutorResult> {
    const { argv, target } = this.argv(input.toolName, input.payload);
    const guidelinesResponse = await this.run(
      input.workspaceId,
      input.credentials,
      ["get-graph-guidelines"],
      16_384,
    );
    const guidelines = this.output(
      guidelinesResponse,
      16_384,
      "Roam Research graph guidelines could not be read",
    );
    const response = await this.run(
      input.workspaceId,
      input.credentials,
      argv,
      49_152,
    );
    const stdout = this.output(
      response,
      49_152,
      "Roam Research CLI action failed",
    );
    const isAppend = input.toolName === "roam_research_append_daily_note";
    return {
      ok: true,
      data: isAppend
        ? { guidelines, result: stdout }
        : { guidelines, content: stdout },
      safeSummary: isAppend
        ? "Roam Research appended bounded Markdown to one daily note."
        : "Roam Research returned bounded graph content.",
      auditMetadata: {
        authority: "device_local_source_host",
        command: argv[0],
        targetHash: target ? this.hash(target) : null,
        outputBytes:
          Buffer.byteLength(guidelines, "utf8") +
          Buffer.byteLength(stdout, "utf8"),
        contentLogged: false,
      },
    };
  }

  private run(
    workspaceId: string,
    credentials: RoamResearchCliCredentials,
    commandArguments: string[],
    maxOutputBytes: number,
  ) {
    return this.bridge.callMarketplaceLocalCli({
      workspaceId,
      appSlug: "roam-research",
      sourceHostId: credentials.sourceHostId,
      sourceHostType: credentials.sourceHostType,
      executable: "roam",
      argv: [...commandArguments, "--graph", this.graph(credentials.graph)],
      timeoutMs: 15_000,
      maxOutputBytes,
    });
  }

  private output(
    response: Awaited<ReturnType<BridgeService["callMarketplaceLocalCli"]>>,
    maximum: number,
    fallback: string,
  ) {
    const stdout = typeof response.stdout === "string" ? response.stdout : "";
    if (response.status !== "ok" || response.exitCode !== 0) {
      throw new Error(response.error?.trim() || fallback);
    }
    if (Buffer.byteLength(stdout, "utf8") > maximum) {
      throw new Error(
        "Roam Research CLI output exceeded the Relay response bound",
      );
    }
    return stdout;
  }

  private argv(toolName: string, payload: Record<string, unknown>) {
    if (toolName === "roam_research_search") {
      const query = this.text(payload.query, "query", 200);
      const scope = this.scope(payload.scope);
      const limit = this.integer(payload.limit, 1, 20, 10);
      return {
        argv: [
          "search",
          "--query",
          query,
          "--scope",
          scope,
          "--offset",
          "0",
          "--limit",
          `${limit}`,
          "--include-path",
          "true",
          "--max-depth",
          "0",
        ],
        target: query,
      };
    }
    if (toolName === "roam_research_get_page") {
      const title = this.text(payload.title, "page title", 200);
      const maxDepth = this.integer(payload.maxDepth, 0, 3, 2);
      return {
        argv: ["get-page", "--title", title, "--max-depth", `${maxDepth}`],
        target: title,
      };
    }
    if (toolName === "roam_research_get_block") {
      const uid = this.uid(payload.uid);
      const maxDepth = this.integer(payload.maxDepth, 0, 3, 2);
      return {
        argv: ["get-block", "--uid", uid, "--max-depth", `${maxDepth}`],
        target: uid,
      };
    }
    if (toolName === "roam_research_append_daily_note") {
      const markdown = this.text(payload.markdown, "markdown", 16_384);
      const date = this.date(payload.date);
      const nestUnder = this.optionalText(payload.nestUnder, "nest-under", 200);
      return {
        argv: [
          "append-to-daily-note",
          "--markdown",
          markdown,
          "--date",
          date,
          ...(nestUnder ? ["--nest-under", nestUnder] : []),
        ],
        target: `${date}:${nestUnder ?? "root"}`,
      };
    }
    throw new BadRequestException("Unsupported Roam Research CLI tool");
  }

  private graph(value: string) {
    const graph = this.text(value, "graph", 120);
    if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,119}$/u.test(graph)) {
      throw new BadRequestException(
        "Roam Research graph must be an exact configured graph name or nickname",
      );
    }
    return graph;
  }

  private uid(value: unknown) {
    const uid = this.text(value, "block UID", 64);
    if (!/^[A-Za-z0-9_-]+$/.test(uid)) {
      throw new BadRequestException("Roam Research block UID is invalid");
    }
    return uid;
  }

  private date(value: unknown) {
    const date = value === undefined ? "today" : this.text(value, "date", 10);
    if (
      !["today", "yesterday", "tomorrow"].includes(date.toLowerCase()) &&
      !/^\d{2}-\d{2}-\d{4}$/.test(date)
    ) {
      throw new BadRequestException(
        "Roam Research date must be today, yesterday, tomorrow, or MM-DD-YYYY",
      );
    }
    return date.toLowerCase();
  }

  private scope(value: unknown) {
    const scope = value === undefined ? "all" : this.text(value, "scope", 6);
    if (!["all", "pages", "blocks"].includes(scope)) {
      throw new BadRequestException(
        "Roam Research search scope must be all, pages, or blocks",
      );
    }
    return scope;
  }

  private optionalText(
    value: unknown,
    name: string,
    maximum: number,
  ): string | null {
    if (value === undefined || value === null || value === "") return null;
    return this.text(value, name, maximum);
  }

  private text(value: unknown, name: string, maximum: number) {
    if (typeof value !== "string" || !value.trim() || value.length > maximum) {
      throw new BadRequestException(
        `Roam Research ${name} is required and must be at most ${maximum} characters`,
      );
    }
    if (/\u0000|\r/.test(value)) {
      throw new BadRequestException(
        `Roam Research ${name} contains unsupported control characters`,
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
        `Roam Research numeric value must be between ${minimum} and ${maximum}`,
      );
    }
    return parsed;
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex").slice(0, 16);
  }
}
