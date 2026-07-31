import { Injectable } from "@nestjs/common";
import { createHash, createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import type { LookupAddress } from "node:dns";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import { isPublicIpAddress } from "../../../../common/security/safe-outbound-http";

type JsonObject = Record<string, unknown>;
type TresoritOperation =
  | "listBuckets"
  | "listObjects"
  | "headObject"
  | "getObject"
  | "createBucket"
  | "deleteBucket"
  | "putObject"
  | "deleteObject"
  | "deleteObjects";

export type TresoritCredentials = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type SignedRequest = {
  url: URL;
  method: "GET" | "HEAD" | "PUT" | "DELETE" | "POST";
  headers: Record<string, string>;
  body?: Buffer;
};

type RawResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
};

export class TresoritS3Error extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class TresoritS3Adapter {
  health(credentials: TresoritCredentials) {
    return this.execute(credentials, "listBuckets", { maxKeys: 1 });
  }

  async read(
    credentials: TresoritCredentials,
    operation: string,
    input: JsonObject,
  ) {
    if (!this.isReadOperation(operation))
      throw new TresoritS3Error(
        "policy_blocked",
        "Tresorit read tools cannot run a mutating operation.",
        403,
      );
    return this.execute(credentials, operation, input);
  }

  async manage(
    credentials: TresoritCredentials,
    operation: string,
    input: JsonObject,
  ) {
    if (!this.isWriteOperation(operation))
      throw new TresoritS3Error(
        "policy_blocked",
        "Tresorit management tools require a documented mutating operation.",
        403,
      );
    return this.execute(credentials, operation, input);
  }

  normalizeEndpoint(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new TresoritS3Error(
        "provider_validation_error",
        "Tresorit gateway URL is invalid.",
      );
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !hostname ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      (isIP(hostname) !== 0 && !isPublicIpAddress(hostname))
    ) {
      throw new TresoritS3Error(
        "policy_blocked",
        "Tresorit requires a public HTTPS gateway URL without embedded credentials, query parameters, or a private host.",
        403,
      );
    }
    const pathname = url.pathname.replace(/\/+$/, "");
    url.pathname = pathname || "/";
    return url.toString().replace(/\/$/, "");
  }

  buildSignedRequest(
    credentials: TresoritCredentials,
    operation: TresoritOperation,
    input: JsonObject,
    now = new Date(),
  ): SignedRequest {
    this.requireCredentials(credentials);
    const endpoint = new URL(
      `${this.normalizeEndpoint(credentials.endpoint)}/`,
    );
    const bucket = this.optionalBucket(input.bucket);
    const key = this.optionalKey(input.key);
    let method: SignedRequest["method"] = "GET";
    let path = "/";
    const query = new URLSearchParams();
    let body: Buffer | undefined;
    const extraHeaders: Record<string, string> = {};

    if (operation !== "listBuckets") {
      if (!bucket)
        throw new TresoritS3Error(
          "provider_validation_error",
          "Tresorit main folder is required.",
        );
      path = `/${this.encodePath(bucket)}`;
    }
    if (
      ["headObject", "getObject", "putObject", "deleteObject"].includes(
        operation,
      )
    ) {
      if (!key)
        throw new TresoritS3Error(
          "provider_validation_error",
          "Tresorit file path is required.",
        );
      path += `/${this.encodePath(key)}`;
    }

    switch (operation) {
      case "listBuckets":
        break;
      case "listObjects":
        query.set("list-type", "2");
        query.set("max-keys", String(this.integer(input.maxKeys, 50, 1, 100)));
        if (typeof input.prefix === "string" && input.prefix)
          query.set("prefix", this.key(input.prefix, "prefix"));
        break;
      case "headObject":
        method = "HEAD";
        break;
      case "getObject":
        break;
      case "createBucket":
        method = "PUT";
        body = Buffer.alloc(0);
        break;
      case "deleteBucket":
        method = "DELETE";
        break;
      case "putObject": {
        method = "PUT";
        body = this.file(input.fileBase64);
        extraHeaders["content-type"] = this.contentType(input.contentType);
        extraHeaders["content-length"] = String(body.length);
        break;
      }
      case "deleteObject":
        method = "DELETE";
        break;
      case "deleteObjects": {
        method = "POST";
        query.set("delete", "");
        const keys = this.keys(input.keys);
        body = Buffer.from(
          `<Delete>${keys.map((item) => `<Object><Key>${this.escapeXml(item)}</Key></Object>`).join("")}<Quiet>true</Quiet></Delete>`,
          "utf8",
        );
        extraHeaders["content-type"] = "application/xml";
        extraHeaders["content-md5"] = createHash("md5")
          .update(body)
          .digest("base64");
        extraHeaders["content-length"] = String(body.length);
        break;
      }
    }

    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}${path}`;
    endpoint.search = this.canonicalQuery(query);
    const payloadHash = createHash("sha256")
      .update(body ?? Buffer.alloc(0))
      .digest("hex");
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const headers: Record<string, string> = {
      host: endpoint.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      ...extraHeaders,
    };
    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames
      .map((name) => `${name}:${headers[name].trim().replace(/\s+/g, " ")}\n`)
      .join("");
    const signedHeaders = signedHeaderNames.join(";");
    const canonicalRequest = [
      method,
      endpoint.pathname,
      endpoint.searchParams.size ? endpoint.search.slice(1) : "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const scope = `${dateStamp}/us-east-1/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");
    const signingKey = this.hmac(
      this.hmac(
        this.hmac(
          this.hmac(`AWS4${credentials.secretAccessKey}`, dateStamp),
          "us-east-1",
        ),
        "s3",
      ),
      "aws4_request",
    );
    const signature = createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");
    headers.authorization =
      `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return { url: endpoint, method, headers, body };
  }

  private async execute(
    credentials: TresoritCredentials,
    operation: TresoritOperation,
    input: JsonObject,
  ) {
    const response = await this.sendSigned(
      this.buildSignedRequest(credentials, operation, input),
    );
    if (response.status < 200 || response.status >= 300) {
      const message = this.xmlValue(response.body.toString("utf8"), "Message");
      throw new TresoritS3Error(
        this.safeCode(response.status),
        message?.slice(0, 500) ?? `Tresorit returned HTTP ${response.status}.`,
        response.status,
      );
    }
    if (operation === "getObject") {
      return {
        fileBase64: response.body.toString("base64"),
        size: response.body.length,
        contentType: this.header(response.headers, "content-type"),
        etag: this.header(response.headers, "etag"),
        lastModified: this.header(response.headers, "last-modified"),
      };
    }
    if (operation === "headObject") {
      return {
        size: Number(this.header(response.headers, "content-length") ?? 0),
        contentType: this.header(response.headers, "content-type"),
        etag: this.header(response.headers, "etag"),
        lastModified: this.header(response.headers, "last-modified"),
      };
    }
    if (operation === "listBuckets") return this.parseBuckets(response.body);
    if (operation === "listObjects") return this.parseObjects(response.body);
    return {
      status: "completed",
      etag: this.header(response.headers, "etag"),
      versionId: this.header(response.headers, "x-amz-version-id"),
    };
  }

  private async sendSigned(request: SignedRequest): Promise<RawResponse> {
    const address = await this.resolvePublicAddress(request.url.hostname);
    return await new Promise<RawResponse>((resolve, reject) => {
      const req = httpsRequest(
        request.url,
        {
          method: request.method,
          headers: request.headers,
          timeout: 20_000,
          servername: request.url.hostname,
          lookup: (_hostname, _options, callback) =>
            callback(null, address.address, address.family),
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 5_000_000) {
              req.destroy(
                new TresoritS3Error(
                  "provider_validation_error",
                  "Tresorit response exceeds Relay's five-megabyte limit.",
                ),
              );
            } else chunks.push(chunk);
          });
          response.on("end", () =>
            resolve({
              status: response.statusCode ?? 502,
              headers: response.headers,
              body: Buffer.concat(chunks),
            }),
          );
        },
      );
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", (error) =>
        reject(
          error instanceof TresoritS3Error
            ? error
            : new TresoritS3Error(
                "provider_unavailable",
                "The Tresorit gateway could not be reached.",
                502,
              ),
        ),
      );
      if (request.body) req.write(request.body);
      req.end();
    });
  }

  private async resolvePublicAddress(hostname: string): Promise<LookupAddress> {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (
      !addresses.length ||
      addresses.length > 16 ||
      addresses.some((candidate) => !isPublicIpAddress(candidate.address))
    )
      throw new TresoritS3Error(
        "policy_blocked",
        "The Tresorit gateway must resolve only to public network addresses.",
        403,
      );
    return addresses[0];
  }

  private requireCredentials(credentials: TresoritCredentials) {
    this.normalizeEndpoint(credentials.endpoint);
    if (
      !credentials.accessKeyId?.trim() ||
      credentials.accessKeyId.length > 1_000 ||
      !credentials.secretAccessKey?.trim() ||
      credentials.secretAccessKey.length > 4_000
    )
      throw new TresoritS3Error(
        "credential_missing",
        "Tresorit gateway URL, access key ID, and secret access key are required.",
        401,
      );
  }

  private isReadOperation(value: string): value is TresoritOperation {
    return ["listBuckets", "listObjects", "headObject", "getObject"].includes(
      value,
    );
  }

  private isWriteOperation(value: string): value is TresoritOperation {
    return [
      "createBucket",
      "deleteBucket",
      "putObject",
      "deleteObject",
      "deleteObjects",
    ].includes(value);
  }

  private optionalBucket(value: unknown) {
    return value === undefined ? null : this.bucket(value);
  }

  private bucket(value: unknown) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.length > 200 ||
      /[\0/\\]/.test(value)
    )
      throw new TresoritS3Error(
        "provider_validation_error",
        "Tresorit main folder name is invalid.",
      );
    return value.trim();
  }

  private optionalKey(value: unknown) {
    return value === undefined ? null : this.key(value, "key");
  }

  private key(value: unknown, name: string) {
    if (
      typeof value !== "string" ||
      !value ||
      value.length > 1_024 ||
      value.includes("\0") ||
      value.split("/").some((segment) => segment === "." || segment === "..")
    )
      throw new TresoritS3Error(
        "provider_validation_error",
        `Tresorit ${name} is invalid.`,
      );
    return value;
  }

  private keys(value: unknown) {
    if (!Array.isArray(value) || !value.length || value.length > 100)
      throw new TresoritS3Error(
        "provider_validation_error",
        "Tresorit bulk deletion requires between one and 100 file paths.",
      );
    const result = value.map((item) => this.key(item, "file path"));
    if (new Set(result).size !== result.length)
      throw new TresoritS3Error(
        "provider_validation_error",
        "Tresorit bulk deletion contains duplicate file paths.",
      );
    return result;
  }

  private file(value: unknown) {
    if (
      typeof value !== "string" ||
      !value ||
      value.length > 7_000_000 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
    )
      throw new TresoritS3Error(
        "provider_validation_error",
        "Tresorit fileBase64 is invalid.",
      );
    const bytes = Buffer.from(value, "base64");
    if (!bytes.length || bytes.length > 5_000_000)
      throw new TresoritS3Error(
        "provider_validation_error",
        "Tresorit uploads must be between one byte and five megabytes.",
      );
    return bytes;
  }

  private contentType(value: unknown) {
    if (value === undefined) return "application/octet-stream";
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.length > 200 ||
      /[\r\n]/.test(value)
    )
      throw new TresoritS3Error(
        "provider_validation_error",
        "Tresorit content type is invalid.",
      );
    return value.trim();
  }

  private integer(value: unknown, fallback: number, min: number, max: number) {
    const number = Number(value ?? fallback);
    return Number.isSafeInteger(number) && number >= min && number <= max
      ? number
      : fallback;
  }

  private encodePath(value: string) {
    return value
      .split("/")
      .map((segment) =>
        encodeURIComponent(segment).replace(
          /[!'()*]/g,
          (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
        ),
      )
      .join("/");
  }

  private canonicalQuery(query: URLSearchParams) {
    return [...query.entries()]
      .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey === rightKey
          ? leftValue.localeCompare(rightValue)
          : leftKey.localeCompare(rightKey),
      )
      .map(
        ([key, value]) =>
          `${this.encodeQueryComponent(key)}=${this.encodeQueryComponent(value)}`,
      )
      .join("&");
  }

  private encodeQueryComponent(value: string) {
    return encodeURIComponent(value).replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }

  private hmac(key: string | Buffer, value: string) {
    return createHmac("sha256", key).update(value).digest();
  }

  private parseBuckets(body: Buffer) {
    const xml = body.toString("utf8");
    const buckets = [...xml.matchAll(/<Bucket>([\s\S]*?)<\/Bucket>/g)]
      .slice(0, 100)
      .map((match) => ({
        name: this.xmlValue(match[1], "Name"),
        creationDate: this.xmlValue(match[1], "CreationDate"),
      }));
    return { buckets };
  }

  private parseObjects(body: Buffer) {
    const xml = body.toString("utf8");
    const objects = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)]
      .slice(0, 100)
      .map((match) => ({
        key: this.xmlValue(match[1], "Key"),
        size: Number(this.xmlValue(match[1], "Size") ?? 0),
        etag: this.xmlValue(match[1], "ETag"),
        lastModified: this.xmlValue(match[1], "LastModified"),
      }));
    return {
      name: this.xmlValue(xml, "Name"),
      prefix: this.xmlValue(xml, "Prefix"),
      truncated: this.xmlValue(xml, "IsTruncated") === "true",
      nextContinuationToken: this.xmlValue(xml, "NextContinuationToken"),
      objects,
    };
  }

  private xmlValue(xml: string, name: string) {
    const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
    return match ? this.decodeXml(match[1]) : null;
  }

  private decodeXml(value: string) {
    return value
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  private escapeXml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private header(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ) {
    const value = headers[name];
    return Array.isArray(value) ? value[0] : (value ?? null);
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 409) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
