import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHmac } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type FilestackCredentials = { apiKey: string; appSecret: string };
type FilestackInput = {
  handle?: string;
  filename?: string;
  contentBase64?: string;
  contentType?: string;
  includeExif?: boolean;
  taskChain?: string;
  workflowId?: string;
};

export class FilestackApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class FilestackApiAdapter {
  private static readonly FILE_ORIGIN = "https://www.filestackapi.com";
  private static readonly CDN_ORIGIN = "https://cdn.filestackcontent.com";
  private static readonly MAX_BYTES = 5_000_000;

  health(credentials: FilestackCredentials) {
    this.requireCredentials(credentials);
    this.signedPolicy(credentials, ["stat"]);
    return { credentialPresent: true };
  }

  async read(
    credentials: FilestackCredentials,
    operation: string,
    input: FilestackInput,
  ) {
    this.requireCredentials(credentials);
    const handle = this.handle(input.handle);
    if (operation === "download_file") {
      const signed = this.signedPolicy(credentials, ["read"], handle);
      const response = await this.request(
        `${FilestackApiAdapter.FILE_ORIGIN}/api/file/${handle}?${this.query(credentials, signed)}`,
        { method: "GET" },
      );
      const bytes = await this.boundedBytes(response);
      return {
        handle,
        contentType:
          response.headers.get("content-type") ?? "application/octet-stream",
        contentBase64: bytes.toString("base64"),
        size: bytes.length,
      };
    }
    if (operation === "read_metadata") {
      const calls = input.includeExif ? ["stat", "exif"] : ["stat"];
      const signed = this.signedPolicy(credentials, calls, handle);
      const query = `${this.query(credentials, signed)}${input.includeExif ? "&exif=true" : ""}`;
      return this.json(
        await this.request(
          `${FilestackApiAdapter.FILE_ORIGIN}/api/file/${handle}/metadata?${query}`,
          { method: "GET" },
        ),
      );
    }
    throw new FilestackApiError(
      "provider_validation_error",
      "Filestack read operation is unsupported.",
    );
  }

  async manage(
    credentials: FilestackCredentials,
    operation: string,
    input: FilestackInput,
  ) {
    this.requireCredentials(credentials);
    if (operation === "upload_file") {
      const file = this.file(input);
      const signed = this.signedPolicy(credentials, ["pick", "store"]);
      const form = new FormData();
      form.append(
        "fileUpload",
        new Blob([new Uint8Array(file.bytes)], { type: file.contentType }),
        file.filename,
      );
      return this.json(
        await this.request(
          `${FilestackApiAdapter.FILE_ORIGIN}/api/store/S3?${this.query(credentials, signed)}`,
          { method: "POST", body: form },
        ),
      );
    }
    const handle = this.handle(input.handle);
    if (operation === "overwrite_file") {
      const file = this.file(input);
      const signed = this.signedPolicy(credentials, ["write"], handle);
      const form = new FormData();
      form.append(
        "fileUpload",
        new Blob([new Uint8Array(file.bytes)], { type: file.contentType }),
        file.filename,
      );
      return this.json(
        await this.request(
          `${FilestackApiAdapter.FILE_ORIGIN}/api/file/${handle}?${this.query(credentials, signed)}`,
          { method: "POST", body: form },
        ),
      );
    }
    if (operation === "delete_file") {
      const signed = this.signedPolicy(credentials, ["remove"], handle);
      return this.json(
        await this.request(
          `${FilestackApiAdapter.FILE_ORIGIN}/api/file/${handle}?${this.query(credentials, signed)}`,
          { method: "DELETE" },
        ),
      );
    }
    throw new FilestackApiError(
      "provider_validation_error",
      "Filestack file-management operation is unsupported.",
    );
  }

  async process(credentials: FilestackCredentials, input: FilestackInput) {
    this.requireCredentials(credentials);
    const handle = this.handle(input.handle);
    const taskChain = this.taskChain(input.taskChain);
    const signed = this.signedPolicy(credentials, ["read", "convert"], handle);
    const url = `${FilestackApiAdapter.CDN_ORIGIN}/security=p:${signed.policy},s:${signed.signature}/${taskChain}/${handle}`;
    const response = await this.request(url, { method: "GET" });
    const bytes = await this.boundedBytes(response);
    return {
      handle,
      contentType:
        response.headers.get("content-type") ?? "application/octet-stream",
      contentBase64: bytes.toString("base64"),
      size: bytes.length,
    };
  }

  async runWorkflow(credentials: FilestackCredentials, input: FilestackInput) {
    this.requireCredentials(credentials);
    const handle = this.handle(input.handle);
    const workflowId = this.identifier(input.workflowId, "workflow ID");
    const signed = this.signedPolicy(credentials, ["runWorkflow"], handle);
    const url = `${FilestackApiAdapter.CDN_ORIGIN}/${encodeURIComponent(credentials.apiKey)}/security=p:${signed.policy},s:${signed.signature}/run_workflow=id:${workflowId}/${handle}`;
    const response = await this.request(url, { method: "GET" });
    return this.json(response);
  }

  signedPolicy(
    credentials: FilestackCredentials,
    calls: string[],
    handle?: string,
  ) {
    this.requireCredentials(credentials);
    const payload: JsonObject = {
      expiry: Math.floor(Date.now() / 1000) + 300,
      call: calls,
    };
    if (handle) payload.handle = this.handle(handle);
    const policy = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", credentials.appSecret)
      .update(policy)
      .digest("hex");
    return { policy, signature };
  }

  private query(
    credentials: FilestackCredentials,
    signed: { policy: string; signature: string },
  ) {
    return new URLSearchParams({
      key: credentials.apiKey,
      policy: signed.policy,
      signature: signed.signature,
    }).toString();
  }

  private async request(url: string, init: RequestInit) {
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new FilestackApiError(
        "provider_unavailable",
        "Filestack could not be reached.",
        502,
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new FilestackApiError(
        this.errorCode(response.status),
        `Filestack returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return response;
  }

  private async json(response: Response) {
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw new FilestackApiError(
        "provider_validation_error",
        "Filestack returned an oversized JSON response.",
      );
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      throw new FilestackApiError(
        "provider_validation_error",
        "Filestack returned an invalid JSON response.",
      );
    }
  }

  private async boundedBytes(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > FilestackApiAdapter.MAX_BYTES)
      throw new FilestackApiError(
        "provider_validation_error",
        "Filestack content exceeds Relay's five-megabyte agent limit.",
      );
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > FilestackApiAdapter.MAX_BYTES)
      throw new FilestackApiError(
        "provider_validation_error",
        "Filestack content exceeds Relay's five-megabyte agent limit.",
      );
    return bytes;
  }

  private file(input: FilestackInput) {
    const filename = this.identifier(input.filename, "filename", 255, true);
    if (
      filename === "." ||
      filename === ".." ||
      filename.includes("/") ||
      filename.includes("\\")
    )
      throw new FilestackApiError(
        "provider_validation_error",
        "Filestack filenames must not contain path separators.",
      );
    if (
      !input.contentBase64 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(input.contentBase64) ||
      input.contentBase64.length % 4 !== 0
    )
      throw new FilestackApiError(
        "provider_validation_error",
        "Filestack file content must be canonical base64.",
      );
    const bytes = Buffer.from(input.contentBase64, "base64");
    if (
      bytes.length < 1 ||
      bytes.length > FilestackApiAdapter.MAX_BYTES ||
      bytes.toString("base64") !== input.contentBase64
    )
      throw new FilestackApiError(
        "provider_validation_error",
        "Filestack agent files must be between one byte and five megabytes.",
      );
    const contentType = input.contentType?.trim() || "application/octet-stream";
    if (contentType.length > 200 || /[\r\n]/.test(contentType))
      throw new FilestackApiError(
        "provider_validation_error",
        "Filestack content type is invalid.",
      );
    return { filename, bytes, contentType };
  }

  private handle(value: unknown) {
    return this.identifier(value, "handle", 128);
  }
  private identifier(
    value: unknown,
    label: string,
    max = 128,
    filename = false,
  ) {
    if (
      typeof value !== "string" ||
      value.length < 2 ||
      value.length > max ||
      (!filename && !/^[A-Za-z0-9_-]+$/.test(value)) ||
      /[\u0000-\u001f\u007f]/.test(value)
    )
      throw new FilestackApiError(
        "provider_validation_error",
        `Filestack ${label} is invalid.`,
      );
    return value;
  }

  private taskChain(value: unknown) {
    if (
      typeof value !== "string" ||
      value.length < 1 ||
      value.length > 1_000 ||
      !/^[A-Za-z0-9_=:,./-]+$/.test(value) ||
      value.includes("..") ||
      /security|https?|%/i.test(value)
    )
      throw new FilestackApiError(
        "provider_validation_error",
        "Filestack processing task chain is invalid.",
      );
    return value;
  }

  private requireCredentials(credentials: FilestackCredentials) {
    if (
      !credentials.apiKey ||
      credentials.apiKey.length > 512 ||
      !/^[A-Za-z0-9_-]+$/.test(credentials.apiKey)
    )
      throw new FilestackApiError(
        "credential_missing",
        "Filestack API key is missing or invalid.",
      );
    if (
      !credentials.appSecret ||
      credentials.appSecret.length > 1_024 ||
      /[\r\n]/.test(credentials.appSecret)
    )
      throw new FilestackApiError(
        "credential_missing",
        "Filestack app secret is missing or invalid.",
      );
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
