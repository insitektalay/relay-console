import { ClinikoApiAdapter } from "./cliniko-api.adapter";

describe("ClinikoApiAdapter", () => {
  const adapter = new ClinikoApiAdapter();
  const credentials = { apiKey: "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456-uk2" };
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("derives the regional shard and attaches the user key with Basic auth", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ patients: [] }), { status: 200 }),
      );
    await adapter.read(credentials, {
      path: "/patients",
      query: { per_page: 10 },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "https://api.uk2.cliniko.com",
        pathname: "/v1/patients",
        search: "?per_page=10",
      }),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from(`${credentials.apiKey}:`).toString("base64")}`,
          "User-Agent": "Relay Console (support@relayconsole.work)",
        }),
        redirect: "error",
      }),
    );
  });

  it("permits exact current reads and mutations", async () => {
    global.fetch = jest
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({ id: "1" }), { status: 200 }),
      );
    await adapter.read(credentials, {
      path: "/individual_appointments/123/conflicts",
    });
    await adapter.manage(credentials, {
      method: "PATCH",
      path: "/individual_appointments/123/cancel",
      json: { cancellation_reason: "Patient requested" },
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pathname: "/v1/individual_appointments/123/cancel",
      }),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("completes the patient attachment workflow without exposing presign fields", async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(
        async () =>
          new Response(
            JSON.stringify({
              url: "https://relay-cliniko.s3.amazonaws.com/",
              fields: {
                key: "temp/${filename}",
                policy: "temporary-policy",
                "x-amz-signature": "temporary-signature",
              },
            }),
            { status: 200 },
          ),
      )
      .mockImplementationOnce(
        async () =>
          new Response(
            "<PostResponse><Location>https://relay-cliniko.s3.amazonaws.com/temp/record.pdf</Location></PostResponse>",
            { status: 201 },
          ),
      )
      .mockImplementationOnce(
        async () =>
          new Response(JSON.stringify({ id: "attachment-1" }), { status: 201 }),
      );
    const result = await adapter.uploadAttachment(credentials, {
      patientId: "123",
      fileName: "record.pdf",
      contentType: "application/pdf",
      fileBase64: Buffer.from("pdf").toString("base64"),
      description: "Referral",
    });
    expect(result).toEqual({ id: "attachment-1" });
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        origin: "https://relay-cliniko.s3.amazonaws.com",
      }),
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ pathname: "/v1/patient_attachments" }),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects deprecated, unsupported, and credential-bearing requests", async () => {
    await expect(
      Promise.resolve().then(() =>
        adapter.manage(credentials, {
          method: "DELETE",
          path: "/patients/123",
        }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      Promise.resolve().then(() =>
        adapter.read(credentials, {
          path: "https://example.com/patients",
        }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.manage(credentials, {
        method: "POST",
        path: "/patients",
        json: { apiKey: "leak" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
