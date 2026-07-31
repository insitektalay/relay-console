import {
  GetResponseApiAdapter,
  type GetResponseBoundaries,
} from "./getresponse-api.adapter";
const boundaries: GetResponseBoundaries = {
  contactId: "abc123",
  newsletterId: "z4Zje",
};
function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}
describe("GetResponseApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses a fixed contact path and strips personal fields", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({
          contactId: "abc123",
          createdOn: "2026-01-01T00:00:00+0000",
          changedOn: "2026-01-02T00:00:00+0000",
          email: "private@example.com",
          name: "Private",
          ipAddress: "192.0.2.1",
          customFieldValues: [],
        }),
      );
    await expect(
      new GetResponseApiAdapter().getContactSummary("access-token", boundaries),
    ).resolves.toEqual({
      contact: {
        id: "abc123",
        createdOn: "2026-01-01T00:00:00+0000",
        changedOn: "2026-01-02T00:00:00+0000",
        personalFieldsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://api.getresponse.com/v3/contacts/abc123",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer access-token");
  });
  it("projects only bounded newsletter metadata", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({
          newsletterId: "z4Zje",
          type: "broadcast",
          status: "sent",
          createdOn: "2026-01-01T00:00:00+0000",
          sendOn: "2026-01-02T00:00:00+0000",
          subject: "private",
          html: "private",
          fromField: {},
          statistics: {},
        }),
      );
    await expect(
      new GetResponseApiAdapter().getNewsletterSummary(
        "access-token",
        boundaries,
      ),
    ).resolves.toEqual({
      newsletter: {
        id: "z4Zje",
        type: "broadcast",
        status: "sent",
        createdOn: "2026-01-01T00:00:00+0000",
        sendOn: "2026-01-02T00:00:00+0000",
        privateMessageDetailsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://api.getresponse.com/v3/newsletters/z4Zje",
    );
  });
  it("rejects an unsafe selector before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new GetResponseApiAdapter().getContactSummary("access-token", {
        ...boundaries,
        contactId: "../contacts",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("maps throttling without exposing provider content", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() => json({ context: "private" }, 429));
    await expect(
      new GetResponseApiAdapter().getNewsletterSummary(
        "access-token",
        boundaries,
      ),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
