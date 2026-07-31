import {
  KantataOxApiAdapter,
  type KantataOxCredentials,
} from "./kantata-ox-api.adapter";

const credentials: KantataOxCredentials = {
  oauthToken: "K".repeat(64),
  workspaceId: "4242",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

describe("KantataOxApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("reads one exact project and returns only bounded state metadata", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        count: 1,
        results: [{ key: "workspaces", id: "4242" }],
        workspaces: {
          "4242": {
            id: "4242",
            title: "Private client engagement",
            description: "Private project content",
            stage: "project",
            archived: false,
            start_date: "2026-07-01",
            due_date: "2026-09-30",
            price: 500000,
            participant_ids: ["7"],
          },
        },
        users: { "7": { id: "7", full_name: "Private Person" } },
      }),
    );
    await expect(
      new KantataOxApiAdapter().getSelectedWorkspaceState(credentials),
    ).resolves.toEqual({
      workspace: {
        workspaceId: "4242",
        stage: "project",
        archived: false,
        startsOn: "2026-07-01",
        dueOn: "2026-09-30",
        titleOrDescriptionIncluded: false,
        financialsOrIdentitiesIncluded: false,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mavenlink.com/api/v1/workspaces/4242.json?include_archived=true",
      expect.objectContaining({
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${"K".repeat(64)}`,
          "User-Agent": "RelayConsole/1.0",
        },
        redirect: "error",
      }),
    );
  });

  it("rejects invalid credentials and identifiers before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new KantataOxApiAdapter().getSelectedWorkspaceState({
        ...credentials,
        oauthToken: "short",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      new KantataOxApiAdapter().getSelectedWorkspaceState({
        ...credentials,
        workspaceId: "../users",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects mismatched and privacy-unsafe response shapes", async () => {
    const adapter = new KantataOxApiAdapter();
    const fetchMock = jest.spyOn(global, "fetch");
    fetchMock.mockImplementationOnce(() =>
      json({
        results: [{ key: "workspaces", id: "9999" }],
        workspaces: {
          "9999": { id: "9999", stage: "project", archived: false },
        },
      }),
    );
    await expect(
      adapter.getSelectedWorkspaceState(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    fetchMock.mockImplementationOnce(() =>
      json({
        results: [{ key: "workspaces", id: "4242" }],
        workspaces: {
          "4242": { id: "4242", stage: "project", archived: "false" },
        },
      }),
    );
    await expect(
      adapter.getSelectedWorkspaceState(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("maps provider errors without exposing the upstream body", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({ errors: [{ message: "private token detail" }] }, 429),
      );
    await expect(
      new KantataOxApiAdapter().getSelectedWorkspaceState(credentials),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      message: "Kantata OX API returned HTTP 429.",
    });
  });
});
