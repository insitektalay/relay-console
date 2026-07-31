jest.mock("node:dns/promises", () => ({
  lookup: jest.fn().mockResolvedValue([{ address: "203.0.113.10", family: 4 }]),
}));

import {
  GravityFormsApiAdapter,
  GravityFormsApiError,
} from "./gravity-forms-api.adapter";

describe("GravityFormsApiAdapter", () => {
  const credentials = {
    siteUrl: "https://forms.example.com/wordpress/",
    consumerKey: "ck_customer_owned_read_only",
    consumerSecret: "cs_customer_owned_read_only",
  };

  afterEach(() => jest.restoreAllMocks());

  it("uses Basic authentication only on the configured public site API route", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          total_count: 1,
          entries: [{ id: "9", form_id: "7", date_created: "2026-07-17" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await new GravityFormsApiAdapter().read(
      credentials,
      "entries.list",
      {
        formId: 7,
        fieldIds: ["id", "form_id", "date_created"],
        limit: 5,
        offset: 0,
      },
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      new URL(
        "https://forms.example.com/wordpress/wp-json/gf/v2/forms/7/entries?_field_ids=id%2Cform_id%2Cdate_created&_labels=1&paging%5Bpage_size%5D=5&paging%5Boffset%5D=0",
      ),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("ck_customer_owned_read_only:cs_customer_owned_read_only").toString("base64")}`,
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      total_count: 1,
      entries: [{ id: "9", form_id: "7", date_created: "2026-07-17" }],
    });
  });

  it("returns only bounded form schema properties", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 7,
          title: "Intake",
          notifications: [{ to: "private@example.com" }],
          fields: [{ id: 1, label: "Name", type: "text", apiKey: "hidden" }],
        }),
        { status: 200 },
      ),
    );
    await expect(
      new GravityFormsApiAdapter().read(credentials, "forms.get", {
        formId: 7,
      }),
    ).resolves.toEqual({
      id: 7,
      title: "Intake",
      description: undefined,
      is_active: undefined,
      fields: [{ id: 1, label: "Name", type: "text" }],
    });
  });

  it("blocks private sites, arbitrary operations, and unbounded entry reads", async () => {
    const adapter = new GravityFormsApiAdapter();
    expect(() => adapter.read(credentials, "raw.request", {})).toThrow(
      GravityFormsApiError,
    );
    await expect(
      adapter.read(
        { ...credentials, siteUrl: "https://127.0.0.1/" },
        "forms.list",
        {},
      ),
    ).rejects.toThrow("private or local address");
    expect(() =>
      adapter.read(credentials, "entries.list", {
        formId: 7,
        fieldIds: Array.from({ length: 21 }, (_, index) => index + 1),
      }),
    ).toThrow("between 1 and 20");
  });
});
