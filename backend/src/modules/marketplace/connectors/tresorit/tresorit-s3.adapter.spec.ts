import { TresoritS3Adapter, TresoritS3Error } from "./tresorit-s3.adapter";

const credentials = {
  endpoint: "https://storage.example.com",
  accessKeyId: "access-key",
  secretAccessKey: "secret-key",
};

describe("TresoritS3Adapter", () => {
  const adapter = new TresoritS3Adapter();

  it("accepts only public HTTPS gateway URLs", () => {
    expect(adapter.normalizeEndpoint("https://storage.example.com/")).toBe(
      "https://storage.example.com",
    );
    for (const endpoint of [
      "http://storage.example.com",
      "https://localhost",
      "https://127.0.0.1",
      "https://10.0.0.4",
      "https://user:pass@storage.example.com",
      "https://storage.example.com/?token=secret",
    ]) {
      expect(() => adapter.normalizeEndpoint(endpoint)).toThrow(
        TresoritS3Error,
      );
    }
  });

  it("builds a fixed-region SigV4 request without exposing the secret", () => {
    const request = adapter.buildSignedRequest(
      credentials,
      "listObjects",
      { bucket: "Project files", prefix: "reports/", maxKeys: 25 },
      new Date("2026-07-14T19:00:00Z"),
    );
    expect(request.method).toBe("GET");
    expect(request.url.toString()).toBe(
      "https://storage.example.com/Project%20files?list-type=2&max-keys=25&prefix=reports%2F",
    );
    expect(request.headers.authorization).toContain(
      "Credential=access-key/20260714/us-east-1/s3/aws4_request",
    );
    expect(JSON.stringify(request)).not.toContain("secret-key");
  });

  it("bounds upload size and rejects path traversal", () => {
    expect(() =>
      adapter.buildSignedRequest(credentials, "putObject", {
        bucket: "project",
        key: "../secret.txt",
        fileBase64: Buffer.from("hello").toString("base64"),
      }),
    ).toThrow(TresoritS3Error);
    expect(() =>
      adapter.buildSignedRequest(credentials, "putObject", {
        bucket: "project",
        key: "large.bin",
        fileBase64: Buffer.alloc(5_000_001).toString("base64"),
      }),
    ).toThrow(TresoritS3Error);
  });

  it("keeps read and write tools separated", async () => {
    await expect(
      adapter.read(credentials, "deleteObject", {
        bucket: "project",
        key: "report.pdf",
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "getObject", {
        bucket: "project",
        key: "report.pdf",
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("signs bounded multi-object deletion with an explicit key list", () => {
    const request = adapter.buildSignedRequest(credentials, "deleteObjects", {
      bucket: "project",
      keys: ["one.txt", "folder/two.txt"],
    });
    expect(request.method).toBe("POST");
    expect(request.url.search).toBe("?delete=");
    expect(request.headers["content-md5"]).toBeTruthy();
    expect(request.body?.toString("utf8")).toContain("folder/two.txt");
  });
});
