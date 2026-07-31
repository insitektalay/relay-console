import { PendoApiAdapter } from "./pendo-api.adapter";

const credentials = {
  apiOrigin: "https://app.eu.pendo.io",
  applicationId: "-323232",
  integrationKey: "pendo-integration-key-example",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("PendoApiAdapter", () => {
  it("validates the integration key while discarding the provider payload", async () => {
    const request = jest.fn(async () =>
      response({ subscriptionId: "private", subscriptionName: "Private" }),
    );
    const adapter = new PendoApiAdapter(request);

    await expect(adapter.health(credentials)).resolves.toEqual({
      apiOrigin: "https://app.eu.pendo.io",
      applicationId: "-323232",
      integrationKeyValid: true,
      reachable: true,
    });
    expect(request).toHaveBeenCalledWith(
      "https://app.eu.pendo.io/api/v1/token/verify",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "x-pendo-integration-key": credentials.integrationKey,
        }),
        redirect: "error",
      }),
    );
  });

  it("returns only bounded definition summaries for the configured application", async () => {
    const request = jest.fn(async () =>
      response([
        {
          id: "guide-1",
          name: "Onboarding",
          kind: "Guide",
          appId: -323232,
          state: "public",
          description: "private",
          createdByUser: { username: "private@example.com" },
          steps: [{ content: "private" }],
          audience: [{ visitorId: "private" }],
        },
      ]),
    );
    const adapter = new PendoApiAdapter(request);

    await expect(
      adapter.listDefinitions(credentials, { kind: "guide" }),
    ).resolves.toEqual({
      applicationId: "-323232",
      kind: "guide",
      items: [
        {
          id: "guide-1",
          name: "Onboarding",
          kind: "Guide",
          appId: "-323232",
          state: "public",
          isCoreEvent: null,
        },
      ],
    });
    expect((request.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe(
      "https://app.eu.pendo.io/api/v1/guide?appId=-323232",
    );
  });

  it("runs only the fixed application adoption pipeline and strips detail rows", async () => {
    const request = jest.fn(async () =>
      response({
        results: [
          { adoption: 42.5, accountId: "private-account" },
          { adoption: 99, visitorId: "private-visitor" },
        ],
      }),
    );
    const adapter = new PendoApiAdapter(request);

    await expect(
      adapter.getAdoption(credentials, {
        fromDate: "2026-06-01",
        toDate: "2026-06-30",
      }),
    ).resolves.toEqual({
      applicationId: "-323232",
      fromDate: "2026-06-01",
      toDate: "2026-06-30",
      adoptionPercent: 42.5,
    });
    const init = (request.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(String(init.body))).toEqual({
      response: { mimeType: "application/json" },
      request: {
        name: "Relay bounded application adoption",
        pipeline: [
          {
            adoption: {
              appId: -323232,
              firstDay: 'date("2026-06-01")',
              lastDay: 'date("2026-06-30")',
            },
          },
        ],
      },
    });
  });

  it("rejects unknown regions, application IDs, definition kinds, and long ranges", async () => {
    const adapter = new PendoApiAdapter(jest.fn());
    await expect(
      adapter.health({ ...credentials, apiOrigin: "https://example.com" }),
    ).rejects.toMatchObject({
      code: "pendo_api_origin_invalid",
    });
    await expect(
      adapter.health({ ...credentials, applicationId: "all-apps" }),
    ).rejects.toMatchObject({
      code: "pendo_application_id_invalid",
    });
    await expect(
      adapter.listDefinitions(credentials, { kind: "visitor" }),
    ).rejects.toMatchObject({
      code: "pendo_definition_kind_invalid",
    });
    await expect(
      adapter.getAdoption(credentials, {
        fromDate: "2026-01-01",
        toDate: "2026-02-01",
      }),
    ).rejects.toMatchObject({
      code: "pendo_date_range_invalid",
    });
  });
});
