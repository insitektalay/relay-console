import { gzipSync } from "node:zlib";
import {
  isPublicIpAddress,
  readBoundedDecodedBody,
  SafeOutboundHttpClient,
  SafeOutboundHttpError,
  SafeResolver,
  SafeTransport,
  SafeTransportResponse,
} from "./safe-outbound-http";

function body(...chunks: Array<string | Buffer>) {
  return (async function* () {
    for (const chunk of chunks) {
      yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    }
  })();
}

function response(
  input: Partial<SafeTransportResponse> & { cancel?: jest.Mock } = {},
): SafeTransportResponse {
  return {
    status: input.status ?? 200,
    headers: input.headers ?? { "content-type": "text/plain" },
    body: input.body ?? body("ok"),
    cancel: input.cancel ?? jest.fn(),
  };
}

const publicResolver: SafeResolver = jest.fn(async () => [
  { address: "93.184.216.34", family: 4 as const },
]);

describe("safe outbound destination policy", () => {
  it.each([
    "http://vendor.com/docs",
    "file:///etc/passwd",
    "data:text/plain,secret",
    "ftp://vendor.com/docs",
    "https://user:password@vendor.com/docs",
    "https://localhost/docs",
    "https://service.internal/docs",
  ])("rejects unsafe URL %s", async (url) => {
    const transport = jest.fn();
    const client = new SafeOutboundHttpClient(publicResolver, transport);
    await expect(client.getText(url, { maxBytes: 100 })).rejects.toBeInstanceOf(
      SafeOutboundHttpError,
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    "https://127.0.0.1/",
    "https://2130706433/",
    "https://0x7f000001/",
    "https://0177.0.0.1/",
    "https://10.0.0.1/",
    "https://169.254.169.254/latest/meta-data",
    "https://192.168.1.1/",
    "https://[::1]/",
    "https://[fc00::1]/",
    "https://[fe80::1]/",
    "https://[::ffff:127.0.0.1]/",
    "https://[2001:db8::1]/",
  ])("rejects non-public literal form %s", async (url) => {
    const transport = jest.fn();
    const client = new SafeOutboundHttpClient(publicResolver, transport);
    await expect(client.getText(url, { maxBytes: 100 })).rejects.toThrow(
      "non-public address",
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it("rejects a DNS answer set containing any private address", async () => {
    const resolver: SafeResolver = jest.fn(async () => [
      { address: "93.184.216.34", family: 4 as const },
      { address: "10.0.0.7", family: 4 as const },
    ]);
    const transport = jest.fn();
    const client = new SafeOutboundHttpClient(resolver, transport);

    await expect(
      client.getText("https://docs.vendor.com/", { maxBytes: 100 }),
    ).rejects.toThrow("non-public address");
    expect(transport).not.toHaveBeenCalled();
  });

  it("pins the resolved address supplied to the transport", async () => {
    const resolver: SafeResolver = jest.fn(async () => [
      { address: "93.184.216.34", family: 4 as const },
    ]);
    const transport: SafeTransport = jest.fn(async () => response());
    const client = new SafeOutboundHttpClient(resolver, transport);

    await client.getText("https://docs.vendor.com/api", { maxBytes: 100 });

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        address: { address: "93.184.216.34", family: 4 },
        url: expect.objectContaining({ hostname: "docs.vendor.com" }),
      }),
    );
  });

  it("revalidates a redirect before a second request", async () => {
    const transport: SafeTransport = jest.fn(async () =>
      response({
        status: 302,
        headers: { location: "https://127.0.0.1/admin" },
      }),
    );
    const client = new SafeOutboundHttpClient(publicResolver, transport);

    await expect(
      client.getText("https://docs.vendor.com/", { maxBytes: 100 }),
    ).rejects.toThrow("non-public address");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("strips credentials when redirecting to another origin", async () => {
    const transport: SafeTransport = jest
      .fn()
      .mockResolvedValueOnce(
        response({
          status: 302,
          headers: { location: "https://cdn.vendor.net/docs" },
        }),
      )
      .mockResolvedValueOnce(response());
    const client = new SafeOutboundHttpClient(publicResolver, transport);

    await client.getText("https://docs.vendor.com/", {
      maxBytes: 100,
      headers: {
        authorization: "Bearer secret",
        cookie: "session=secret",
        accept: "text/plain",
      },
    });

    expect(transport).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ headers: { accept: "text/plain" } }),
    );
  });
});

describe("safe outbound streaming limits", () => {
  it("pins a credential-bearing POST and returns bounded non-2xx bodies", async () => {
    const transport: SafeTransport = jest.fn(async () =>
      response({
        status: 422,
        headers: {
          "content-type": "application/json",
          "x-request-id": "provider-request",
        },
        body: body('{"error":"invalid"}'),
      }),
    );
    const client = new SafeOutboundHttpClient(publicResolver, transport);

    const result = await client.requestBuffer(
      "https://api.vendor.com/v1/items",
      {
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json",
        },
        body: Buffer.from('{"name":"item"}'),
        maxRequestBytes: 1_000,
        maxResponseBytes: 1_000,
      },
    );

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        address: { address: "93.184.216.34", family: 4 },
        body: Buffer.from('{"name":"item"}'),
      }),
    );
    expect(result).toMatchObject({
      status: 422,
      headers: { "content-type": "application/json" },
    });
    expect(result.body.toString("utf8")).toBe('{"error":"invalid"}');
  });

  it("rejects an oversized request before DNS or transport", async () => {
    const resolver: SafeResolver = jest.fn(publicResolver);
    const transport = jest.fn();
    const client = new SafeOutboundHttpClient(resolver, transport);

    await expect(
      client.requestBuffer("https://api.vendor.com/upload", {
        method: "POST",
        body: Buffer.alloc(11),
        maxRequestBytes: 10,
        maxResponseBytes: 100,
      }),
    ).rejects.toThrow("request exceeds byte limit");
    expect(resolver).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });

  it("stops an oversized chunked identity body and cancels it", async () => {
    const cancel = jest.fn();
    await expect(
      readBoundedDecodedBody(
        body("12345", "67890", "x"),
        "identity",
        10,
        20,
        cancel,
      ),
    ).rejects.toThrow("decoded response exceeds");
    expect(cancel).toHaveBeenCalled();
  });

  it("enforces the decoded limit on compressed bodies", async () => {
    const cancel = jest.fn();
    const compressed = gzipSync("x".repeat(50_000));
    await expect(
      readBoundedDecodedBody(
        body(compressed),
        "gzip",
        1_024,
        compressed.byteLength + 10,
        cancel,
      ),
    ).rejects.toThrow("decoded response exceeds");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("enforces an encoded-byte limit before buffering", async () => {
    const cancel = jest.fn();
    await expect(
      readBoundedDecodedBody(
        body("12345", "67890"),
        "identity",
        100,
        9,
        cancel,
      ),
    ).rejects.toThrow("encoded response exceeds");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("rejects an oversized Content-Length before reading", async () => {
    const cancel = jest.fn();
    const transport: SafeTransport = jest.fn(async () =>
      response({
        headers: {
          "content-type": "text/plain",
          "content-length": "1000",
        },
        cancel,
      }),
    );
    const client = new SafeOutboundHttpClient(publicResolver, transport);

    await expect(
      client.getText("https://docs.vendor.com/", {
        maxBytes: 100,
        maxEncodedBytes: 150,
      }),
    ).rejects.toThrow("exceeds byte limit");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("cancels an endless response at the response deadline", async () => {
    let rejectBody: ((error: Error) => void) | undefined;
    const bodyGate = new Promise<void>((_resolve, reject) => {
      rejectBody = reject;
    });
    const cancel = jest.fn((error?: Error) => {
      rejectBody!(error ?? new Error("cancelled"));
    });
    const transport: SafeTransport = jest.fn(async () =>
      response({
        body: (async function* () {
          await bodyGate;
          yield Buffer.from("never");
        })(),
        cancel,
      }),
    );
    const client = new SafeOutboundHttpClient(publicResolver, transport);

    await expect(
      client.getText("https://docs.vendor.com/", {
        maxBytes: 100,
        timeoutMs: 10,
      }),
    ).rejects.toThrow("timed out");
    expect(cancel).toHaveBeenCalled();
  });

  it("bounds concurrent requests", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const transport: SafeTransport = jest
      .fn()
      .mockImplementationOnce(async () =>
        response({
          body: (async function* () {
            await firstGate;
            yield Buffer.from("first");
          })(),
        }),
      )
      .mockImplementationOnce(async () => response({ body: body("second") }));
    const client = new SafeOutboundHttpClient(publicResolver, transport, 1);

    const first = client.getText("https://docs.vendor.com/one", {
      maxBytes: 100,
    });
    const second = client.getText("https://docs.vendor.com/two", {
      maxBytes: 100,
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(transport).toHaveBeenCalledTimes(1);
    releaseFirst!();
    await Promise.all([first, second]);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("cancels a request while it is waiting for an outbound slot", async () => {
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const transport: SafeTransport = jest.fn(async () =>
      response({
        body: (async function* () {
          await firstGate;
          yield Buffer.from("first");
        })(),
      }),
    );
    const client = new SafeOutboundHttpClient(publicResolver, transport, 1);
    const first = client.getText("https://docs.vendor.com/one", {
      maxBytes: 100,
    });
    const controller = new AbortController();
    const queued = client.requestBuffer("https://api.vendor.com/two", {
      maxRequestBytes: 100,
      maxResponseBytes: 100,
      signal: controller.signal,
    });

    await new Promise<void>((resolve) => setImmediate(resolve));
    controller.abort();
    await expect(queued).rejects.toThrow("Outbound request was aborted");
    expect(transport).toHaveBeenCalledTimes(1);
    releaseFirst!();
    await first;
  });
});

describe("public IP classification", () => {
  it.each([
    "8.8.8.8",
    "93.184.216.34",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
  ])("allows public address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(true);
  });

  it.each([
    "0.0.0.0",
    "100.64.0.1",
    "127.0.0.1",
    "192.0.2.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "::",
    "::1",
    "::ffff:8.8.8.8",
    "64:ff9b::808:808",
    "2001:db8::1",
    "2002:0808:0808::1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
  ])("blocks special address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });
});
