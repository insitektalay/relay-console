import { EmmaApiAdapter, type EmmaCredentials } from "./emma-api.adapter";

const credentials: EmmaCredentials = {
  accountId: "100",
  publicKey: "public-test-key",
  privateKey: "private-test-key",
  memberId: "201",
  mailingId: "200",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("EmmaApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the selected member path and strips private member fields", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        member_id: 201,
        account_id: 100,
        member_since: "@D:2011-01-03T15:54:13",
        last_modified_at: null,
        email: "private@example.com",
        sms: { phone_number: "+11234567890" },
        fields: { first_name: "Private" },
        status: "opt-out",
        member_status_id: "o",
        bounce_count: 2,
      }),
    );
    await expect(
      new EmmaApiAdapter().getMemberSummary(credentials),
    ).resolves.toEqual({
      member: {
        id: "201",
        accountId: "100",
        memberSince: "@D:2011-01-03T15:54:13",
        lastModifiedAt: null,
        privateMemberDetailsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://api.e2ma.net/100/members/201",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe(
      `Basic ${Buffer.from("public-test-key:private-test-key").toString("base64")}`,
    );
  });

  it("projects bounded mailing lifecycle metadata", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        mailing_id: 200,
        account_id: 100,
        mailing_status: "c",
        mailing_type: "m",
        created_ts: "@D:2013-08-22T09:41:45",
        send_at: null,
        send_started: "@D:2013-08-22T10:00:00",
        send_finished: "@D:2013-08-22T10:01:00",
        archived_ts: null,
        name: "Private",
        subject: "Private",
        sender: "Private",
        html_body: "<p>Private</p>",
        plaintext: "Private",
        recipient_count: 100,
        recipient_members: [{ email: "private@example.com" }],
        links: [{ link_target: "https://private.example" }],
      }),
    );
    await expect(
      new EmmaApiAdapter().getMailingSummary(credentials),
    ).resolves.toEqual({
      mailing: {
        id: "200",
        accountId: "100",
        status: "c",
        type: "m",
        createdAt: "@D:2013-08-22T09:41:45",
        sendAt: null,
        sendStartedAt: "@D:2013-08-22T10:00:00",
        sendFinishedAt: "@D:2013-08-22T10:01:00",
        archivedAt: null,
        privateMailingDetailsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://api.e2ma.net/100/mailings/200",
    );
  });

  it("rejects nonnumeric and email selectors before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new EmmaApiAdapter().getMemberSummary({
        ...credentials,
        memberId: "private@example.com",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps Emma's documented 403 rate response safely", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() => json({ error: "private" }, 403));
    await expect(
      new EmmaApiAdapter().getMailingSummary(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 403 });
  });
});
