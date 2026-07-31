import { HightailApiAdapter, HightailApiError } from "./hightail-api.adapter";
import { HIGHTAIL_CONNECTOR_MANIFEST } from "./hightail.connector";

const credentials = {
  apiToken: "customer-production-token",
  senderEmail: "sender@example.com",
};
const signedUrl =
  "https://bitspring-prod.s3.us-west-2.amazonaws.com/file?X-Amz-Signature=abc123";

describe("HightailApiAdapter", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("validates credentials without creating a provider resource", () => {
    const adapter = new HightailApiAdapter();
    expect(adapter.health(credentials)).toEqual({
      credentialPresent: true,
      senderEmail: "sender@example.com",
    });
    expect(() => adapter.health({ ...credentials, apiToken: "" })).toThrow(
      HightailApiError,
    );
  });

  it("approval-gates sends in Safe mode and enables them in Dangerous mode", () => {
    const safe = HIGHTAIL_CONNECTOR_MANIFEST.approvalProfiles[0];
    const dangerous = HIGHTAIL_CONNECTOR_MANIFEST.approvalProfiles[1];
    expect(safe.approvalRequiredActions.map((action) => action.id)).toEqual([
      "hightail_send_files",
    ]);
    expect(dangerous.allowedActions.map((action) => action.id)).toEqual([
      "hightail_send_files",
    ]);
    expect(dangerous.approvalRequiredActions).toEqual([]);
  });

  it("runs the complete create, signed upload, and submit workflow", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            spaceId: "sp-123",
            fullUrls: [{ chunkSize: 5_242_880, urls: [signedUrl] }],
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "sent", signedUrl }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    global.fetch = fetchMock as typeof fetch;
    const result = await new HightailApiAdapter().sendFiles(credentials, {
      files: [
        {
          filename: "brief.txt",
          contentBase64: Buffer.from("hello").toString("base64"),
        },
      ],
      recipients: ["Client@Example.com"],
      subject: "Creative brief",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.spaces.hightail.com/devapi/v1/send/create",
    );
    expect(fetchMock.mock.calls[1][0]).toEqual(new URL(signedUrl));
    expect(fetchMock.mock.calls[2][0]).toBe(
      "https://api.spaces.hightail.com/devapi/v1/send/submit",
    );
    expect(result).toMatchObject({
      spaceId: "sp-123",
      fileCount: 1,
      recipientCount: 1,
      bytesUploaded: 5,
      submitted: true,
      provider: { status: "sent", signedUrl: "[REDACTED]" },
    });
    expect(JSON.stringify(result)).not.toContain(credentials.apiToken);
  });

  it("rejects untrusted upload URLs and path-bearing filenames", async () => {
    const adapter = new HightailApiAdapter();
    expect(() =>
      adapter.signedUploadUrl(
        "https://evil.example/upload?X-Amz-Signature=abc123",
      ),
    ).toThrow(HightailApiError);
    await expect(
      adapter.sendFiles(credentials, {
        files: [
          {
            filename: "../secret.txt",
            contentBase64: Buffer.from("hello").toString("base64"),
          },
        ],
        recipients: ["client@example.com"],
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("bounds recipients and file content before making a request", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    await expect(
      new HightailApiAdapter().sendFiles(credentials, {
        files: [
          {
            filename: "brief.txt",
            contentBase64: Buffer.alloc(5_000_001).toString("base64"),
          },
        ],
        recipients: ["client@example.com"],
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rejected production tokens to a safe credential error", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid API key" }), {
        status: 401,
      }),
    ) as typeof fetch;
    await expect(
      new HightailApiAdapter().sendFiles(credentials, {
        files: [
          {
            filename: "brief.txt",
            contentBase64: Buffer.from("hello").toString("base64"),
          },
        ],
        recipients: ["client@example.com"],
      }),
    ).rejects.toMatchObject({ code: "credential_missing", statusCode: 401 });
  });
});
