import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { BridgeService } from "../../../bridge/bridge.service";
import type { MarketplaceConnectorExecutorResult } from "../types";

type JsonObject = Record<string, unknown>;

export type LocalWordPressOrgCliCredentials = {
  sourceHostId: string;
  sourceHostType: "hermes_bridge" | "openclaw_bridge" | "runtime_host";
  sitePath: string;
};

@Injectable()
export class LocalWordPressOrgCliAdapter {
  constructor(private readonly bridge: BridgeService) {}

  async health(
    workspaceId: string,
    credentials: LocalWordPressOrgCliCredentials,
  ) {
    const response = await this.run(workspaceId, credentials, [
      "core",
      "version",
    ]);
    const version = this.output(
      response,
      "Local WordPress WP-CLI health check failed",
    ).trim();
    if (!/^\d+\.\d+(?:\.\d+)?(?:[-+][A-Za-z0-9.-]+)?$/.test(version))
      throw new Error("Local WordPress returned an invalid core version");
    return { version };
  }

  async execute(input: {
    workspaceId: string;
    toolName: string;
    credentials: LocalWordPressOrgCliCredentials;
    payload: JsonObject;
  }): Promise<MarketplaceConnectorExecutorResult> {
    const { argv, postId, operation } = this.argv(
      input.toolName,
      input.payload,
    );
    const response = await this.run(input.workspaceId, input.credentials, argv);
    const stdout = this.output(
      response,
      "Local WordPress WP-CLI action failed",
    );
    const data = this.parse(input.toolName, stdout);
    return {
      ok: true,
      data,
      safeSummary:
        input.toolName === "local_wordpress_org_create_draft"
          ? "Local WordPress created one draft."
          : `Local WordPress ${operation} completed.`,
      auditMetadata: {
        authority: "device_local_source_host",
        command: argv.find((argument) => !argument.startsWith("--")) ?? null,
        operation,
        sitePathHash: this.hash(input.credentials.sitePath),
        postId: postId ?? null,
        outputBytes: Buffer.byteLength(stdout, "utf8"),
        contentLogged: false,
        argumentValuesLogged: false,
      },
    };
  }

  private async run(
    workspaceId: string,
    credentials: LocalWordPressOrgCliCredentials,
    commandArguments: string[],
  ) {
    return this.bridge.callMarketplaceLocalCli({
      workspaceId,
      appSlug: "local-wordpress-org",
      sourceHostId: credentials.sourceHostId,
      sourceHostType: credentials.sourceHostType,
      executable: "wp",
      argv: [
        `--path=${this.sitePath(credentials.sitePath)}`,
        "--skip-plugins",
        "--skip-themes",
        "--no-color",
        ...commandArguments,
      ],
      timeoutMs: 20_000,
      maxOutputBytes: 65_536,
    });
  }

  private output(
    response: Awaited<ReturnType<BridgeService["callMarketplaceLocalCli"]>>,
    fallback: string,
  ) {
    const stdout = typeof response.stdout === "string" ? response.stdout : "";
    if (response.status !== "ok" || response.exitCode !== 0)
      throw new Error(fallback);
    if (Buffer.byteLength(stdout, "utf8") > 65_536)
      throw new Error(
        "Local WordPress output exceeded the Relay response bound",
      );
    return stdout;
  }

  private argv(toolName: string, payload: JsonObject) {
    if (toolName === "local_wordpress_org_site_info")
      return {
        argv: ["option", "get", "home", "--format=json"],
        postId: null,
        operation: "site info read",
      };
    if (toolName === "local_wordpress_org_list_posts") {
      const postType = this.enumValue(
        payload.postType,
        "postType",
        ["post", "page"],
        "post",
      );
      const status = this.enumValue(
        payload.status,
        "status",
        ["draft", "publish", "pending", "private", "future"],
        "draft",
      );
      const limit = this.integer(payload.limit, 1, 20, 10);
      return {
        argv: [
          "post",
          "list",
          `--post_type=${postType}`,
          `--post_status=${status}`,
          `--posts_per_page=${limit}`,
          "--orderby=modified",
          "--order=DESC",
          "--fields=ID,post_type,post_status,post_title,post_date_gmt,post_modified_gmt",
          "--format=json",
        ],
        postId: null,
        operation: "post list",
      };
    }
    if (toolName === "local_wordpress_org_get_post") {
      const postId = this.integer(payload.postId, 1, Number.MAX_SAFE_INTEGER);
      return {
        argv: [
          "post",
          "get",
          String(postId),
          "--fields=ID,post_type,post_status,post_title,post_date_gmt,post_modified_gmt,post_excerpt,post_content",
          "--format=json",
        ],
        postId,
        operation: "post read",
      };
    }
    if (toolName === "local_wordpress_org_create_draft") {
      const postType = this.enumValue(
        payload.postType,
        "postType",
        ["post", "page"],
        "post",
      );
      const title = this.text(payload.title, "title", 200);
      const content = this.text(payload.content, "content", 16_384);
      const excerpt = this.optionalText(payload.excerpt, "excerpt", 1_000);
      return {
        argv: [
          "post",
          "create",
          `--post_type=${postType}`,
          "--post_status=draft",
          `--post_title=${title}`,
          `--post_content=${content}`,
          ...(excerpt ? [`--post_excerpt=${excerpt}`] : []),
          "--comment_status=closed",
          "--ping_status=closed",
          "--porcelain",
        ],
        postId: null,
        operation: "draft creation",
      };
    }
    throw new BadRequestException("Unsupported Local WordPress.org tool");
  }

  private parse(toolName: string, stdout: string) {
    const trimmed = stdout.trim();
    if (toolName === "local_wordpress_org_create_draft") {
      if (!/^[1-9]\d{0,18}$/.test(trimmed))
        throw new Error("Local WordPress returned an invalid draft ID");
      return { draftId: trimmed, status: "draft" };
    }
    try {
      const value = trimmed ? JSON.parse(trimmed) : null;
      if (toolName === "local_wordpress_org_site_info") {
        if (typeof value !== "string" || !value)
          throw new Error("Local WordPress returned an invalid site identity");
        return { homeUrl: value };
      }
      if (toolName === "local_wordpress_org_list_posts") {
        if (
          !Array.isArray(value) ||
          value.length > 20 ||
          value.some(
            (item) =>
              !item ||
              typeof item !== "object" ||
              !["post", "page"].includes(
                String((item as JsonObject).post_type),
              ),
          )
        )
          throw new Error(
            "Local WordPress returned an invalid bounded post list",
          );
        return value;
      }
      if (
        toolName === "local_wordpress_org_get_post" &&
        (!value ||
          typeof value !== "object" ||
          !["post", "page"].includes(String((value as JsonObject).post_type)))
      )
        throw new Error("Local WordPress returned an unsupported content type");
      return value;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Local WordPress"))
        throw error;
      throw new Error("Local WordPress returned invalid bounded JSON");
    }
  }

  private sitePath(value: string) {
    const path = this.text(value, "site path", 500);
    const normalized = path.replace(/\\/g, "/");
    if (
      (!normalized.startsWith("/") && !/^[A-Za-z]:\//.test(normalized)) ||
      normalized.split("/").some((segment) => segment === "..")
    )
      throw new BadRequestException(
        "Local WordPress site path must be one exact absolute installation path",
      );
    return path;
  }

  private text(value: unknown, name: string, maximum: number) {
    if (typeof value !== "string" || !value.trim() || value.length > maximum)
      throw new BadRequestException(
        `Local WordPress ${name} is required and must be at most ${maximum} characters`,
      );
    if (/\u0000|\r/.test(value))
      throw new BadRequestException(
        `Local WordPress ${name} contains unsupported control characters`,
      );
    return value;
  }

  private optionalText(value: unknown, name: string, maximum: number) {
    if (value === undefined || value === null || value === "") return null;
    return this.text(value, name, maximum);
  }

  private enumValue(
    value: unknown,
    name: string,
    allowed: string[],
    fallback: string,
  ) {
    const candidate = value === undefined ? fallback : String(value);
    if (!allowed.includes(candidate))
      throw new BadRequestException(`Local WordPress ${name} is invalid`);
    return candidate;
  }

  private integer(
    value: unknown,
    minimum: number,
    maximum: number,
    fallback?: number,
  ) {
    const parsed =
      value === undefined && fallback !== undefined ? fallback : Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum)
      throw new BadRequestException(
        `Local WordPress integer must be between ${minimum} and ${maximum}`,
      );
    return parsed;
  }

  private hash(value: string) {
    return createHash("sha256").update(value).digest("hex").slice(0, 16);
  }
}
