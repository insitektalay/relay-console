import { JaneAppApiAdapter } from "./jane-app-api.adapter";

describe("JaneAppApiAdapter", () => {
  const adapter = new JaneAppApiAdapter();
  const credentials = {
    accessToken: "access-token",
    clinicOrigin: "https://relay-clinic.janeapp.com",
  };
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("binds reads to the authorized clinic and current API version", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), { status: 200 }),
      );
    await adapter.read(credentials, {
      path: "/api/2026-01-01/appointments",
      query: { page: 2 },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "https://relay-clinic.janeapp.com",
        pathname: "/api/2026-01-01/appointments",
        search: "?page=2",
      }),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
        redirect: "error",
      }),
    );
  });

  it("supports the POST-body patient search and approved clinical mutations", async () => {
    global.fetch = jest
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({ data: {} }), { status: 200 }),
      );
    await adapter.read(credentials, {
      method: "POST",
      path: "/api/2026-01-01/patients/search",
      json: { first_name: "Ada" },
    });
    await adapter.manage(credentials, {
      method: "PATCH",
      path: "/api/2026-01-01/medical-record/care-plans/1234-abcd",
      json: { status: "active" },
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pathname: "/api/2026-01-01/medical-record/care-plans/1234-abcd",
      }),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("builds bounded provider-native document uploads", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "document-1" }), { status: 200 }),
      );
    await adapter.manage(credentials, {
      method: "POST",
      path: "/api/2026-01-01/document-uploads",
      fileBase64: Buffer.from("pdf").toString("base64"),
      fileName: "record.pdf",
      contentType: "application/pdf",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
  });

  it("rejects other origins, unsupported routes, and credential-bearing input", async () => {
    await expect(
      adapter.read(
        { ...credentials, clinicOrigin: "https://example.com" },
        {
          path: "/api/2026-01-01/company",
        },
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      Promise.resolve().then(() =>
        adapter.manage(credentials, {
          method: "POST",
          path: "/api/2026-01-01/webhooks",
          json: {},
        }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.manage(credentials, {
        method: "POST",
        path: "/api/2026-01-01/medical-record/observations",
        json: { apiKey: "leak" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
