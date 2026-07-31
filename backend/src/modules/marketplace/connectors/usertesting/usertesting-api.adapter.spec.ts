import {
  UserTestingApiAdapter,
  UserTestingApiError,
} from "./usertesting-api.adapter";

describe("UserTestingApiAdapter", () => {
  const credentials = {
    clientId: "customer-client",
    clientSecret: "customer-secret",
  };
  const testId = "12345678-1234-4234-9234-123456789abc";
  afterEach(() => jest.restoreAllMocks());

  it("requests studies:read and minimizes bounded completed sessions", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "temporary-access",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            testId,
            sessions: [
              {
                sessionId: "session-1",
                audienceId: "private",
                status: "COMPLETE",
                startTime: "start",
                finishTime: "finish",
                videoUrl: "private",
              },
            ],
            meta: { pagination: { limit: 5, offset: 0, totalCount: 1 } },
          }),
          { status: 200 },
        ),
      );
    const result = await new UserTestingApiAdapter().read(
      credentials,
      "sessions.list",
      { testId, limit: 5, offset: 0 },
    );
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "https://auth.usertesting.com/oauth2/aus1p3vtd8vtm4Bxv0h8/v1/token",
    );
    expect(String(fetchSpy.mock.calls[0]?.[1]?.body)).toContain(
      "scope=studies%3Aread",
    );
    expect(fetchSpy.mock.calls[1]?.[0]).toEqual(
      new URL(
        `https://api.use2.usertesting.com/api/v2/sessionResults?testId=${testId}&limit=5&offset=0`,
      ),
    );
    expect(result).toEqual({
      testId,
      sessions: [
        {
          sessionId: "session-1",
          status: "COMPLETE",
          startTime: "start",
          finishTime: "finish",
        },
      ],
      meta: { pagination: { limit: 5, offset: 0, totalCount: 1 } },
    });
  });

  it("pins aggregate QXscores and blocks detailed or media operations", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "temporary-access" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ testId, qxScores: [] }), { status: 200 }),
      );
    await new UserTestingApiAdapter().read(credentials, "qxScores.get", {
      testId,
    });
    expect(fetchSpy.mock.calls[1]?.[0]).toEqual(
      new URL(
        `https://api.use2.usertesting.com/api/v2/testResults/${testId}/qxScores`,
      ),
    );
    await expect(
      new UserTestingApiAdapter().read(credentials, "session.details", {
        testId,
      }),
    ).rejects.toBeInstanceOf(UserTestingApiError);
  });
});
