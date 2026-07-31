import {
  PaperformApiAdapter,
  PaperformApiError,
} from "./paperform-api.adapter";
import {
  PAPERFORM_BUSINESS_OPERATION_IDS,
  PAPERFORM_MANAGE_OPERATION_IDS,
  PAPERFORM_OPERATIONS,
  PAPERFORM_READ_OPERATION_IDS,
  PAPERFORM_SOURCE_SHA256,
  PAPERFORM_STANDARD_OPERATION_IDS,
} from "./paperform-operation-registry";

describe("PaperformApiAdapter", () => {
  const credentials = { apiKey: "customer-owned-key", region: "eu" as const };

  afterEach(() => jest.restoreAllMocks());

  it("pins all 44 Paperform operations and excludes the separate Papersign API", () => {
    expect(PAPERFORM_SOURCE_SHA256).toHaveLength(64);
    expect(PAPERFORM_OPERATIONS).toHaveLength(44);
    expect(PAPERFORM_READ_OPERATION_IDS).toHaveLength(22);
    expect(PAPERFORM_MANAGE_OPERATION_IDS).toHaveLength(22);
    expect(PAPERFORM_STANDARD_OPERATION_IDS).toHaveLength(25);
    expect(PAPERFORM_BUSINESS_OPERATION_IDS).toHaveLength(19);
    expect(PAPERFORM_OPERATIONS.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "forms.list",
        "submissions.delete",
        "products.updateQuantity",
        "webhooks.create",
        "spaces.listForms",
        "translations.delete",
        "files.getUrls",
      ]),
    );
    expect(
      PAPERFORM_OPERATIONS.some((item) => item.path.includes("papersign")),
    ).toBe(false);
  });

  it("attaches bearer authentication only to the selected fixed provider region", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "ok", apiKey: "hidden" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const result = await new PaperformApiAdapter().read(
      credentials,
      "fields.get",
      {
        pathParameters: { slug_or_id: "customer-form", field_key: "email" },
        query: { include: ["options", "calculation"] },
      },
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL(
        "https://api.eu.paperform.co/v1/forms/customer-form/fields/email?include=options&include=calculation",
      ),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer customer-owned-key",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({ status: "ok", apiKey: "[REDACTED]" });
  });

  it("treats POST /files as a semantic read and preserves business plan metadata", () => {
    const adapter = new PaperformApiAdapter();
    expect(() => adapter.manage(credentials, "files.getUrls", {})).toThrow(
      "manage accepts mutation",
    );
    expect(
      PAPERFORM_OPERATIONS.find((item) => item.id === "forms.update")?.tier,
    ).toBe("business");
    expect(
      PAPERFORM_OPERATIONS.find((item) => item.id === "coupons.create")?.tier,
    ).toBe("standard");
  });

  it("rejects unpinned operations, incomplete paths, and credential-bearing bodies", async () => {
    const adapter = new PaperformApiAdapter();
    expect(() => adapter.read(credentials, "raw.request", {})).toThrow(
      PaperformApiError,
    );
    await expect(
      adapter.read(credentials, "submissions.getForForm", {
        pathParameters: { slug_or_id: "form" },
      }),
    ).rejects.toThrow("path parameters must exactly match");
    await expect(
      adapter.manage(credentials, "coupons.create", {
        pathParameters: { slug_or_id: "form" },
        json: { code: "WELCOME", apiToken: "never" },
      }),
    ).rejects.toThrow("Credential-bearing field apiToken is not allowed");
  });
});
