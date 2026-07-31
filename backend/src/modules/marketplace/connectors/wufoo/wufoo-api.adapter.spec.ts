import { WufooApiAdapter, WufooApiError } from "./wufoo-api.adapter";
import {
  WUFOO_MANAGE_OPERATION_IDS,
  WUFOO_OPERATIONS,
  WUFOO_READ_OPERATION_IDS,
  WUFOO_SOURCE_SHA256,
} from "./wufoo-operation-registry";

describe("WufooApiAdapter", () => {
  const credentials = { apiKey: "customer-owned-key", subdomain: "fishbowl" };

  afterEach(() => jest.restoreAllMocks());

  it("pins all 18 documented Wufoo operations and excludes partner password login", () => {
    expect(WUFOO_SOURCE_SHA256).toHaveLength(64);
    expect(WUFOO_OPERATIONS).toHaveLength(18);
    expect(WUFOO_READ_OPERATION_IDS).toHaveLength(15);
    expect(WUFOO_MANAGE_OPERATION_IDS).toHaveLength(3);
    expect(WUFOO_OPERATIONS.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "forms.commentsCount",
        "entries.create",
        "reports.widgets",
        "users.get",
        "webhooks.delete",
      ]),
    );
    expect(WUFOO_OPERATIONS.some((item) => item.path.includes("login"))).toBe(
      false,
    );
  });

  it("uses Basic API-key auth only on the configured Wufoo account origin", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ Forms: [], ApiKey: "hidden" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const result = await new WufooApiAdapter().read(
      credentials,
      "entries.list",
      {
        pathParameters: { form_identifier: "customer-form" },
        query: { limit: 25, page: 2, sort: "EntryId" },
      },
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL(
        "https://fishbowl.wufoo.com/api/v3/forms/customer-form/entries.json?limit=25&page=2&sort=EntryId",
      ),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("customer-owned-key:relayconsole").toString("base64")}`,
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({ Forms: [], ApiKey: "[REDACTED]" });
  });

  it("encodes entry submissions and webhooks as bounded form data", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ Success: 1, EntryId: 42 }), {
        status: 201,
      }),
    );
    await new WufooApiAdapter().manage(credentials, "entries.create", {
      pathParameters: { form_identifier: "abc123" },
      form: { Field1: "Relay", Field2: ["one", "two"] },
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL("https://fishbowl.wufoo.com/api/v3/forms/abc123/entries.json"),
      expect.objectContaining({
        method: "POST",
        body: "Field1=Relay&Field2=one&Field2=two",
        headers: expect.objectContaining({
          "Content-Type": "application/x-www-form-urlencoded",
        }),
      }),
    );
  });

  it("rejects raw operations, escaped accounts, incomplete paths, and credential fields", async () => {
    const adapter = new WufooApiAdapter();
    await expect(adapter.read(credentials, "raw.request", {})).rejects.toThrow(
      WufooApiError,
    );
    await expect(
      adapter.read(credentials, "forms.get", { pathParameters: {} }),
    ).rejects.toThrow("path parameters must exactly match");
    await expect(
      adapter.manage(credentials, "webhooks.create", {
        pathParameters: { form_identifier: "form" },
        form: { url: "https://relayconsole.work/hook", apiToken: "never" },
      }),
    ).rejects.toThrow("Credential-bearing field apiToken is not allowed");
    await expect(
      adapter.read(
        { ...credentials, subdomain: "evil.example.com" },
        "forms.list",
        {},
      ),
    ).rejects.toThrow("account name");
  });
});
