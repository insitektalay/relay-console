import {
  MicrosoftEntraIdGraphAdapter,
  MicrosoftEntraIdGraphError,
} from "./microsoft-entra-id-graph.adapter";

describe("MicrosoftEntraIdGraphAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins a minimized signed-in identity read to Microsoft Graph v1.0", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "22cc22cc-dd33-4e44-af55-66aa66aa66aa",
          displayName: "Relay Operator",
          userPrincipalName: "operator@example.com",
          userType: "Member",
          mobilePhone: "discarded",
        }),
        { status: 200 },
      ),
    );
    await expect(
      new MicrosoftEntraIdGraphAdapter().read("access-token", "identity.get"),
    ).resolves.toEqual({
      id: "22cc22cc-dd33-4e44-af55-66aa66aa66aa",
      displayName: "Relay Operator",
      userPrincipalName: "operator@example.com",
      userType: "Member",
    });
    const url = fetchSpy.mock.calls[0]?.[0] as URL;
    expect(url.origin + url.pathname).toBe(
      "https://graph.microsoft.com/v1.0/me",
    );
    expect(url.searchParams.get("$select")).toBe(
      "id,displayName,userPrincipalName,userType",
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
  });

  it("blocks arbitrary directory operations", () => {
    expect(() =>
      new MicrosoftEntraIdGraphAdapter().read("access-token", "users.list"),
    ).toThrow(MicrosoftEntraIdGraphError);
  });
});
