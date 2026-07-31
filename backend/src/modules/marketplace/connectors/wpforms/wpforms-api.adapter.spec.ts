jest.mock("node:dns/promises", () => ({
  lookup: jest.fn().mockResolvedValue([{ address: "203.0.113.10", family: 4 }]),
}));

import { WpFormsApiAdapter, WpFormsApiError } from "./wpforms-api.adapter";

describe("WpFormsApiAdapter", () => {
  const credentials = {
    siteUrl: "https://forms.example.com/wordpress/",
    username: "relay-reader",
    applicationPassword: "abcd efgh ijkl mnop",
  };

  afterEach(() => jest.restoreAllMocks());

  it("uses the exact GET ability route with bounded metadata-only summaries", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          entries: [{ id: 9, form_id: 7, date: "2026-07-17" }],
          total: 1,
        }),
        { status: 200 },
      ),
    );
    const result = await new WpFormsApiAdapter().read(
      credentials,
      "entry-summaries.list",
      { formId: 7, type: "unread", limit: 5, offset: 0 },
    );
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL(
        "https://forms.example.com/wordpress/wp-json/wp-abilities/v1/abilities/wpforms/get-entry-summaries/run?input%5Bform_id%5D=7&input%5Bstatus%5D=&input%5Btype%5D=unread&input%5Binclude_fields%5D=false&input%5Blimit%5D=5&input%5Boffset%5D=0",
      ),
    );
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("relay-reader:abcd efgh ijkl mnop").toString("base64")}`,
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      entries: [{ id: 9, form_id: 7, date: "2026-07-17" }],
      total: 1,
    });
  });

  it("removes network identifiers from exact entries", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 9,
          form_id: 7,
          ip_address: "192.0.2.4",
          user_agent: "Private browser",
          fields: [{ id: 2, name: "Email", value: "a@b.test" }],
        }),
        { status: 200 },
      ),
    );
    await expect(
      new WpFormsApiAdapter().read(credentials, "entries.get", { entryId: 9 }),
    ).resolves.toEqual({
      id: 9,
      form_id: 7,
      fields: [{ id: 2, name: "Email", value: "a@b.test" }],
    });
  });

  it("blocks private sites, arbitrary abilities, and oversized lists", async () => {
    const adapter = new WpFormsApiAdapter();
    expect(() => adapter.read(credentials, "search-entries", {})).toThrow(
      WpFormsApiError,
    );
    await expect(
      adapter.read(
        { ...credentials, siteUrl: "https://127.0.0.1/" },
        "forms.list",
        {},
      ),
    ).rejects.toThrow("private or local address");
    expect(() =>
      adapter.read(credentials, "forms.list", { limit: 100 }),
    ).toThrow("integer from 1 to 25");
  });
});
