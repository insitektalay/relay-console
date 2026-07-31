import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const SENSITIVE_FORWARD_HEADERS = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "x-api-key",
]);
const BLOCKED_HOST_SUFFIXES = [
  ".internal",
  ".invalid",
  ".lan",
  ".local",
  ".localhost",
  ".test",
];

export class SafeOutboundHttpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeOutboundHttpError";
  }
}

export interface SafeResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface SafeTransportRequest {
  url: URL;
  address: SafeResolvedAddress;
  headers: Record<string, string>;
  timeoutMs: number;
  method?: string;
  body?: Buffer;
  signal?: AbortSignal;
}

export interface SafeTransportResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array>;
  cancel: (reason?: Error) => void;
}

export type SafeResolver = (hostname: string) => Promise<SafeResolvedAddress[]>;

export type SafeTransport = (
  request: SafeTransportRequest,
) => Promise<SafeTransportResponse>;

export interface SafeTextRequestOptions {
  headers?: Record<string, string>;
  maxBytes: number;
  maxEncodedBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
  allowedContentTypes?: RegExp;
  allowedHosts?: readonly string[];
}

export interface SafeTextResponse {
  url: string;
  status: number;
  contentType: string;
  text: string;
  decodedBytes: number;
}

export interface SafeBufferRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: Buffer;
  maxRequestBytes: number;
  maxResponseBytes: number;
  maxEncodedResponseBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
  allowedHosts?: readonly string[];
  signal?: AbortSignal;
}

export interface SafeBufferResponse {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

class Semaphore {
  private available: number;
  private readonly waiters: Array<() => void> = [];

  constructor(limit: number) {
    this.available = limit;
  }

  async acquire(signal?: AbortSignal) {
    if (this.available > 0) {
      this.available -= 1;
      return;
    }
    if (signal?.aborted) {
      throw new SafeOutboundHttpError("Outbound request was aborted");
    }
    await new Promise<void>((resolve, reject) => {
      const waiter = () => {
        signal?.removeEventListener("abort", abort);
        resolve();
      };
      const abort = () => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(new SafeOutboundHttpError("Outbound request was aborted"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      this.waiters.push(waiter);
    });
  }

  release() {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter();
      return;
    }
    this.available += 1;
  }
}

export class SafeOutboundHttpClient {
  private readonly semaphore: Semaphore;

  constructor(
    private readonly resolver: SafeResolver = resolveHostname,
    private readonly transport: SafeTransport = nodeHttpsTransport,
    maxConcurrency = 8,
  ) {
    if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
      throw new Error("maxConcurrency must be a positive integer");
    }
    this.semaphore = new Semaphore(maxConcurrency);
  }

  async getText(
    input: string,
    options: SafeTextRequestOptions,
  ): Promise<SafeTextResponse> {
    assertPositiveLimit(options.maxBytes, "maxBytes");
    await this.semaphore.acquire();
    try {
      return await this.getTextWithRedirects(input, options);
    } finally {
      this.semaphore.release();
    }
  }

  async requestBuffer(
    input: string,
    options: SafeBufferRequestOptions,
  ): Promise<SafeBufferResponse> {
    assertPositiveLimit(options.maxRequestBytes, "maxRequestBytes");
    assertPositiveLimit(options.maxResponseBytes, "maxResponseBytes");
    if (options.body && options.body.byteLength > options.maxRequestBytes) {
      throw new SafeOutboundHttpError("Outbound request exceeds byte limit");
    }
    if (options.signal?.aborted) {
      throw new SafeOutboundHttpError("Outbound request was aborted");
    }
    await this.semaphore.acquire(options.signal);
    try {
      return await this.requestBufferWithRedirects(input, options);
    } finally {
      this.semaphore.release();
    }
  }

  private async getTextWithRedirects(
    input: string,
    options: SafeTextRequestOptions,
  ): Promise<SafeTextResponse> {
    const maxRedirects = options.maxRedirects ?? 3;
    const timeoutMs = options.timeoutMs ?? 15_000;
    let current = parseAndValidateUrl(input, options.allowedHosts);
    let headers = normalizeHeaders(options.headers ?? {});

    for (let redirectCount = 0; ; redirectCount += 1) {
      const addresses = await this.resolveAndValidate(current);
      const selected = addresses[0];
      const response = await this.transport({
        url: current,
        address: selected,
        headers,
        timeoutMs,
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = firstHeader(response.headers.location);
        response.cancel();
        if (!location) {
          throw new SafeOutboundHttpError(
            `Redirect from ${redactedUrl(current)} omitted Location`,
          );
        }
        if (redirectCount >= maxRedirects) {
          throw new SafeOutboundHttpError("Outbound redirect limit exceeded");
        }
        const next = parseAndValidateUrl(
          new URL(location, current).toString(),
          options.allowedHosts,
        );
        if (next.origin !== current.origin) {
          headers = Object.fromEntries(
            Object.entries(headers).filter(
              ([name]) => !SENSITIVE_FORWARD_HEADERS.has(name),
            ),
          );
        }
        current = next;
        continue;
      }

      if (response.status < 200 || response.status >= 300) {
        response.cancel();
        throw new SafeOutboundHttpError(
          `HTTP ${response.status} from ${redactedUrl(current)}`,
        );
      }

      const contentType =
        firstHeader(response.headers["content-type"]) ?? "unknown";
      if (
        options.allowedContentTypes &&
        !options.allowedContentTypes.test(contentType)
      ) {
        response.cancel();
        throw new SafeOutboundHttpError(
          `Unsupported response content type: ${contentType.slice(0, 120)}`,
        );
      }

      const maxEncodedBytes =
        options.maxEncodedBytes ?? options.maxBytes + 64 * 1024;
      const contentLength = parseContentLength(
        firstHeader(response.headers["content-length"]),
      );
      if (contentLength !== null && contentLength > maxEncodedBytes) {
        response.cancel();
        throw new SafeOutboundHttpError("Outbound response exceeds byte limit");
      }
      const encoding =
        firstHeader(response.headers["content-encoding"]) ?? "identity";
      const bodyTimeout = setTimeout(
        () =>
          response.cancel(
            new SafeOutboundHttpError("Outbound response timed out"),
          ),
        timeoutMs,
      );
      let body: Buffer;
      try {
        body = await readBoundedDecodedBody(
          response.body,
          encoding,
          options.maxBytes,
          maxEncodedBytes,
          response.cancel,
        );
      } finally {
        clearTimeout(bodyTimeout);
      }
      return {
        url: current.toString(),
        status: response.status,
        contentType,
        text: body.toString("utf8"),
        decodedBytes: body.byteLength,
      };
    }
  }

  private async requestBufferWithRedirects(
    input: string,
    options: SafeBufferRequestOptions,
  ): Promise<SafeBufferResponse> {
    const maxRedirects = options.maxRedirects ?? 0;
    const timeoutMs = options.timeoutMs ?? 20_000;
    let current = parseAndValidateUrl(input, options.allowedHosts);
    let headers = normalizeHeaders(options.headers ?? {});
    let method = (options.method ?? "GET").toUpperCase();
    let requestBody = options.body;
    if (!/^[A-Z]{3,12}$/.test(method)) {
      throw new SafeOutboundHttpError("Outbound HTTP method is invalid");
    }
    if (method === "GET" || method === "HEAD") requestBody = undefined;
    if (requestBody && headers["content-length"] === undefined) {
      headers["content-length"] = String(requestBody.byteLength);
    }

    for (let redirectCount = 0; ; redirectCount += 1) {
      if (options.signal?.aborted) {
        throw new SafeOutboundHttpError("Outbound request was aborted");
      }
      const addresses = await this.resolveAndValidate(current);
      const response = await this.transport({
        url: current,
        address: addresses[0],
        headers,
        timeoutMs,
        method,
        body: requestBody,
        signal: options.signal,
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = firstHeader(response.headers.location);
        response.cancel();
        if (!location) {
          throw new SafeOutboundHttpError(
            `Redirect from ${redactedUrl(current)} omitted Location`,
          );
        }
        if (redirectCount >= maxRedirects) {
          throw new SafeOutboundHttpError("Outbound redirect is not permitted");
        }
        const next = parseAndValidateUrl(
          new URL(location, current).toString(),
          options.allowedHosts,
        );
        if (next.origin !== current.origin) {
          headers = Object.fromEntries(
            Object.entries(headers).filter(
              ([name]) => !SENSITIVE_FORWARD_HEADERS.has(name),
            ),
          );
        }
        if (
          response.status === 303 ||
          ((response.status === 301 || response.status === 302) &&
            method === "POST")
        ) {
          method = "GET";
          requestBody = undefined;
          delete headers["content-length"];
          delete headers["content-type"];
        }
        current = next;
        continue;
      }

      const maxEncodedBytes =
        options.maxEncodedResponseBytes ?? options.maxResponseBytes + 64 * 1024;
      const contentLength = parseContentLength(
        firstHeader(response.headers["content-length"]),
      );
      if (contentLength !== null && contentLength > maxEncodedBytes) {
        response.cancel();
        throw new SafeOutboundHttpError("Outbound response exceeds byte limit");
      }
      const encoding =
        firstHeader(response.headers["content-encoding"]) ?? "identity";
      const bodyTimeout = setTimeout(
        () =>
          response.cancel(
            new SafeOutboundHttpError("Outbound response timed out"),
          ),
        timeoutMs,
      );
      let body: Buffer;
      try {
        body = await readBoundedDecodedBody(
          response.body,
          encoding,
          options.maxResponseBytes,
          maxEncodedBytes,
          response.cancel,
        );
      } finally {
        clearTimeout(bodyTimeout);
      }
      return {
        url: current.toString(),
        status: response.status,
        headers: flattenHeaders(response.headers),
        body,
      };
    }
  }

  private async resolveAndValidate(url: URL) {
    const hostname = normalizeHostname(url.hostname);
    const literalFamily = isIP(hostname);
    const addresses = literalFamily
      ? [{ address: hostname, family: literalFamily as 4 | 6 }]
      : await this.resolver(hostname);
    if (addresses.length === 0 || addresses.length > 16) {
      throw new SafeOutboundHttpError("Destination DNS result is invalid");
    }
    const deduped = [
      ...new Map(
        addresses.map((entry) => [`${entry.family}:${entry.address}`, entry]),
      ).values(),
    ];
    if (
      deduped.some(
        (entry) =>
          (entry.family !== 4 && entry.family !== 6) ||
          !isPublicIpAddress(entry.address),
      )
    ) {
      throw new SafeOutboundHttpError(
        "Destination resolves to a non-public address",
      );
    }
    return deduped;
  }
}

export const safeOutboundHttpClient = new SafeOutboundHttpClient();

export function parseAndValidateUrl(
  input: string,
  allowedHosts?: readonly string[],
) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SafeOutboundHttpError("Outbound URL is invalid");
  }
  if (url.protocol !== "https:") {
    throw new SafeOutboundHttpError("Outbound URL must use HTTPS");
  }
  if (url.username || url.password) {
    throw new SafeOutboundHttpError("Outbound URL must not contain userinfo");
  }
  if (url.href.length > 2_048) {
    throw new SafeOutboundHttpError("Outbound URL is too long");
  }
  const hostname = normalizeHostname(url.hostname);
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  if (
    lower === "localhost" ||
    lower === "metadata.google.internal" ||
    lower === "instance-data" ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix))
  ) {
    throw new SafeOutboundHttpError("Outbound hostname is not permitted");
  }
  if (
    allowedHosts &&
    !allowedHosts.some((host) => host.toLowerCase() === lower)
  ) {
    throw new SafeOutboundHttpError("Outbound hostname is not approved");
  }
  url.hash = "";
  return url;
}

export function isPublicIpAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

export async function readBoundedDecodedBody(
  source: AsyncIterable<Uint8Array>,
  contentEncoding: string,
  maxDecodedBytes: number,
  maxEncodedBytes: number,
  cancel: (reason?: Error) => void = () => undefined,
) {
  assertPositiveLimit(maxDecodedBytes, "maxDecodedBytes");
  assertPositiveLimit(maxEncodedBytes, "maxEncodedBytes");
  let encodedBytes = 0;
  const countedSource = Readable.from(
    (async function* () {
      for await (const value of source) {
        const chunk = Buffer.from(value);
        encodedBytes += chunk.byteLength;
        if (encodedBytes > maxEncodedBytes) {
          throw new SafeOutboundHttpError(
            "Outbound encoded response exceeds byte limit",
          );
        }
        yield chunk;
      }
    })(),
  );
  const normalizedEncoding = contentEncoding.toLowerCase().split(",")[0].trim();
  let decoded: Readable =
    normalizedEncoding === "" || normalizedEncoding === "identity"
      ? countedSource
      : normalizedEncoding === "gzip" || normalizedEncoding === "x-gzip"
        ? countedSource.pipe(createGunzip())
        : normalizedEncoding === "deflate"
          ? countedSource.pipe(createInflate())
          : normalizedEncoding === "br"
            ? countedSource.pipe(createBrotliDecompress())
            : (() => {
                throw new SafeOutboundHttpError(
                  "Unsupported response content encoding",
                );
              })();
  const chunks: Buffer[] = [];
  let decodedBytes = 0;
  try {
    for await (const value of decoded) {
      const chunk = Buffer.from(value);
      decodedBytes += chunk.byteLength;
      if (decodedBytes > maxDecodedBytes) {
        throw new SafeOutboundHttpError(
          "Outbound decoded response exceeds byte limit",
        );
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, decodedBytes);
  } catch (error) {
    const safeError =
      error instanceof SafeOutboundHttpError
        ? error
        : new SafeOutboundHttpError("Outbound response decoding failed");
    cancel(safeError);
    decoded.destroy(safeError);
    throw safeError;
  }
}

async function resolveHostname(hostname: string) {
  const resolved = await lookup(hostname, { all: true, verbatim: true });
  return resolved.map((entry) => ({
    address: entry.address,
    family: entry.family as 4 | 6,
  }));
}

async function nodeHttpsTransport(
  input: SafeTransportRequest,
): Promise<SafeTransportResponse> {
  return new Promise((resolve, reject) => {
    const hostname = normalizeHostname(input.url.hostname);
    const request = httpsRequest(
      input.url,
      {
        method: input.method ?? "GET",
        headers: input.headers,
        agent: false,
        family: input.address.family,
        servername: isIP(hostname) ? undefined : hostname,
        lookup: ((_hostname, _options, callback) => {
          callback(null, input.address.address, input.address.family);
        }) as typeof lookup,
      },
      (response) => {
        const headers = response.headers as Record<
          string,
          string | string[] | undefined
        >;
        resolve({
          status: response.statusCode ?? 0,
          headers,
          body: response,
          cancel: (reason?: Error) => response.destroy(reason),
        });
      },
    );
    const abort = () =>
      request.destroy(
        new SafeOutboundHttpError("Outbound request was aborted"),
      );
    if (input.signal) {
      if (input.signal.aborted) {
        abort();
      } else {
        input.signal.addEventListener("abort", abort, { once: true });
        request.once("close", () =>
          input.signal?.removeEventListener("abort", abort),
        );
      }
    }
    request.setTimeout(input.timeoutMs, () => {
      request.destroy(new SafeOutboundHttpError("Outbound request timed out"));
    });
    request.once("error", (error) => {
      reject(
        error instanceof SafeOutboundHttpError
          ? error
          : new SafeOutboundHttpError("Outbound request failed"),
      );
    });
    request.end(input.body);
  });
}

function isPublicIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const value =
    ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  const blocked: Array<[number, number]> = [
    [0x00000000, 8],
    [0x0a000000, 8],
    [0x64400000, 10],
    [0x7f000000, 8],
    [0xa9fe0000, 16],
    [0xac100000, 12],
    [0xc0000000, 24],
    [0xc0000200, 24],
    [0xc0586300, 24],
    [0xc0a80000, 16],
    [0xc6120000, 15],
    [0xc6336400, 24],
    [0xcb007100, 24],
    [0xe0000000, 4],
    [0xf0000000, 4],
  ];
  return !blocked.some(([network, prefix]) =>
    ipv4PrefixMatches(value, network, prefix),
  );
}

function ipv4PrefixMatches(value: number, network: number, prefix: number) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) >>> 0 === (network & mask) >>> 0;
}

function isPublicIpv6(address: string) {
  const value = parseIpv6(address);
  if (value === null) return false;
  const globalUnicast = prefixMatches(value, parseIpv6("2000::")!, 3);
  if (!globalUnicast) return false;
  const blocked: Array<[bigint, number]> = [
    [parseIpv6("2001::")!, 32],
    [parseIpv6("2001:2::")!, 48],
    [parseIpv6("2001:10::")!, 28],
    [parseIpv6("2001:20::")!, 28],
    [parseIpv6("2001:db8::")!, 32],
    [parseIpv6("2002::")!, 16],
  ];
  return !blocked.some(([prefix, bits]) => prefixMatches(value, prefix, bits));
}

function parseIpv6(input: string) {
  let address = input.toLowerCase();
  if (address.includes("%")) return null;
  const ipv4Match = address.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Match) {
    if (!isPublicIpv4(ipv4Match[1])) return null;
    const parts = ipv4Match[1].split(".").map(Number);
    const replacement = `${((parts[0] << 8) | parts[1]).toString(16)}:${(
      (parts[2] << 8) |
      parts[3]
    ).toString(16)}`;
    address = `${address.slice(0, -ipv4Match[1].length)}${replacement}`;
  }
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (
    (halves.length === 1 && missing !== 0) ||
    (halves.length === 2 && missing < 1)
  ) {
    return null;
  }
  const segments = [
    ...left,
    ...Array.from({ length: Math.max(0, missing) }, () => "0"),
    ...right,
  ];
  if (
    segments.length !== 8 ||
    segments.some((segment) => !/^[0-9a-f]{1,4}$/.test(segment))
  ) {
    return null;
  }
  return segments.reduce(
    (value, segment) => (value << 16n) | BigInt(`0x${segment}`),
    0n,
  );
}

function prefixMatches(value: bigint, prefix: bigint, bits: number) {
  const shift = BigInt(128 - bits);
  return value >> shift === prefix >> shift;
}

function normalizeHostname(hostname: string) {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

function normalizeHeaders(headers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function flattenHeaders(
  headers: Record<string, string | string[] | undefined>,
) {
  return Object.fromEntries(
    Object.entries(headers)
      .filter(
        (entry): entry is [string, string | string[]] => entry[1] !== undefined,
      )
      .map(([name, value]) => [
        name.toLowerCase(),
        Array.isArray(value) ? value.join(", ") : value,
      ]),
  );
}

function parseContentLength(value: string | undefined) {
  if (!value) return null;
  if (!/^\d+$/.test(value)) {
    throw new SafeOutboundHttpError("Invalid Content-Length header");
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function assertPositiveLimit(value: number, name: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function redactedUrl(url: URL) {
  return `${url.origin}${url.pathname}`;
}
