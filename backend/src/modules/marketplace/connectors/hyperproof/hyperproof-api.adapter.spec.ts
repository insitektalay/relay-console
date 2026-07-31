import {
  HyperproofApiAdapter,
  HyperproofApiError,
} from "./hyperproof-api.adapter";

const credentials = { clientId: "client", clientSecret: "secret" };
const controlId = "123e4567-e89b-42d3-a456-426614174000";

describe("HyperproofApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("mints a customer service token and minimizes one exact control", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: controlId,
            orgId: "hidden-org",
            controlIdentifier: "AC-1",
            name: "Access control policy",
            description: "hidden",
            notes: "hidden",
            workStatus: "In Progress",
            status: "active",
            owner: { email: "hidden@example.com" },
            permissions: ["control.update"],
          }),
          { status: 200 },
        ),
      );

    await expect(
      new HyperproofApiAdapter().read(credentials, {
        operation: "controls.get",
        controlId,
      }),
    ).resolves.toEqual({
      control: {
        id: controlId,
        identifier: "AC-1",
        name: "Access control policy",
        workStatus: "In Progress",
        status: "active",
      },
    });

    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://accounts.hyperproof.app/oauth/token",
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({
          "Content-Type": "application/x-www-form-urlencoded",
        }),
      }),
    );
    expect(String(fetchSpy.mock.calls[0]?.[1]?.body)).toBe(
      "grant_type=client_credentials&client_id=client&client_secret=secret",
    );
    expect(String(fetchSpy.mock.calls[1]?.[0])).toBe(
      `https://api.hyperproof.app/v1/controls/${controlId}`,
    );
    expect(fetchSpy.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: "GET",
        redirect: "error",
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
  });

  it("rejects arbitrary operations and malformed control identifiers", async () => {
    const adapter = new HyperproofApiAdapter();
    await expect(
      adapter.read(credentials, {
        operation: "proof.list",
        controlId,
      }),
    ).rejects.toBeInstanceOf(HyperproofApiError);
    await expect(
      adapter.read(credentials, {
        operation: "controls.get",
        controlId: "../../proof",
      }),
    ).rejects.toBeInstanceOf(HyperproofApiError);
    await expect(
      adapter.read(credentials, {
        operation: "controls.get",
        controlId: "not-a-uuid",
      }),
    ).rejects.toBeInstanceOf(HyperproofApiError);
  });
});
