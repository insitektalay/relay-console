import { UnauthorizedException } from "@nestjs/common";
import { IsNull } from "typeorm";
import { WEB_ACCESS_COOKIE } from "../auth.constants";
import { JwtStrategy } from "./jwt.strategy";
import { RELAY_JWT_AUDIENCES } from "../auth-token-policy";

function createStrategy() {
  const configService = {
    get: jest.fn((key: string) =>
      key === "JWT_SECRET" ? "test-secret" : undefined,
    ),
  };
  const userRepository = {
    findOne: jest.fn(async () => ({
      id: "user-1",
      email: "alex@clawchat.test",
      name: "Alex",
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  };
  const webSessionRepository = {
    findOne: jest.fn(async (_options: any) => ({ id: "session-1" })),
  };
  const mobileSessionRepository = {
    findOne: jest.fn(async (_options: any) => ({ id: "mobile-session-1" })),
  };
  const strategy = new JwtStrategy(
    configService as any,
    userRepository as any,
    webSessionRepository as any,
    mobileSessionRepository as any,
  );

  return {
    configService,
    strategy,
    userRepository,
    webSessionRepository,
    mobileSessionRepository,
  };
}

describe("JwtStrategy", () => {
  it("uses an explicit IsNull predicate when validating browser web sessions", async () => {
    const { strategy, webSessionRepository, mobileSessionRepository } = createStrategy();

    const result = await strategy.validate(
      { cookies: { [WEB_ACCESS_COOKIE]: "web-token" } } as any,
      {
        sub: "user-1",
        email: "alex@clawchat.test",
        kind: "web",
        sid: "session-1",
        aud: RELAY_JWT_AUDIENCES.webAccess,
      },
    );

    expect(result.currentWebSessionId).toBe("session-1");
    expect(webSessionRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        userId: "user-1",
        revokedAt: expect.anything(),
      },
      select: ["id"],
    });
    const findCall = webSessionRepository.findOne.mock.calls[0]?.[0] as any;
    expect(findCall.where.revokedAt).toEqual(IsNull());
  });

  it("rejects browser web sessions that do not match the active-session predicate", async () => {
    const { strategy, webSessionRepository } = createStrategy();
    webSessionRepository.findOne.mockResolvedValueOnce(null);

    await expect(
      strategy.validate(
        { cookies: { [WEB_ACCESS_COOKIE]: "web-token" } } as any,
        {
          sub: "user-1",
          email: "alex@clawchat.test",
          kind: "web",
          sid: "revoked-session",
          aud: RELAY_JWT_AUDIENCES.webAccess,
        },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const findCall = webSessionRepository.findOne.mock.calls[0]?.[0] as any;
    expect(findCall.where.revokedAt).toEqual(IsNull());
  });

  it("rejects a browser token replayed through the bearer transport", async () => {
    const { strategy, webSessionRepository } = createStrategy();

    await expect(
      strategy.validate(
        { headers: { authorization: "Bearer web-token" }, cookies: {} } as any,
        {
          sub: "user-1",
          email: "alex@clawchat.test",
          kind: "web",
          sid: "session-1",
          aud: RELAY_JWT_AUDIENCES.webAccess,
        },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(webSessionRepository.findOne).not.toHaveBeenCalled();
  });

  it("rejects a bearer browser token even when a browser cookie is also present", async () => {
    const { strategy, webSessionRepository } = createStrategy();

    await expect(
      strategy.validate(
        {
          headers: { authorization: "Bearer web-token" },
          cookies: { [WEB_ACCESS_COOKIE]: "unrelated-cookie" },
        } as any,
        {
          sub: "user-1",
          email: "alex@clawchat.test",
          kind: "web",
          sid: "session-1",
          aud: RELAY_JWT_AUDIENCES.webAccess,
        },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(webSessionRepository.findOne).not.toHaveBeenCalled();
  });

  it("accepts a mobile bearer token when an unrelated browser cookie is stale", async () => {
    const { strategy, webSessionRepository, mobileSessionRepository } = createStrategy();

    const result = await strategy.validate(
      {
        headers: { authorization: "Bearer mobile-token" },
        cookies: { [WEB_ACCESS_COOKIE]: "stale-cookie" },
      } as any,
      {
        sub: "user-1",
        email: "alex@clawchat.test",
        kind: "mobile",
        sid: "mobile-session-1",
        aud: RELAY_JWT_AUDIENCES.mobileAccess,
      },
    );

    expect(result.currentMobileSessionId).toBe("mobile-session-1");
    expect(webSessionRepository.findOne).not.toHaveBeenCalled();
    expect(mobileSessionRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: "mobile-session-1",
        userId: "user-1",
        revokedAt: expect.anything(),
      },
      select: ["id"],
    });
    const findCall = mobileSessionRepository.findOne.mock.calls[0]?.[0] as any;
    expect(findCall.where.revokedAt).toEqual(IsNull());
  });

  it("rejects a bearer access token for a revoked mobile session immediately", async () => {
    const { strategy, mobileSessionRepository } = createStrategy();
    mobileSessionRepository.findOne.mockResolvedValueOnce(null);

    await expect(
      strategy.validate(
        { headers: { authorization: "Bearer mobile-token" }, cookies: {} } as any,
        {
          sub: "user-1",
          email: "alex@clawchat.test",
          kind: "mobile",
          sid: "revoked-mobile-session",
          aud: RELAY_JWT_AUDIENCES.mobileAccess,
        },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const findCall = mobileSessionRepository.findOne.mock.calls[0]?.[0] as any;
    expect(findCall.where.revokedAt).toEqual(IsNull());
  });

  it("rejects sid-less legacy tokens even if a legacy database slot exists", async () => {
    const { strategy, mobileSessionRepository } = createStrategy();

    await expect(
      strategy.validate(
        { headers: { authorization: "Bearer legacy-token" }, cookies: {} } as any,
        {
          sub: "user-1",
          email: "alex@clawchat.test",
          kind: "mobile",
          aud: RELAY_JWT_AUDIENCES.mobileAccess,
        } as any,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mobileSessionRepository.findOne).not.toHaveBeenCalled();
  });

  it("rejects a sid-less legacy access token after logout clears its slot", async () => {
    const { strategy } = createStrategy();

    await expect(
      strategy.validate(
        { headers: { authorization: "Bearer legacy-token" }, cookies: {} } as any,
        {
          sub: "user-1",
          email: "alex@clawchat.test",
          kind: "mobile",
          aud: RELAY_JWT_AUDIENCES.mobileAccess,
        } as any,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a mobile token presented only through the browser cookie", async () => {
    const { strategy, webSessionRepository } = createStrategy();

    await expect(
      strategy.validate(
        { headers: {}, cookies: { [WEB_ACCESS_COOKIE]: "mobile-token" } } as any,
        {
          sub: "user-1",
          email: "alex@clawchat.test",
          kind: "mobile",
          sid: "mobile-session-1",
          aud: RELAY_JWT_AUDIENCES.mobileAccess,
        },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(webSessionRepository.findOne).not.toHaveBeenCalled();
  });

  it("rejects a mobile-kind token carrying the web access audience", async () => {
    const { strategy, mobileSessionRepository } = createStrategy();

    await expect(
      strategy.validate(
        { headers: { authorization: "Bearer crossed-token" }, cookies: {} } as any,
        {
          sub: "user-1",
          email: "alex@clawchat.test",
          kind: "mobile",
          sid: "mobile-session-1",
          aud: RELAY_JWT_AUDIENCES.webAccess,
        },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(mobileSessionRepository.findOne).not.toHaveBeenCalled();
  });
});
