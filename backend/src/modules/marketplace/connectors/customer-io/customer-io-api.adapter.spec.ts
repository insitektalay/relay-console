import { CustomerIoApiAdapter } from "./customer-io-api.adapter";

const credentials = {
  apiOrigin: "https://api-eu.customer.io",
  appApiKey: "private-customer-io-app-key",
  workspaceId: "130042",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("CustomerIoApiAdapter", () => {
  it("validates the exact regional origin and Workspace ID without returning private workspace data", async () => {
    const request = jest.fn(async () =>
      response({
        workspaces: [
          {
            id: 130042,
            name: "Private workspace",
            people: 12000,
            messages_sent: 5000,
          },
        ],
      }),
    );
    const result = await new CustomerIoApiAdapter(request).health(credentials);
    const [url, init] = request.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.customer.io/v1/workspaces");
    expect(init).toMatchObject({
      method: "GET",
      headers: {
        Authorization: "Bearer private-customer-io-app-key",
      },
      redirect: "error",
    });
    expect(result).toEqual({
      apiOrigin: "https://api-eu.customer.io",
      workspaceId: "130042",
      apiVersion: "v1",
      reachable: true,
    });
    expect(JSON.stringify(result)).not.toContain("Private workspace");
    expect(JSON.stringify(result)).not.toContain("12000");
  });

  it("lists at most twenty-five redacted Campaign lifecycle summaries", async () => {
    const request = jest.fn(async () =>
      response({
        campaigns: [
          {
            id: 42,
            name: "Private onboarding",
            description: "Private campaign content",
            type: "segment",
            state: "running",
            active: true,
            created: 1710000000,
            updated: 1710000100,
            first_started: 1710000200,
            actions: [{ id: 91, type: "email" }],
            tags: ["private-audience"],
          },
        ],
      }),
    );
    const result = await new CustomerIoApiAdapter(request).listCampaigns(
      credentials,
    );
    expect(request).toHaveBeenCalledWith(
      "https://api-eu.customer.io/v1/campaigns",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.campaigns[0]).toEqual({
      campaignId: "42",
      type: "segment",
      state: "running",
      active: true,
      createdAt: 1710000000,
      updatedAt: 1710000100,
      firstStartedAt: 1710000200,
    });
    expect(JSON.stringify(result)).not.toContain("Private onboarding");
    expect(JSON.stringify(result)).not.toContain("private-audience");
    expect(JSON.stringify(result)).not.toContain("actions");
  });

  it("lists redacted Broadcast lifecycle summaries without content or recipients", async () => {
    const request = jest.fn(async () =>
      response({
        broadcasts: [
          {
            id: 7,
            name: "Private launch",
            type: "triggered_broadcast",
            state: "draft",
            active: false,
            created: 1720000000,
            updated: 1720000100,
            first_started: null,
            actions: [{ id: 10, type: "email" }],
            tags: ["private"],
            recipients: ["private@example.com"],
          },
        ],
      }),
    );
    const result = await new CustomerIoApiAdapter(request).listBroadcasts(
      credentials,
    );
    expect(result.broadcasts[0]).toEqual({
      broadcastId: "7",
      type: "triggered_broadcast",
      state: "draft",
      active: false,
      createdAt: 1720000000,
      updatedAt: 1720000100,
      firstStartedAt: null,
    });
    expect(JSON.stringify(result)).not.toContain("Private launch");
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("rejects arbitrary origins and mismatched workspaces", async () => {
    const request = jest.fn(async () =>
      response({ workspaces: [{ id: 999 }] }),
    );
    const adapter = new CustomerIoApiAdapter(request);
    await expect(
      adapter.health({ ...credentials, apiOrigin: "https://example.com" }),
    ).rejects.toMatchObject({ code: "customer_io_api_origin_invalid" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "customer_io_workspace_mismatch",
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
