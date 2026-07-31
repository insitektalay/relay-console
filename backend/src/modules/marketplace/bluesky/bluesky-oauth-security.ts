import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
} from "@nestjs/common";
import {
  createHash,
  createPrivateKey,
  generateKeyPairSync,
  randomUUID,
  sign,
  type JsonWebKey,
} from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { isPublicIpAddress } from "../../../common/security/safe-outbound-http";

const MAX_JSON_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

export type BlueskyDpopKeyPair = {
  privateJwk: JsonWebKey;
  publicJwk: JsonWebKey;
};

export type BlueskySafeFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;
export const BLUESKY_SAFE_FETCH = Symbol("BLUESKY_SAFE_FETCH");

@Injectable()
export class BlueskyOAuthSecurity {
  private readonly fetchImpl?: BlueskySafeFetch;
  constructor(
    @Optional() @Inject(BLUESKY_SAFE_FETCH) fetchImpl?: BlueskySafeFetch,
  ) {
    this.fetchImpl = fetchImpl;
  }

  generateDpopKeyPair(): BlueskyDpopKeyPair {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const privateJwk = privateKey.export({ format: "jwk" });
    const publicJwk = publicKey.export({ format: "jwk" });
    return { privateJwk, publicJwk };
  }

  createDpopProof(input: {
    privateJwk: JsonWebKey;
    publicJwk?: JsonWebKey;
    method: string;
    url: string;
    nonce?: string | null;
    accessToken?: string | null;
    now?: Date;
    jti?: string;
  }) {
    const publicJwk = input.publicJwk ?? this.publicJwk(input.privateJwk);
    const header = {
      typ: "dpop+jwt",
      alg: "ES256",
      jwk: publicJwk,
    };
    const payload: Record<string, unknown> = {
      jti: input.jti ?? randomUUID(),
      htm: input.method.trim().toUpperCase(),
      htu: this.normalizeHtu(input.url),
      iat: Math.floor((input.now ?? new Date()).getTime() / 1000),
    };
    if (input.nonce) payload.nonce = input.nonce;
    if (input.accessToken) {
      payload.ath = createHash("sha256")
        .update(input.accessToken)
        .digest("base64url");
    }
    const encodedHeader = this.base64UrlJson(header);
    const encodedPayload = this.base64UrlJson(payload);
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = sign("sha256", Buffer.from(signingInput), {
      key: createPrivateKey({ key: input.privateJwk, format: "jwk" }),
      dsaEncoding: "ieee-p1363",
    }).toString("base64url");
    return `${signingInput}.${signature}`;
  }

  async fetchJson<T extends Record<string, unknown>>(
    rawUrl: string,
    input: {
      method?: "GET" | "POST";
      headers?: Record<string, string>;
      body?: BodyInit;
      timeoutMs?: number;
      maxRedirects?: number;
    } = {},
  ): Promise<{ url: string; response: Response; body: T }> {
    const method = input.method ?? "GET";
    const timeoutMs = Math.min(
      Math.max(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1_000),
      20_000,
    );
    const maxRedirects = Math.min(Math.max(input.maxRedirects ?? 2, 0), 3);
    let current = await this.assertSafeHttpsUrl(rawUrl);
    for (let redirectCount = 0; ; redirectCount += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await this.performFetch(current, {
          method,
          headers: {
            Accept: "application/json",
            ...(input.headers ?? {}),
          },
          body: input.body,
          redirect: "manual",
          signal: controller.signal,
        });
      } catch {
        throw new BadRequestException("Bluesky discovery request failed");
      } finally {
        clearTimeout(timer);
      }
      if (response.status >= 300 && response.status < 400) {
        if (redirectCount >= maxRedirects) {
          throw new BadRequestException(
            "Bluesky discovery redirect limit exceeded",
          );
        }
        const location = response.headers.get("location");
        if (!location) {
          throw new BadRequestException(
            "Bluesky discovery redirect is missing location",
          );
        }
        current = await this.assertSafeHttpsUrl(
          new URL(location, current).toString(),
        );
        continue;
      }
      if (!response.ok) {
        throw new BadRequestException(
          `Bluesky discovery request failed with status ${response.status}`,
        );
      }
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
        throw new BadRequestException(
          "Bluesky discovery response is too large",
        );
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength > MAX_JSON_BYTES) {
        throw new BadRequestException(
          "Bluesky discovery response is too large",
        );
      }
      let body: unknown;
      try {
        body = JSON.parse(bytes.toString("utf8"));
      } catch {
        throw new BadRequestException("Bluesky discovery response is not JSON");
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new BadRequestException(
          "Bluesky discovery response is not an object",
        );
      }
      return { url: current, response, body: body as T };
    }
  }

  async request(
    rawUrl: string,
    input: {
      method: "GET" | "POST";
      headers?: Record<string, string>;
      body?: BodyInit;
      timeoutMs?: number;
    },
  ) {
    const safeUrl = await this.assertSafeHttpsUrl(rawUrl);
    const controller = new AbortController();
    const timeoutMs = Math.min(
      Math.max(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1_000),
      20_000,
    );
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.performFetch(safeUrl, {
        method: input.method,
        headers: input.headers,
        body: input.body,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch {
      throw new BadRequestException("Bluesky provider request failed");
    } finally {
      clearTimeout(timer);
    }
  }

  async assertSafeHttpsUrl(rawUrl: string) {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestException("Bluesky endpoint URL is invalid");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !url.hostname ||
      isIP(url.hostname) !== 0
    ) {
      throw new BadRequestException(
        "Bluesky endpoint must use a public HTTPS hostname",
      );
    }
    await this.resolvePublic(url.hostname);
    url.hash = "";
    return url.toString();
  }

  normalizeHtu(rawUrl: string) {
    const url = new URL(rawUrl);
    url.hash = "";
    url.search = "";
    if (
      (url.protocol === "https:" && url.port === "443") ||
      (url.protocol === "http:" && url.port === "80")
    ) {
      url.port = "";
    }
    return url.toString();
  }

  private publicJwk(privateJwk: JsonWebKey): JsonWebKey {
    const { d: _private, ...publicJwk } = privateJwk;
    return publicJwk;
  }

  private base64UrlJson(value: unknown) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
  }

  private async performFetch(url: string, init: RequestInit) {
    if (this.fetchImpl) return this.fetchImpl(url, init);
    const target = new URL(url);
    const addresses = await this.resolvePublic(target.hostname);
    const selected = addresses[0];
    const body = this.requestBody(init.body);
    return new Promise<Response>((resolve, reject) => {
      const request = httpsRequest(
        target,
        {
          method: init.method,
          headers: init.headers as Record<string, string>,
          lookup: (_hostname, _options, callback) =>
            callback(null, selected.address, selected.family),
          signal: init.signal ?? undefined,
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_JSON_BYTES) {
              request.destroy(new Error("response too large"));
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () => {
            const headers = new Headers();
            for (const [name, value] of Object.entries(response.headers)) {
              if (Array.isArray(value)) {
                for (const item of value) headers.append(name, item);
              } else if (value !== undefined) {
                headers.set(name, String(value));
              }
            }
            resolve(
              new Response(Buffer.concat(chunks), {
                status: response.statusCode ?? 502,
                statusText: response.statusMessage,
                headers,
              }),
            );
          });
        },
      );
      request.on("error", reject);
      if (body) request.write(body);
      request.end();
    });
  }

  private requestBody(body: BodyInit | null | undefined) {
    if (body === undefined || body === null) return null;
    if (typeof body === "string") return Buffer.from(body);
    if (body instanceof URLSearchParams) return Buffer.from(body.toString());
    if (body instanceof ArrayBuffer) return Buffer.from(body);
    if (ArrayBuffer.isView(body)) {
      return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
    }
    throw new BadRequestException(
      "Bluesky provider request body is unsupported",
    );
  }

  private async resolvePublic(hostname: string) {
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new BadRequestException(
        "Bluesky endpoint hostname did not resolve",
      );
    }
    if (
      !addresses.length ||
      addresses.length > 16 ||
      addresses.some(({ address }) => !isPublicIpAddress(address))
    ) {
      throw new BadRequestException(
        "Bluesky endpoint resolved to a non-public address",
      );
    }
    return addresses;
  }
}
