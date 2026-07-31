import { HubSpotApiAdapter } from "./hubspot-api.adapter";

const credentials = { accessToken: "hubspot-token", hubId: "1234567" };
const response = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...(headers ?? {}) },
  });

describe("HubSpotApiAdapter", () => {
  it("uses fixed date-versioned paths, properties, order, and bounds", async () => {
    const request = jest.fn(async (_url: string, init: RequestInit) =>
      response({
        results: [
          {
            id: "42",
            properties: {
              dealname: "Renewal",
              amount: "100.00",
              pipeline: "default",
              dealstage: "appointmentscheduled",
            },
          },
        ],
      }),
    );
    const adapter = new HubSpotApiAdapter(request);
    await expect(
      adapter.listDeals(credentials, { limit: 7 }),
    ).resolves.toMatchObject({
      hubId: "1234567",
      deals: [{ dealId: "42", name: "Renewal", amount: "100.00" }],
    });
    expect(request).toHaveBeenCalledWith(
      "https://api.hubapi.com/crm/objects/2026-03/deals/search",
      expect.objectContaining({ method: "POST", redirect: "error" }),
    );
    const init = request.mock.calls[0][1];
    expect(JSON.parse(String(init.body))).toEqual({
      filterGroups: [],
      limit: 7,
      properties: [
        "dealname",
        "amount",
        "closedate",
        "pipeline",
        "dealstage",
        "createdate",
        "hs_lastmodifieddate",
      ],
      sorts: ["-hs_lastmodifieddate"],
    });
    expect(init.headers).toMatchObject({
      Authorization: "Bearer hubspot-token",
    });
  });

  it("reads one exact deal without exposing caller-controlled paths", async () => {
    const request = jest.fn(async (_url: string, _init: RequestInit) =>
      response({ id: "42", properties: { dealname: "Renewal" } }),
    );
    const adapter = new HubSpotApiAdapter(request);
    await expect(
      adapter.getDeal(credentials, { dealId: "42" }),
    ).resolves.toMatchObject({ deal: { dealId: "42", name: "Renewal" } });
    expect(request.mock.calls[0][0]).toContain(
      "/crm/objects/2026-03/deals/42?",
    );
    await expect(
      adapter.getDeal(credentials, { dealId: "../contacts" }),
    ).rejects.toMatchObject({ code: "hubspot_deal_id_invalid" });
  });

  it("rejects invalid account bindings and bounds", async () => {
    const adapter = new HubSpotApiAdapter(async () =>
      response({ results: [] }),
    );
    await expect(
      adapter.listCompanies({ ...credentials, hubId: "0" }, {}),
    ).rejects.toMatchObject({ code: "hubspot_hub_binding_invalid" });
    await expect(
      adapter.listCompanies(credentials, { limit: 26 }),
    ).rejects.toMatchObject({ code: "hubspot_input_invalid" });
  });

  it("maps permission and rate failures without leaking provider bodies", async () => {
    const denied = new HubSpotApiAdapter(async () =>
      response(
        { message: "secret", category: "MISSING_SCOPES", correlationId: "abc" },
        403,
      ),
    );
    await expect(denied.listCompanies(credentials, {})).rejects.toMatchObject({
      code: "hubspot_permission_denied",
      statusCode: 403,
      message: "HubSpot API request failed.",
    });
    const limited = new HubSpotApiAdapter(async () =>
      response({}, 429, { "retry-after": "10" }),
    );
    await expect(limited.listCompanies(credentials, {})).rejects.toMatchObject({
      code: "hubspot_rate_limited",
      details: { retryAfter: "10" },
    });
  });
});
