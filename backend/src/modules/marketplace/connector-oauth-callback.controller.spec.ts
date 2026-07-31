import { MarketplaceConnectorOAuthCallbackController } from "./connector-oauth-callback.controller";

describe("MarketplaceConnectorOAuthCallbackController implicit OAuth", () => {
  it("destroys denied state and never reflects the provider description", async () => {
    const service = {
      buildCallbackRedirect: jest.fn(
        async () => "https://relayconsole.work/app?status=error",
      ),
      cancelOAuthState: jest.fn(async () => true),
      completeOAuth: jest.fn(),
    };
    const response = { redirect: jest.fn((url: string) => url) };
    const controller = new MarketplaceConnectorOAuthCallbackController(
      service as never,
    );
    const args = Array(26).fill(undefined);
    args[0] = "outlook";
    args[1] = "";
    args[2] = "returned-state";
    args[3] = "access_denied";
    args[4] = "secret provider diagnostic";
    args[24] = {
      originalUrl: "/api/v1/marketplace/oauth/outlook/callback",
      query: {},
    };
    args[25] = response;

    await (controller.callback as any)(...args);

    expect(service.buildCallbackRedirect).toHaveBeenCalledWith("outlook", {
      state: "returned-state",
      status: "error",
      message: "OAuth authorization was denied.",
    });
    expect(service.cancelOAuthState).toHaveBeenCalledWith(
      "outlook",
      "returned-state",
    );
    expect(
      JSON.stringify(service.buildCallbackRedirect.mock.calls),
    ).not.toContain("secret provider diagnostic");
    expect(response.redirect).toHaveBeenCalled();
  });

  it("serves a visible app-return page instead of leaving an external browser blank", async () => {
    const service = {
      buildCallbackRedirect: jest.fn(
        async () =>
          "relayconsole://marketplace/oauth?workspace_id=ws1&marketplace_app=jotform&connector_oauth=jotform&status=error&error=oauth_failed",
      ),
      cancelOAuthState: jest.fn(async () => true),
      completeOAuth: jest.fn(),
    };
    const send = jest.fn();
    const response = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      send,
      redirect: jest.fn(),
    };
    const controller = new MarketplaceConnectorOAuthCallbackController(
      service as never,
    );
    const args = Array(26).fill(undefined);
    args[0] = "jotform";
    args[1] = "";
    args[2] = "returned-state";
    args[3] = "invalid_request";
    args[4] = "provider details must not be reflected";
    args[24] = {
      originalUrl: "/api/v1/marketplace/oauth/jotform/callback",
      query: {},
    };
    args[25] = response;

    await (controller.callback as any)(...args);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.redirect).not.toHaveBeenCalled();
    const html = String(send.mock.calls[0][0]);
    expect(html).toContain("Connection not completed");
    expect(html).toContain("Return to Relay Console");
    expect(html).toContain("window.location.assign");
    expect(html).not.toContain("provider details must not be reflected");
  });

  it("serves a no-store fragment bridge for Contentful without placing the token in a query", async () => {
    const controller = new MarketplaceConnectorOAuthCallbackController(
      {} as never,
    );
    const send = jest.fn();
    const response = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      send,
    } as never;
    await controller.callback(
      "contentful",
      "",
      "",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { originalUrl: "/api/v1/marketplace/oauth/contentful/callback" } as never,
      response,
    );
    expect(send).toHaveBeenCalledTimes(1);
    const html = String(send.mock.calls[0][0]);
    expect(html).toContain('params.get("access_token")');
    expect(html).toContain('params.get("state")');
    expect(html).toContain("history.replaceState");
    expect(html).not.toContain("access_token=");
  });

  it("passes the Contentful fragment token into the one-time state completion path", async () => {
    const service = {
      completeOAuth: jest
        .fn()
        .mockResolvedValue({ connection: { id: "conn1" }, returnTo: "/app" }),
      buildCallbackRedirect: jest
        .fn()
        .mockResolvedValue(
          "https://relayconsole.work/app?connected=contentful",
        ),
    };
    const controller = new MarketplaceConnectorOAuthCallbackController(
      service as never,
    );
    const response = { json: jest.fn((value) => value) } as never;
    await expect(
      controller.implicitCallback(
        "contentful",
        { state: "state1", accessToken: "token1" },
        response,
      ),
    ).resolves.toEqual({
      redirectUrl: "https://relayconsole.work/app?connected=contentful",
    });
    expect(service.completeOAuth).toHaveBeenCalledWith("contentful", {
      state: "state1",
      code: "token1",
    });
  });

  it("completes Copper's HTTPS form-post callback and redirects without exposing the code", async () => {
    const service = {
      completeOAuth: jest.fn().mockResolvedValue({
        connection: { id: "conn_copper" },
        returnTo: "/app?marketplace_app=copper",
      }),
      buildCallbackRedirect: jest
        .fn()
        .mockResolvedValue(
          "https://relayconsole.work/app?marketplace_app=copper&status=connected",
        ),
    };
    const redirect = jest.fn((value) => value);
    const controller = new MarketplaceConnectorOAuthCallbackController(
      service as never,
    );

    await controller.implicitCallback(
      "copper",
      { state: "state_copper", code: "secret-code" },
      { redirect } as never,
    );

    expect(service.completeOAuth).toHaveBeenCalledWith("copper", {
      state: "state_copper",
      code: "secret-code",
    });
    expect(redirect).toHaveBeenCalledWith(
      "https://relayconsole.work/app?marketplace_app=copper&status=connected",
    );
    expect(JSON.stringify(redirect.mock.calls)).not.toContain("secret-code");
  });
});
