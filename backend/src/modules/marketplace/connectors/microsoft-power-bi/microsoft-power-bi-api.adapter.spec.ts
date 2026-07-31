import {
  MicrosoftPowerBIApiAdapter,
  MicrosoftPowerBIApiError,
} from "./microsoft-power-bi-api.adapter";
describe("MicrosoftPowerBIApiAdapter", () => {
  it("uses the selected workspace and strips report URLs, users, and ownership", async () => {
    const calls: string[] = [];
    const adapter = new MicrosoftPowerBIApiAdapter(async (url) => {
      calls.push(url);
      return new Response(
        JSON.stringify({
          value: [
            {
              id: "report-1",
              name: "Sales",
              reportType: "PowerBIReport",
              datasetId: "data-1",
              webUrl: "https://secret",
              embedUrl: "https://embed",
              users: [{ emailAddress: "private@example.com" }],
              isOwnedByMe: true,
            },
          ],
          nextLink: "skip",
        }),
      );
    });
    const result = await adapter.listReports("token", {
      workspaceId: "workspace-1",
    });
    expect(calls).toEqual([
      "https://api.powerbi.com/v1.0/myorg/groups/workspace-1/reports",
    ]);
    expect(result.reports[0]).toEqual(
      expect.objectContaining({
        id: "report-1",
        name: "Sales",
        embedURLExcluded: true,
        webURLExcluded: true,
        usersExcluded: true,
        ownershipExcluded: true,
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /https:\/\/secret|https:\/\/embed|private@example|"isOwnedByMe"|"skip"/,
    );
  });
  it("rejects unsafe identifiers before provider I/O", async () => {
    const request = jest.fn();
    const adapter = new MicrosoftPowerBIApiAdapter(request);
    await expect(
      adapter.getSemanticModel(
        "token",
        { workspaceId: "workspace-1" },
        { semanticModelId: "../executeQueries" },
      ),
    ).rejects.toBeInstanceOf(MicrosoftPowerBIApiError);
    expect(request).not.toHaveBeenCalled();
  });
  it("fails closed on oversized responses and throttling", async () => {
    const binding = { workspaceId: "workspace-1" };
    await expect(
      new MicrosoftPowerBIApiAdapter(
        async () => new Response("x".repeat(1_000_001)),
      ).health("token", binding),
    ).rejects.toMatchObject({ code: "microsoft_power_bi_response_too_large" });
    await expect(
      new MicrosoftPowerBIApiAdapter(
        async () => new Response("{}", { status: 429 }),
      ).health("token", binding),
    ).rejects.toMatchObject({ code: "microsoft_power_bi_rate_limited" });
  });
});
