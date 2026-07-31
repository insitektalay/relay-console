import {
  SafeOutboundHttpError,
  safeOutboundHttpClient,
} from "../../../common/security/safe-outbound-http";

const MAX_CONNECTOR_REQUEST_BYTES = 10 * 1024 * 1024;
const MAX_CONNECTOR_RESPONSE_BYTES = 10 * 1024 * 1024;

/**
 * Fetch-compatible connector transport with connection-time DNS pinning.
 *
 * The initial hostname is the only approved redirect hostname. This prevents
 * a credential-bearing request from being redirected to a substituted origin.
 * Production requests never use global fetch.
 */
export async function safeConnectorFetch(
  input: string | URL | Request,
  init: RequestInit = {},
): Promise<Response> {
  const testFetch = globalThis.fetch as typeof fetch & {
    _isMockFunction?: boolean;
  };
  if (process.env.JEST_WORKER_ID && testFetch?._isMockFunction) {
    return testFetch(input, init);
  }

  let request: Request;
  try {
    request = new Request(input, init);
  } catch {
    throw new SafeOutboundHttpError("Connector request is invalid");
  }
  const url = new URL(request.url);
  const body = await readBoundedRequestBody(
    request.body,
    MAX_CONNECTOR_REQUEST_BYTES,
  );
  const headers = Object.fromEntries(request.headers.entries());
  const timeoutSignal = init.signal ?? request.signal;
  const result = await safeOutboundHttpClient.requestBuffer(url.toString(), {
    method: request.method,
    headers,
    body,
    maxRequestBytes: MAX_CONNECTOR_REQUEST_BYTES,
    maxResponseBytes: MAX_CONNECTOR_RESPONSE_BYTES,
    maxEncodedResponseBytes: MAX_CONNECTOR_RESPONSE_BYTES + 64 * 1024,
    maxRedirects: request.redirect === "follow" ? 3 : 0,
    timeoutMs: 30_000,
    allowedHosts: [url.hostname],
    signal: timeoutSignal,
  });
  const response = new Response(Uint8Array.from(result.body).buffer, {
    status: result.status,
    headers: result.headers,
  });
  Object.defineProperty(response, "url", {
    configurable: true,
    value: result.url,
  });
  return response;
}

async function readBoundedRequestBody(
  body: ReadableStream<Uint8Array> | null,
  maximum: number,
) {
  if (!body) return undefined;
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      total += chunk.byteLength;
      if (total > maximum) {
        await reader.cancel();
        throw new SafeOutboundHttpError("Connector request exceeds byte limit");
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}
