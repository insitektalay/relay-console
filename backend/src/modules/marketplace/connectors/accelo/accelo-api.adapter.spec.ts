import { AcceloApiAdapter, type AcceloCredentials } from "./accelo-api.adapter";

const credentials: AcceloCredentials = {
  deployment: "synthetic-studio",
  clientId: "relay-service@synthetic-studio.accelo.com",
  clientSecret: "S".repeat(48),
  jobId: "4242",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

describe("AcceloApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("derives a read(jobs) token and returns only selected-project lifecycle state", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementationOnce(() =>
        json({
          access_token: "A".repeat(40),
          expires_in: "3600",
          token_type: "bearer",
          deployment: "synthetic-studio",
          scope: "read(jobs)",
        }),
      )
      .mockImplementationOnce(() =>
        json({
          meta: { status: "ok", response_code: 200 },
          response: {
            id: "4242",
            title: "Private client implementation",
            company: "88",
            manager: "7",
            rate_charged: "350.00",
            standing: "active",
            paused: "0",
            date_started: "1782864000",
            date_due: "1790726400",
            date_completed: null,
          },
        }),
      );
    await expect(
      new AcceloApiAdapter().getSelectedProjectState(credentials),
    ).resolves.toEqual({
      project: {
        projectId: "4242",
        standing: "active",
        pausedDays: 0,
        scheduledStartAtUnix: "1782864000",
        dueAtUnix: "1790726400",
        completedAtUnix: null,
        titleOrClientIncluded: false,
        peopleOrFinancialsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://synthetic-studio.api.accelo.com/oauth2/v0/token",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: "grant_type=client_credentials&scope=read%28jobs%29&expires_in=3600",
        redirect: "error",
      }),
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://synthetic-studio.api.accelo.com/api/v0/jobs/4242",
    );
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
  });

  it("rejects unsafe deployment and project identifiers before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new AcceloApiAdapter().getSelectedProjectState({
        ...credentials,
        deployment: "tenant.api.accelo.com",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      new AcceloApiAdapter().getSelectedProjectState({
        ...credentials,
        jobId: "../staff",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects cross-deployment or broader token responses", async () => {
    const adapter = new AcceloApiAdapter();
    const fetchMock = jest.spyOn(global, "fetch");
    fetchMock.mockImplementationOnce(() =>
      json({
        access_token: "A".repeat(40),
        expires_in: 3600,
        deployment: "other-studio",
      }),
    );
    await expect(
      adapter.getSelectedProjectState(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    fetchMock.mockImplementationOnce(() =>
      json({
        access_token: "A".repeat(40),
        expires_in: 3600,
        deployment: "synthetic-studio",
        scope: "read(all)",
      }),
    );
    await expect(
      adapter.getSelectedProjectState(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("maps rate limits without exposing the provider body", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementationOnce(() =>
        json({
          access_token: "A".repeat(40),
          expires_in: 3600,
          deployment: "synthetic-studio",
          scope: "read(jobs)",
        }),
      )
      .mockImplementationOnce(() =>
        json({ message: "private deployment detail" }, 429),
      );
    await expect(
      new AcceloApiAdapter().getSelectedProjectState(credentials),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      message: "Accelo API returned HTTP 429.",
    });
  });
});
