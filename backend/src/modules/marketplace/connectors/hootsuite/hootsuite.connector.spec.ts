import {
  HootsuiteApiAdapter,
  HootsuiteApiError,
} from "./hootsuite-api.adapter";
import { HOOTSUITE_CONNECTOR_MANIFEST } from "./hootsuite.connector";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
describe("Hootsuite connector", () => {
  const credentials = { accessToken: "test-access-token" };
  it("exposes three approval-gated redacted reads with offline refresh", () => {
    expect(HOOTSUITE_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      requiredScopes: ["offline"],
      supportsRefresh: true,
      pkce: false,
    });
    expect(HOOTSUITE_CONNECTOR_MANIFEST.tools).toHaveLength(3);
    expect(
      HOOTSUITE_CONNECTOR_MANIFEST.tools.every((t) => t.approvalRequired),
    ).toBe(true);
  });
  it("uses fixed paths and strips identity", async () => {
    const requester = jest
      .fn()
      .mockResolvedValueOnce(
        json({
          data: {
            id: "15240789",
            email: "secret@example.com",
            fullName: "Secret",
            isActive: true,
            timezone: "UTC",
            language: "en",
          },
        }),
      )
      .mockResolvedValueOnce(
        json({ data: [{ id: "115185509", socialNetworkUsername: "secret" }] }),
      )
      .mockResolvedValueOnce(
        json({
          data: {
            id: "115185509",
            type: "FACEBOOK",
            socialNetworkUsername: "secret",
            socialNetworkId: "private",
            owner: "MEMBER",
            isReauthRequired: 0,
          },
        }),
      );
    const api = new HootsuiteApiAdapter(requester);
    expect(await api.getAccountStatus(credentials)).toEqual(
      expect.objectContaining({ id: "15240789", isActive: true }),
    );
    expect(await api.listSocialProfileIds(credentials)).toEqual({
      profiles: [{ id: "115185509" }],
    });
    expect(await api.getSocialProfileStatus(credentials, "115185509")).toEqual({
      id: "115185509",
      type: "FACEBOOK",
      owner: "MEMBER",
      isReauthRequired: false,
    });
    expect(requester.mock.calls.map((c) => String(c[0]))).toEqual([
      "https://platform.hootsuite.com/v1/me",
      "https://platform.hootsuite.com/v1/me/socialProfiles",
      "https://platform.hootsuite.com/v1/socialProfiles/115185509",
    ]);
  });
  it("rejects unsafe identifiers, missing tokens, and oversized bodies", async () => {
    const api = new HootsuiteApiAdapter(
      jest.fn().mockResolvedValue(json({ data: {} })),
    );
    await expect(
      api.getSocialProfileStatus(credentials, "../messages"),
    ).rejects.toBeInstanceOf(HootsuiteApiError);
    await expect(
      api.getAccountStatus({ accessToken: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    const large = new HootsuiteApiAdapter(
      jest.fn().mockResolvedValue(new Response("x".repeat(1_000_001))),
    );
    await expect(large.getAccountStatus(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
