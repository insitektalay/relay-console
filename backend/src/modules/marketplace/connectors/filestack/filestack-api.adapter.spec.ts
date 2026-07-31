import { createHmac } from "node:crypto";
import {
  FilestackApiAdapter,
  FilestackApiError,
} from "./filestack-api.adapter";
import { FILESTACK_CONNECTOR_MANIFEST } from "./filestack.connector";

const credentials = {
  apiKey: "customer_api_key",
  appSecret: "customer-app-secret",
};

describe("FilestackApiAdapter", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("creates a short-lived operation-scoped HMAC-SHA256 policy", () => {
    jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const signed = new FilestackApiAdapter().signedPolicy(
      credentials,
      ["stat", "exif"],
      "AbCdEf123",
    );
    expect(
      JSON.parse(Buffer.from(signed.policy, "base64url").toString()),
    ).toEqual({
      expiry: 1_700_000_300,
      call: ["stat", "exif"],
      handle: "AbCdEf123",
    });
    expect(signed.signature).toBe(
      createHmac("sha256", credentials.appSecret)
        .update(signed.policy)
        .digest("hex"),
    );
    expect(JSON.stringify(signed)).not.toContain(credentials.appSecret);
  });

  it("keeps reads direct but approval-gates every mutating or billable action", () => {
    const safe = FILESTACK_CONNECTOR_MANIFEST.approvalProfiles[0];
    const dangerous = FILESTACK_CONNECTOR_MANIFEST.approvalProfiles[1];
    expect(safe.allowedActions.map((item) => item.id)).toEqual([
      "filestack_download_file",
      "filestack_read_metadata",
    ]);
    expect(safe.approvalRequiredActions).toHaveLength(5);
    expect(dangerous.approvalRequiredActions).toEqual([]);
    expect(dangerous.allowedActions).toHaveLength(7);
  });

  it("downloads a bounded file through the fixed File API origin", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        new Response("hello", {
          status: 200,
          headers: { "Content-Type": "text/plain", "Content-Length": "5" },
        }),
      );
    global.fetch = fetchMock as typeof fetch;
    await expect(
      new FilestackApiAdapter().read(credentials, "download_file", {
        handle: "AbCdEf123",
      }),
    ).resolves.toMatchObject({
      handle: "AbCdEf123",
      contentBase64: "aGVsbG8=",
      size: 5,
    });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://www.filestackapi.com/api/file/AbCdEf123",
    );
    expect(url.searchParams.get("key")).toBe(credentials.apiKey);
    expect(url.searchParams.get("signature")).toHaveLength(64);
  });

  it("uploads bounded content without exposing the app secret", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            handle: "NewHandle123",
            url: "https://cdn.filestackcontent.com/NewHandle123",
          }),
          { status: 200 },
        ),
      );
    global.fetch = fetchMock as typeof fetch;
    const result = await new FilestackApiAdapter().manage(
      credentials,
      "upload_file",
      {
        filename: "brief.txt",
        contentType: "text/plain",
        contentBase64: "aGVsbG8=",
      },
    );
    expect(result).toMatchObject({ handle: "NewHandle123" });
    expect(fetchMock.mock.calls[0][0]).toContain(
      "https://www.filestackapi.com/api/store/S3?",
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain(
      credentials.appSecret,
    );
  });

  it("rejects path injection, arbitrary processing URLs, and oversized responses", async () => {
    const adapter = new FilestackApiAdapter();
    await expect(
      adapter.manage(credentials, "upload_file", {
        filename: "../secret",
        contentBase64: "aGVsbG8=",
      }),
    ).rejects.toBeInstanceOf(FilestackApiError);
    await expect(
      adapter.process(credentials, {
        handle: "AbCdEf123",
        taskChain: "resize=width:100/https://evil.example",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response("x", {
          status: 200,
          headers: { "Content-Length": "5000001" },
        }),
      ) as typeof fetch;
    await expect(
      adapter.read(credentials, "download_file", { handle: "AbCdEf123" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("maps provider rejection to safe errors", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response("invalid signature", { status: 403 }),
      ) as typeof fetch;
    await expect(
      new FilestackApiAdapter().read(credentials, "read_metadata", {
        handle: "AbCdEf123",
      }),
    ).rejects.toMatchObject({ code: "insufficient_scope", statusCode: 403 });
  });
});
