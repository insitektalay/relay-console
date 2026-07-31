import { randomUUID } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type BoundedRestOperation = {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  pathParameters: readonly string[];
  mutating: boolean;
  bodyAllowed: boolean;
  bodyEncoding?: "json" | "multipart_image_base64" | "json_rpc_method";
  rpcMethod?: string;
  omitAuthorization?: boolean;
  description: string;
};

export type BoundedRestConnector = {
  slug: string;
  name: string;
  baseUrl: string;
  originSubdomain?: {
    credentialName: string;
    suffix: string;
  };
  credentialName?: string;
  authorization?: {
    headerName: string;
    prefix: string;
  };
  basicAuthorization?: {
    usernameCredentialName: string;
    passwordCredentialName?: string;
  };
  headers?: Readonly<Record<string, string>>;
  credentialHeaders?: ReadonlyArray<{
    headerName: string;
    credentialName: string;
    prefix?: string;
  }>;
  maxArrayItems?: number;
  pathCredentials?: ReadonlyArray<{
    placeholder: string;
    credentialName: string;
  }>;
  operations: readonly BoundedRestOperation[];
  health: {
    operationId: string;
    input?: BoundedRestOperationInput;
    acceptedStatusCodes?: readonly number[];
  };
};

export type BoundedRestOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
  json?: unknown;
};

export class BoundedRestApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

/**
 * Executes only provider-reviewed operations from immutable registries. It is
 * deliberately not a raw HTTP proxy: origins, methods and paths are pinned,
 * redirects fail closed, credentials stay server-side, and payloads are
 * bounded and redacted before they cross the runtime bridge.
 */
export class BoundedRestApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(
    config: BoundedRestConnector,
    stored: Record<string, unknown> | null | undefined,
  ) {
    try {
      return await this.execute(
        config,
        stored,
        "read",
        config.health.operationId,
        config.health.input ?? {},
      );
    } catch (error) {
      if (
        error instanceof BoundedRestApiError &&
        error.statusCode !== undefined &&
        error.statusCode >= 400 &&
        error.statusCode < 500 &&
        ![401, 403, 407, 429].includes(error.statusCode) &&
        config.health.acceptedStatusCodes?.includes(error.statusCode)
      ) {
        return {
          verified: true,
          acceptedStatusCode: error.statusCode,
        };
      }
      throw error;
    }
  }

  async execute(
    config: BoundedRestConnector,
    stored: Record<string, unknown> | null | undefined,
    mode: "read" | "manage",
    operationId: string,
    input: BoundedRestOperationInput,
  ) {
    const operation = config.operations.find((item) => item.id === operationId);
    if (!operation)
      throw this.invalid(
        `${config.name} operation is not in Relay's pinned provider contract.`,
      );
    if ((mode === "manage") !== operation.mutating)
      throw this.invalid(
        `${config.name} ${mode} cannot execute this operation class.`,
      );
    return await this.request(config, stored, operation, input);
  }

  private async request(
    config: BoundedRestConnector,
    stored: Record<string, unknown> | null | undefined,
    operation: BoundedRestOperation,
    input: BoundedRestOperationInput,
  ) {
    this.rejectCredentialFields(
      input,
      config.name,
      0,
      config.maxArrayItems ?? 2_000,
    );
    let path = operation.path;
    for (const binding of config.pathCredentials ?? []) {
      if (!path.includes(`{${binding.placeholder}}`)) continue;
      const value = this.credential(stored, config, binding.credentialName);
      if (value.length > 500)
        throw this.invalid(`${config.name} path credential is too long.`);
      path = path.replaceAll(
        `{${binding.placeholder}}`,
        encodeURIComponent(value),
      );
    }
    const pathParameters = input.pathParameters ?? {};
    this.exactPathKeys(pathParameters, operation.pathParameters, config.name);
    for (const name of operation.pathParameters) {
      path = path.replaceAll(
        `{${name}}`,
        encodeURIComponent(
          this.segment(pathParameters[name], name, config.name),
        ),
      );
    }
    if (/\{[^}]+\}/.test(path) || path.includes("..") || path.includes("://"))
      throw new BoundedRestApiError(
        "policy_blocked",
        `${config.name} request escaped the pinned provider route.`,
        403,
      );
    const root = this.root(config, stored);
    const url = new URL(path.replace(/^\/+/, ""), root);
    this.appendQuery(url.searchParams, input.query, config.name);
    if (
      url.protocol !== "https:" ||
      url.origin !== root.origin ||
      !url.pathname.startsWith(root.pathname) ||
      url.username ||
      url.password ||
      url.port
    )
      throw new BoundedRestApiError(
        "policy_blocked",
        `${config.name} request must stay on its pinned HTTPS API origin.`,
        403,
      );
    let body: BodyInit | undefined;
    let contentType: string | undefined;
    const requiresRpcBody = operation.bodyEncoding === "json_rpc_method";
    if (
      requiresRpcBody &&
      !/^[A-Za-z][A-Za-z0-9]{0,99}$/.test(operation.rpcMethod ?? "")
    )
      throw this.invalid(`${config.name} RPC method binding is invalid.`);
    if ((input.json !== undefined || requiresRpcBody) && !operation.bodyAllowed)
      throw this.invalid(
        `${config.name} operation does not accept a JSON body.`,
      );
    if (input.json !== undefined || requiresRpcBody) {
      if (operation.bodyEncoding === "multipart_image_base64") {
        body = this.multipartImage(input.json, config.name);
      } else {
        const serialized = JSON.stringify(
          operation.bodyEncoding === "json_rpc_method"
            ? {
                method: operation.rpcMethod,
                params: input.json ?? {},
                id: randomUUID(),
              }
            : input.json,
        );
        if (Buffer.byteLength(serialized, "utf8") > 2_000_000)
          throw this.invalid(
            `${config.name} request exceeds Relay's 2 MB limit.`,
          );
        body = serialized;
        contentType = "application/json";
      }
    }
    if (config.authorization && config.basicAuthorization)
      throw this.invalid(`${config.name} authorization binding is ambiguous.`);
    const credential =
      config.authorization && !operation.omitAuthorization
        ? this.credential(stored, config, config.credentialName)
        : null;
    const basicAuthorization = config.basicAuthorization
      ? Buffer.from(
          `${this.credential(
            stored,
            config,
            config.basicAuthorization.usernameCredentialName,
          )}:${config.basicAuthorization.passwordCredentialName ? this.credential(stored, config, config.basicAuthorization.passwordCredentialName) : ""}`,
          "utf8",
        ).toString("base64")
      : null;
    let response: Response;
    const credentialHeaders = Object.fromEntries(
      (config.credentialHeaders ?? []).map((binding) => [
        binding.headerName,
        `${binding.prefix ?? ""}${this.credential(
          stored,
          config,
          binding.credentialName,
        )}`,
      ]),
    );
    try {
      response = await this.requester(url, {
        method: operation.method,
        headers: {
          Accept: "application/json",
          ...(config.authorization && credential
            ? {
                [config.authorization.headerName]:
                  `${config.authorization.prefix}${credential}`,
              }
            : {}),
          ...(basicAuthorization
            ? { Authorization: `Basic ${basicAuthorization}` }
            : {}),
          ...(config.headers ?? {}),
          ...credentialHeaders,
          ...(contentType ? { "Content-Type": contentType } : {}),
          "User-Agent": `RelayConsole-${config.slug}/1.0 (https://relayconsole.work)`,
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(
          operation.method === "GET" ? 20_000 : 30_000,
        ),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof BoundedRestApiError) throw error;
      throw new BoundedRestApiError(
        "provider_unavailable",
        `${config.name} could not be reached.`,
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid(
        `${config.name} response exceeds Relay's 2.5 MB limit.`,
      );
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new BoundedRestApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `${config.name} returned HTTP ${response.status}.`,
        response.status,
      );
    if (
      operation.bodyEncoding === "json_rpc_method" &&
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      (data as JsonObject).error !== null &&
      (data as JsonObject).error !== undefined
    )
      throw new BoundedRestApiError(
        "provider_validation_error",
        this.errorMessage(data) ?? `${config.name} rejected the RPC request.`,
        400,
      );
    return data;
  }

  private root(
    config: BoundedRestConnector,
    stored: Record<string, unknown> | null | undefined,
  ) {
    let root: URL;
    try {
      root = new URL(
        config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`,
      );
    } catch {
      throw this.invalid(`${config.name} API origin is invalid.`);
    }
    if (
      root.protocol !== "https:" ||
      root.username ||
      root.password ||
      root.port ||
      root.search ||
      root.hash
    )
      throw this.invalid(`${config.name} API origin must be pinned HTTPS.`);
    if (config.originSubdomain) {
      const suffix = config.originSubdomain.suffix.toLowerCase();
      if (
        !/^[a-z0-9.-]+$/.test(suffix) ||
        suffix.startsWith(".") ||
        suffix.endsWith(".")
      )
        throw this.invalid(`${config.name} API suffix is invalid.`);
      const subdomain = this.credential(
        stored,
        config,
        config.originSubdomain.credentialName,
      )
        .trim()
        .toLowerCase();
      if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain))
        throw this.invalid(`${config.name} account subdomain is invalid.`);
      root.hostname = `${subdomain}.${suffix}`;
    }
    return root;
  }

  private credential(
    stored: Record<string, unknown> | null | undefined,
    config: BoundedRestConnector,
    credentialName: string | undefined,
  ) {
    if (!credentialName)
      throw this.invalid(`${config.name} credential binding is invalid.`);
    const value = stored?.[credentialName];
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > 16_000 || /[\r\n]/.test(text))
      throw new BoundedRestApiError(
        "credential_missing",
        `A valid ${config.name} credential is required.`,
        401,
      );
    return text;
  }

  private appendQuery(
    params: URLSearchParams,
    value: JsonObject | undefined,
    provider: string,
  ) {
    if (!value) return;
    const entries = Object.entries(value);
    if (entries.length > 50)
      throw this.invalid(`${provider} query contains too many fields.`);
    for (const [name, raw] of entries) {
      if (!/^[A-Za-z][A-Za-z0-9_.\[\]-]{0,99}$/.test(name))
        throw this.invalid(`${provider} query parameter ${name} is invalid.`);
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length > 100)
        throw this.invalid(`${provider} query ${name} has too many values.`);
      for (const item of values) {
        if (item === null || item === undefined || item === "") continue;
        if (typeof item === "object")
          throw this.invalid(`${provider} query ${name} must be scalar.`);
        const text = String(item);
        if (text.length > 2_000 || /[\r\n]/.test(text))
          throw this.invalid(`${provider} query ${name} is invalid.`);
        if (
          /^(limit|per_?page|page_?size|count)$/i.test(name) &&
          (!/^\d+$/.test(text) || Number(text) > 100)
        )
          throw this.invalid(`${provider} page sizes are limited to 100.`);
        params.append(name, text);
      }
    }
  }

  private multipartImage(value: unknown, provider: string): FormData {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw this.invalid(
        `${provider} image upload must be an object with contentBase64.`,
      );
    const record = value as JsonObject;
    const keys = Object.keys(record);
    const allowed = ["contentBase64", "fileName", "mimeType"];
    if (keys.some((key) => !allowed.includes(key)))
      throw this.invalid(`${provider} image upload contains an unknown field.`);
    const contentBase64 =
      typeof record.contentBase64 === "string" ? record.contentBase64 : "";
    if (
      !contentBase64 ||
      contentBase64.length > 2_100_000 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        contentBase64,
      )
    )
      throw this.invalid(`${provider} image content must be valid base64.`);
    const bytes = Buffer.from(contentBase64, "base64");
    if (!bytes.length || bytes.byteLength > 1_500_000)
      throw this.invalid(`${provider} image must be at most 1.5 MB.`);
    const mimeType =
      typeof record.mimeType === "string" ? record.mimeType : "image/png";
    if (
      !new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]).has(
        mimeType,
      )
    )
      throw this.invalid(`${provider} image type is not supported.`);
    const signatures: Record<string, (input: Buffer) => boolean> = {
      "image/gif": (input) =>
        input.subarray(0, 6).toString("ascii") === "GIF87a" ||
        input.subarray(0, 6).toString("ascii") === "GIF89a",
      "image/jpeg": (input) => input[0] === 0xff && input[1] === 0xd8,
      "image/png": (input) =>
        input.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")),
      "image/webp": (input) =>
        input.subarray(0, 4).toString("ascii") === "RIFF" &&
        input.subarray(8, 12).toString("ascii") === "WEBP",
    };
    if (!signatures[mimeType](bytes))
      throw this.invalid(`${provider} image content does not match its type.`);
    const defaultExtension =
      mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
    const fileName =
      typeof record.fileName === "string"
        ? record.fileName
        : `upload.${defaultExtension}`;
    if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}$/.test(fileName))
      throw this.invalid(`${provider} image file name is invalid.`);
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mimeType }), fileName);
    if (typeof record.fileName === "string") form.append("file_name", fileName);
    return form;
  }

  private exactPathKeys(
    value: JsonObject,
    allowed: readonly string[],
    provider: string,
  ) {
    const keys = Object.keys(value);
    if (
      keys.length !== allowed.length ||
      keys.some((key) => !allowed.includes(key))
    )
      throw this.invalid(
        `${provider} path parameters must exactly match the selected operation.`,
      );
  }

  private segment(value: unknown, name: string, provider: string) {
    const text = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_.:@+-]{1,200}$/.test(text))
      throw this.invalid(`${provider} ${name} path parameter is invalid.`);
    return text;
  }

  private rejectCredentialFields(
    value: unknown,
    provider: string,
    depth = 0,
    maxArrayItems = 2_000,
  ) {
    if (depth > 12)
      throw new BoundedRestApiError(
        "policy_blocked",
        `${provider} request is too deeply nested.`,
        403,
      );
    if (Array.isArray(value)) {
      if (value.length > maxArrayItems)
        throw this.invalid(
          `${provider} request contains too many array items.`,
        );
      value.forEach((item) =>
        this.rejectCredentialFields(item, provider, depth + 1, maxArrayItems),
      );
      return;
    }
    if (!value || typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 2_000)
      throw this.invalid(`${provider} request contains too many fields.`);
    for (const [key, item] of entries) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key|signed.?url)/i.test(
          key,
        )
      )
        throw new BoundedRestApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      this.rejectCredentialFields(item, provider, depth + 1, maxArrayItems);
    }
  }

  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return { message: raw.toString("utf8").slice(0, 2_000) };
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 2_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key|signed.?url)/i.test(
            key,
          )
            ? "[REDACTED]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object") return null;
    const record = value as JsonObject;
    for (const candidate of [record.message, record.error, record.detail]) {
      if (typeof candidate === "string" && candidate.trim())
        return candidate.trim().slice(0, 1_000);
      if (candidate && typeof candidate === "object") {
        const nested = this.errorMessage(candidate);
        if (nested) return nested;
      }
    }
    return null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 409 || status === 422) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private invalid(message: string) {
    return new BoundedRestApiError("provider_validation_error", message, 400);
  }
}
