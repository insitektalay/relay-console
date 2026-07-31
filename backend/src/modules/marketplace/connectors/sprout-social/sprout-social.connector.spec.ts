import {
  SproutSocialApiAdapter,
  SproutSocialApiError,
} from "./sprout-social-api.adapter";
import { SPROUT_SOCIAL_CONNECTOR_MANIFEST } from "./sprout-social.connector";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
describe("Sprout Social connector", () => {
  const credentials = { clientId: "client", clientSecret: "secret" };
  it("uses customer-owned M2M credentials and three approval-gated reads", () => {
    expect(SPROUT_SOCIAL_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(
      SPROUT_SOCIAL_CONNECTOR_MANIFEST.auth.credentialSchema.map((v) => v.name),
    ).toEqual(["SPROUT_SOCIAL_CLIENT_ID", "SPROUT_SOCIAL_CLIENT_SECRET"]);
    expect(SPROUT_SOCIAL_CONNECTOR_MANIFEST.tools).toHaveLength(3);
    expect(
      SPROUT_SOCIAL_CONNECTOR_MANIFEST.tools.every((v) => v.approvalRequired),
    ).toBe(true);
  });
  it("exchanges exact scope and strips customer, profile, and group identity", async () => {
    const requester = jest
      .fn()
      .mockResolvedValueOnce(json({ access_token: "jwt", expires_in: 3600 }))
      .mockResolvedValueOnce(
        json({ data: [{ customer_id: 12, name: "private" }] }),
      )
      .mockResolvedValueOnce(
        json({
          data: [
            {
              customer_profile_id: 34,
              network_type: "instagram",
              name: "private",
              native_name: "private",
              native_id: "private",
              groups: [7, 8],
              network_metadata: { address: "private" },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        json({ data: [{ group_id: 7, name: "private" }] }),
      );
    const api = new SproutSocialApiAdapter(requester);
    expect(await api.customers(credentials)).toEqual({ customerIds: ["12"] });
    expect(await api.profiles(credentials, "12")).toEqual({
      customerId: "12",
      profiles: [
        { customerProfileId: "34", networkType: "instagram", groupCount: 2 },
      ],
    });
    expect(await api.groups(credentials, "12")).toEqual({
      customerId: "12",
      groupIds: ["7"],
    });
    const token = requester.mock.calls[0];
    expect(String(token[0])).toBe(SproutSocialApiAdapter.tokenUrl);
    expect(String(token[1].body)).toContain("scope=organization_id");
    expect(
      requester.mock.calls
        .slice(1)
        .every(
          (v) =>
            new URL(String(v[0])).origin === SproutSocialApiAdapter.apiOrigin,
        ),
    ).toBe(true);
  });
  it("rejects unsafe customer IDs, missing credentials, and provider errors", async () => {
    const api = new SproutSocialApiAdapter(jest.fn());
    await expect(api.profiles(credentials, "../users")).rejects.toBeInstanceOf(
      SproutSocialApiError,
    );
    await expect(
      api.customers({ clientId: "", clientSecret: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    const failed = new SproutSocialApiAdapter(
      jest.fn().mockResolvedValue(json({ error: "limited" }, 429)),
    );
    await expect(failed.customers(credentials)).rejects.toMatchObject({
      code: "provider_rate_limited",
    });
  });
});
