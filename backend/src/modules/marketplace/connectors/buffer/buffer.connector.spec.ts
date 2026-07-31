import { BufferApiAdapter, BufferApiError } from "./buffer-api.adapter";
import { BUFFER_CONNECTOR_MANIFEST } from "./buffer.connector";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
describe("Buffer connector", () => {
  const credentials = { accessToken: "test-token" };
  it("uses least-privilege PKCE OAuth and three approval-gated reads", () => {
    expect(BUFFER_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      requiredScopes: ["account:read", "offline_access"],
      pkce: true,
      supportsRefresh: true,
    });
    expect(BUFFER_CONNECTOR_MANIFEST.tools).toHaveLength(3);
    expect(
      BUFFER_CONNECTOR_MANIFEST.tools.every((t) => t.approvalRequired),
    ).toBe(true);
  });
  it("sends static GraphQL and strips identity/content", async () => {
    const requester = jest
      .fn()
      .mockResolvedValueOnce(
        json({
          data: {
            account: {
              id: "acct_1",
              email: "private",
              createdAt: "2026-01-01T00:00:00Z",
              timezone: "UTC",
              organizations: [
                { id: "org_1", channelCount: 2, name: "private" },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        json({
          data: {
            account: {
              organizations: [
                { id: "org_1", channelCount: 2, ownerEmail: "private" },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        json({
          data: {
            channels: [
              {
                id: "chan_1",
                name: "private",
                serviceId: "private",
                service: "instagram",
                type: "business",
                timezone: "UTC",
                updatedAt: "2026-01-02T00:00:00Z",
              },
            ],
          },
        }),
      );
    const api = new BufferApiAdapter(requester);
    expect(await api.account(credentials)).toMatchObject({
      id: "acct_1",
      organizationCount: 1,
    });
    expect(await api.organizations(credentials)).toEqual({
      organizations: [{ id: "org_1", channelCount: 2 }],
    });
    expect(await api.channels(credentials, "org_1")).toEqual({
      organizationId: "org_1",
      channels: [
        {
          id: "chan_1",
          service: "instagram",
          type: "business",
          timezone: "UTC",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    expect(
      requester.mock.calls.every(
        (c) => String(c[0]) === "https://api.buffer.com",
      ),
    ).toBe(true);
  });
  it("rejects unsafe IDs, missing tokens and GraphQL errors", async () => {
    const api = new BufferApiAdapter(
      jest.fn().mockResolvedValue(json({ data: { channels: [] } })),
    );
    await expect(
      api.channels(credentials, "../account"),
    ).rejects.toBeInstanceOf(BufferApiError);
    await expect(api.account({ accessToken: "" })).rejects.toMatchObject({
      code: "credential_missing",
    });
    const failed = new BufferApiAdapter(
      jest.fn().mockResolvedValue(json({ errors: [{ message: "no" }] })),
    );
    await expect(failed.account(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
