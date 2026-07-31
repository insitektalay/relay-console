import {
  AirtableFormsApiAdapter,
  AirtableFormsApiError,
} from "./airtable-forms-api.adapter";

describe("AirtableFormsApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses OAuth and returns only minimized form views", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          views: [
            { id: "viw123", name: "Responses", type: "grid" },
            {
              id: "viw456",
              name: "Customer intake",
              type: "form",
              personalForUserId: "usr_private",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new AirtableFormsApiAdapter().read(
      "oauth-access-token",
      "forms.list",
      { baseId: "app12345678901234" },
    );
    expect(fetchSpy.mock.calls[0]?.[0]).toEqual(
      new URL("https://api.airtable.com/v0/meta/bases/app12345678901234/views"),
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer oauth-access-token",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      baseId: "app12345678901234",
      forms: [{ id: "viw456", name: "Customer intake", type: "form" }],
      count: 1,
      truncated: false,
    });
  });

  it("blocks submissions and malformed base IDs", () => {
    expect(() =>
      new AirtableFormsApiAdapter().read("oauth-access-token", "forms.submit", {
        baseId: "app12345678901234",
      }),
    ).toThrow(AirtableFormsApiError);
    expect(() =>
      new AirtableFormsApiAdapter().read("oauth-access-token", "forms.list", {
        baseId: "../records",
      }),
    ).toThrow("valid Airtable base ID");
  });
});
