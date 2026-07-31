import {
  GoogleContactsApiAdapter,
  GoogleContactsApiError,
} from "./google-contacts-api.adapter";
import {
  GOOGLE_CONTACTS_CONNECTOR_MANIFEST,
  GOOGLE_CONTACTS_SCOPES,
} from "./google-contacts.connector";
describe("Google Contacts connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses the exact Contacts scope and exposes five privacy-bounded tools", () => {
    expect(GOOGLE_CONTACTS_SCOPES).toEqual([
      "openid",
      "email",
      "https://www.googleapis.com/auth/contacts",
    ]);
    expect(GOOGLE_CONTACTS_CONNECTOR_MANIFEST.tools).toHaveLength(5);
    expect(
      GOOGLE_CONTACTS_CONNECTOR_MANIFEST.tools
        .filter((t) => t.approvalRequired)
        .map((t) => t.functionName),
    ).toEqual([
      "google_contacts_contact_create",
      "google_contacts_contact_patch",
    ]);
  });
  it("pins contact-source reads and does not follow pagination", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            connections: [
              {
                resourceName: "people/c1",
                names: [{ displayName: "Ada" }],
                birthdays: [{ text: "excluded" }],
              },
            ],
            nextPageToken: "hidden",
          }),
          { status: 200 },
        ),
      );
    const result = await new GoogleContactsApiAdapter().listContacts("token");
    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [URL];
    expect(url.searchParams.get("sources")).toBe("READ_SOURCE_TYPE_CONTACT");
    expect(url.searchParams.get("personFields")).toBe(
      "names,emailAddresses,phoneNumbers,organizations,metadata",
    );
    expect(result).toMatchObject({
      count: 1,
      nextPageTokenPresent: true,
      nextPageFollowed: false,
      connections: [{ broadPersonalFieldsReturned: false }],
    });
  });
  it("rejects contact creation without a name", () => {
    expect(() =>
      new GoogleContactsApiAdapter().prepareUpdate({
        operation: "create",
        emailAddresses: ["a@example.com"],
      }),
    ).toThrow(GoogleContactsApiError);
  });
  it("preflights the latest ETag before a narrow update", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            resourceName: "people/c1",
            etag: "etag-1",
            metadata: { sources: [{ etag: "source-1" }] },
            names: [{ givenName: "Ada" }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            resourceName: "people/c1",
            etag: "etag-2",
            names: [{ givenName: "Augusta" }],
          }),
          { status: 200 },
        ),
      );
    const result = await new GoogleContactsApiAdapter().updateContact("token", {
      resourceName: "people/c1",
      givenName: "Augusta",
      idempotencyKey: "request-123",
    });
    const [url] = (global.fetch as jest.Mock).mock.calls[1] as [URL];
    expect(url.searchParams.get("updatePersonFields")).toBe("names");
    expect(result).toMatchObject({
      operation: "update_contact",
      latestSourceEtagPreflight: true,
      providerRequestCount: 2,
    });
  });
});
