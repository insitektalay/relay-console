import { LessAnnoyingCrmApiAdapter } from "./less-annoying-crm-api.adapter";

const credentials = { apiKey: "fixture-less-annoying-crm-api-key" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("LessAnnoyingCrmApiAdapter", () => {
  it("uses only the fixed v2 origin and three typed read functions", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const responses: unknown[] = [
      {
        UserId: "4100019921676030500063783256592",
        FirstName: "Relay",
        Email: "private@example.com",
      },
      {
        Results: [
          {
            ContactId: "4100019921676030500063783256593",
            Name: "Example",
            Email: [{ Text: "private@example.com" }],
            "Background Info": "private",
          },
        ],
        HasMoreResults: true,
      },
      {
        ContactId: "4100019921676030500063783256593",
        Name: "Example",
        Phone: [{ Text: "private" }],
        CustomField: "private",
      },
    ];
    const adapter = new LessAnnoyingCrmApiAdapter(async (url, init) => {
      calls.push({ url, init });
      return json(responses.shift());
    });

    const user = await adapter.getCurrentUser(credentials);
    const list = await adapter.searchContacts(credentials, {
      searchTerms: "  Example  ",
      limit: 3,
    });
    const contact = await adapter.getContact(credentials, {
      contactId: "4100019921676030500063783256593",
    });

    expect(calls.map((call) => [call.init.method, call.url])).toEqual([
      ["POST", "https://api.lessannoyingcrm.com/v2/"],
      ["POST", "https://api.lessannoyingcrm.com/v2/"],
      ["POST", "https://api.lessannoyingcrm.com/v2/"],
    ]);
    expect(calls.map((call) => JSON.parse(String(call.init.body)))).toEqual([
      { Function: "GetUser", Parameters: {} },
      {
        Function: "GetContacts",
        Parameters: {
          SearchTerms: "Example",
          MaxNumberOfResults: 3,
          Page: 1,
        },
      },
      {
        Function: "GetContact",
        Parameters: { ContactId: "4100019921676030500063783256593" },
      },
    ]);
    expect(
      (calls[0].init.headers as Record<string, string>).Authorization,
    ).toBe(credentials.apiKey);
    expect(user.user).not.toHaveProperty("Email");
    expect(list.contacts[0]).not.toHaveProperty("Email");
    expect(list.contacts[0]).not.toHaveProperty("Background Info");
    expect(list.hasMore).toBe(true);
    expect(contact.contact).not.toHaveProperty("Phone");
    expect(contact.contact).not.toHaveProperty("CustomField");
  });

  it("rejects invalid credentials, IDs, searches, and bounds before network access", async () => {
    const request = jest.fn();
    const adapter = new LessAnnoyingCrmApiAdapter(request);
    await expect(adapter.getCurrentUser({ apiKey: "" })).rejects.toMatchObject({
      code: "credential_missing",
    });
    await expect(
      adapter.getContact(credentials, { contactId: "../../users" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.searchContacts(credentials, { searchTerms: "", limit: 3 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.searchContacts(credentials, {
        searchTerms: "Example",
        limit: 26,
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed on identity mismatch and provider failures", async () => {
    const mismatch = new LessAnnoyingCrmApiAdapter(async () =>
      json({ ContactId: "4100019921676030500063783256599" }),
    );
    await expect(
      mismatch.getContact(credentials, {
        contactId: "4100019921676030500063783256593",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });

    const denied = new LessAnnoyingCrmApiAdapter(async () =>
      json({ ErrorDescription: `denied ${credentials.apiKey}` }, 401),
    );
    await expect(denied.getCurrentUser(credentials)).rejects.toMatchObject({
      code: "credential_missing",
      message: "Less Annoying CRM API request failed.",
    });
  });
});
