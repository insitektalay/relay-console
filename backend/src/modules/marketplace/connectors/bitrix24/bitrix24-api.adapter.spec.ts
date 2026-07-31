import { Bitrix24ApiAdapter, Bitrix24ApiError } from "./bitrix24-api.adapter";

const credentials = {
  webhookUrl: "https://relay-fixture.bitrix24.com/rest/7/fixtureWebhook99",
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Bitrix24ApiAdapter", () => {
  it("pins the webhook owner and keeps the secret out of results", async () => {
    const request = jest.fn().mockResolvedValue(
      response({
        result: {
          ID: "7",
          ADMIN: false,
          NAME: "Relay",
          LAST_NAME: "Fixture",
          TIME_ZONE: "UTC",
        },
      }),
    );
    const result = await new Bitrix24ApiAdapter(request).getProfile(
      credentials,
    );
    expect(result).toEqual({
      portalHost: "relay-fixture.bitrix24.com",
      profile: {
        userId: "7",
        admin: false,
        firstName: "Relay",
        lastName: "Fixture",
        timeZone: "UTC",
      },
    });
    expect(request).toHaveBeenCalledWith(
      "https://relay-fixture.bitrix24.com/rest/7/fixtureWebhook99/profile.json",
      expect.objectContaining({ method: "POST", redirect: "error" }),
    );
    expect(JSON.stringify(result)).not.toContain("fixtureWebhook99");
  });

  it("validates exact owner identity and CRM method availability during health", async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(
        response({ result: { ID: "7", ADMIN: true, NAME: "Owner" } }),
      )
      .mockResolvedValueOnce(
        response({ result: { isExisting: true, isAvailable: true } }),
      );
    await expect(
      new Bitrix24ApiAdapter(request).health(credentials),
    ).resolves.toEqual(
      expect.objectContaining({
        portalHost: "relay-fixture.bitrix24.com",
        userId: "7",
        admin: true,
        crmScopeRequired: true,
      }),
    );
    expect(JSON.parse(String(request.mock.calls[1][1].body))).toEqual({
      name: "crm.item.list",
    });
  });

  it("rejects custom hosts, query strings, and webhook-owner drift", async () => {
    const adapter = new Bitrix24ApiAdapter(jest.fn());
    await expect(
      adapter.getProfile({
        webhookUrl: "https://crm.example.com/rest/7/fixtureWebhook99",
      }),
    ).rejects.toMatchObject<Partial<Bitrix24ApiError>>({
      code: "credential_missing",
    });
    await expect(
      adapter.getProfile({ webhookUrl: `${credentials.webhookUrl}?leak=yes` }),
    ).rejects.toMatchObject<Partial<Bitrix24ApiError>>({
      code: "credential_missing",
    });
    const mismatch = new Bitrix24ApiAdapter(
      jest.fn().mockResolvedValue(response({ result: { ID: "8" } })),
    );
    await expect(mismatch.health(credentials)).rejects.toMatchObject<
      Partial<Bitrix24ApiError>
    >({ code: "provider_validation_error" });
  });

  it("uses fixed Deal fields, first-page bounds, and exact-ID filtering", async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(
        response({
          result: {
            items: [
              {
                id: 42,
                title: "Bounded deal",
                stageId: "NEW",
                opportunity: 1500,
                currencyId: "USD",
                contactIds: [99],
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        response({ result: { items: [{ id: 42, title: "Bounded deal" }] } }),
      );
    const adapter = new Bitrix24ApiAdapter(request);
    const listed = await adapter.listDeals(credentials, { limit: 1 });
    expect(listed.deals).toEqual([
      expect.objectContaining({ dealId: "42", title: "Bounded deal" }),
    ]);
    expect(JSON.stringify(listed)).not.toContain("contactIds");
    await expect(
      adapter.getDeal(credentials, { dealId: "42" }),
    ).resolves.toEqual({
      portalHost: "relay-fixture.bitrix24.com",
      deal: expect.objectContaining({ dealId: "42" }),
    });
    const listBody = JSON.parse(String(request.mock.calls[0][1].body));
    expect(listBody).toMatchObject({
      entityTypeId: 2,
      start: 0,
      order: { updatedTime: "DESC" },
    });
    expect(listBody).not.toHaveProperty("filter");
    const getBody = JSON.parse(String(request.mock.calls[1][1].body));
    expect(getBody).toMatchObject({
      entityTypeId: 2,
      filter: { id: 42 },
      start: 0,
    });
  });

  it("maps REST errors without exposing provider text", async () => {
    const adapter = new Bitrix24ApiAdapter(
      jest.fn().mockResolvedValue(
        response({
          error: "insufficient_scope",
          error_description: "provider text must not escape",
        }),
      ),
    );
    await expect(adapter.listDeals(credentials, {})).rejects.toEqual(
      expect.objectContaining<Partial<Bitrix24ApiError>>({
        code: "insufficient_scope",
        message: "Bitrix24 denied the required CRM permission.",
        statusCode: 403,
      }),
    );
  });
});
