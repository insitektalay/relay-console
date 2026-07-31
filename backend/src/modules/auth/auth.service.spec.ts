import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { UserEntity } from "../../entities/user.entity";
import { BetaInviteEntity } from "../../entities/beta-invite.entity";
import { WebSessionEntity } from "../../entities/web-session.entity";
import { MobileSessionEntity } from "../../entities/mobile-session.entity";
import * as bcrypt from "bcryptjs";
import { createHmac } from "crypto";
import { AuditLogService } from "../audit-log/audit-log.service";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import { AccountActionTokenEntity } from "../../entities/account-action-token.entity";
import { TransactionalEmailService } from "./transactional-email.service";
import { EmailChangeRequestEntity } from "../../entities/email-change-request.entity";
import { IsNull } from "typeorm";
import { WebsocketTicketReplayService } from "../../gateways/websocket-ticket-replay.service";
import {
  RELAY_JWT_AUDIENCES,
  RELAY_JWT_ISSUER,
} from "./auth-token-policy";

jest.setTimeout(20000);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockUser: Partial<UserEntity> = {
  id: "user-001",
  email: "alex@clawchat.io",
  name: "Alex Chen",
  passwordHash: "",
  refreshToken: null,
  emailVerifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeUserRepoMock() {
  return {
    findOne: jest.fn(),
    create: jest.fn().mockImplementation((dto) => ({ ...mockUser, ...dto })),
    save: jest
      .fn()
      .mockImplementation((u) => Promise.resolve({ ...mockUser, ...u })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

function makeJwtServiceMock() {
  return {
    signAsync: jest.fn().mockResolvedValue("mock.jwt.token"),
    verifyAsync: jest.fn().mockResolvedValue({
      sub: "user-001",
      sid: "mobile-session-1",
      kind: "mobile",
      aud: RELAY_JWT_AUDIENCES.mobileRefresh,
    }),
  };
}

function makeWebSessionRepoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest
      .fn()
      .mockImplementation((dto) => ({ id: "session-1", ...dto })),
    save: jest
      .fn()
      .mockImplementation((dto) =>
        Promise.resolve({ id: "session-1", ...dto }),
      ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    }),
  };
}

function makeBetaInviteRepoMock() {
  const queryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((dto) => ({ id: "invite-1", ...dto })),
    save: jest
      .fn()
      .mockImplementation((dto) => Promise.resolve({ id: "invite-1", ...dto })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    queryBuilder,
  };
}

function makeMobileSessionRepoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest
      .fn()
      .mockImplementation((dto) => ({ id: "mobile-session-1", ...dto })),
    save: jest
      .fn()
      .mockImplementation((dto) =>
        Promise.resolve({ id: "mobile-session-1", ...dto }),
      ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    }),
  };
}

function makeAccountActionTokenRepoMock() {
  return {
    findOne: jest.fn(),
    create: jest
      .fn()
      .mockImplementation((dto) => ({ id: "account-token-1", ...dto })),
    save: jest
      .fn()
      .mockImplementation((dto) =>
        Promise.resolve({ id: "account-token-1", ...dto }),
      ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

function makeEmailChangeRequestRepoMock() {
  return {
    findOne: jest.fn(),
    create: jest.fn().mockImplementation((dto) => ({
      id: "email-change-1",
      ...dto,
    })),
    save: jest
      .fn()
      .mockImplementation((dto) =>
        Promise.resolve({ id: "email-change-1", ...dto }),
      ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

function makeConfigServiceMock() {
  return {
    get: jest.fn((key: string) => {
      const cfg: Record<string, string> = {
        JWT_SECRET: "test-secret",
        JWT_REFRESH_SECRET: "test-refresh-secret",
        JWT_WS_SECRET: "test-websocket-secret",
        CLAWCHAT_BETA_INVITE_HASH_SECRET: "test-beta-invite-hash-secret-2026",
        JWT_EXPIRES_IN: "15m",
        JWT_REFRESH_EXPIRES_IN: "30d",
        CLAWCHAT_BETA_INVITE_CODES: "test-invite",
      };
      return cfg[key];
    }),
  };
}

async function buildService() {
  const userRepo = makeUserRepoMock();
  const betaInviteRepo = makeBetaInviteRepoMock();
  const webSessionRepo = makeWebSessionRepoMock();
  const mobileSessionRepo = makeMobileSessionRepoMock();
  const accountActionTokenRepo = makeAccountActionTokenRepoMock();
  const emailChangeRequestRepo = makeEmailChangeRequestRepoMock();
  const transactionalManager = {
    getRepository: jest.fn((entity) => {
      if (entity === UserEntity) return userRepo;
      if (entity === BetaInviteEntity) return betaInviteRepo;
      if (entity === WebSessionEntity) return webSessionRepo;
      if (entity === MobileSessionEntity) return mobileSessionRepo;
      if (entity === AccountActionTokenEntity) return accountActionTokenRepo;
      if (entity === EmailChangeRequestEntity) return emailChangeRequestRepo;
      throw new Error(`Unexpected transactional repository ${String(entity)}`);
    }),
  };
  (userRepo as any).manager = {
    transaction: jest.fn(async (callback) => callback(transactionalManager)),
  };
  const jwtService = makeJwtServiceMock();
  const configService = makeConfigServiceMock();
  const auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
  const workspaceMembershipService = {
    ensureWorkspaceAccess: jest.fn().mockResolvedValue({
      workspace: { id: "ws-001", ownerId: "user-001" },
      role: "owner",
    }),
  };
  const transactionalEmailService = {
    isEnabled: jest.fn().mockReturnValue(false),
    sendEmailVerification: jest.fn().mockResolvedValue({ id: "email-1" }),
    sendPasswordReset: jest.fn().mockResolvedValue({ id: "email-1" }),
    sendEmailChangeVerification: jest.fn().mockResolvedValue({ id: "email-1" }),
    sendEmailChangeSecurityNotice: jest
      .fn()
      .mockResolvedValue({ id: "email-2" }),
    sendEmailChangeCompletedNotice: jest
      .fn()
      .mockResolvedValue({ id: "email-3" }),
  };
  const websocketTickets = {
    register: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockResolvedValue(undefined),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: getRepositoryToken(UserEntity), useValue: userRepo },
      {
        provide: getRepositoryToken(BetaInviteEntity),
        useValue: betaInviteRepo,
      },
      {
        provide: getRepositoryToken(WebSessionEntity),
        useValue: webSessionRepo,
      },
      {
        provide: getRepositoryToken(MobileSessionEntity),
        useValue: mobileSessionRepo,
      },
      {
        provide: getRepositoryToken(AccountActionTokenEntity),
        useValue: accountActionTokenRepo,
      },
      {
        provide: getRepositoryToken(EmailChangeRequestEntity),
        useValue: emailChangeRequestRepo,
      },
      { provide: JwtService, useValue: jwtService },
      { provide: ConfigService, useValue: configService },
      { provide: AuditLogService, useValue: auditLogService },
      {
        provide: WorkspaceMembershipService,
        useValue: workspaceMembershipService,
      },
      {
        provide: TransactionalEmailService,
        useValue: transactionalEmailService,
      },
      {
        provide: WebsocketTicketReplayService,
        useValue: websocketTickets,
      },
    ],
  }).compile();

  return {
    service: module.get<AuthService>(AuthService),
    userRepo,
    betaInviteRepo,
    webSessionRepo,
    mobileSessionRepo,
    accountActionTokenRepo,
    emailChangeRequestRepo,
    jwtService,
    configService,
    auditLogService,
    workspaceMembershipService,
    transactionalManager,
    transactionalEmailService,
    websocketTickets,
  };
}

describe("AuthService invite hash lifecycle", () => {
  it("keeps one-use invite hashes independent from JWT rotation", async () => {
    const { service, configService } = await buildService();
    let jwtSecret = "jwt-secret-before-rotation";
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        JWT_SECRET: jwtSecret,
        CLAWCHAT_BETA_INVITE_HASH_SECRET: "dedicated-invite-hash-secret-2026",
      };
      return values[key];
    });

    const before = (service as any).hashInviteCode("one-use-code");
    jwtSecret = "jwt-secret-after-rotation";
    const after = (service as any).hashInviteCode("one-use-code");

    expect(after).toBe(before);
  });

  it("fails closed when the dedicated invite hash secret is absent", async () => {
    const { service, configService } = await buildService();
    configService.get.mockImplementation((key: string) =>
      key === "JWT_SECRET" ? "main-jwt-secret" : undefined,
    );

    expect(() => (service as any).hashInviteCode("one-use-code")).toThrow(
      "CLAWCHAT_BETA_INVITE_HASH_SECRET_MISSING",
    );
  });

  it("migrates configured legacy JWT-derived hashes before accepting traffic", async () => {
    const { service, betaInviteRepo } = await buildService();
    const legacyHash = createHmac("sha256", "test-secret")
      .update("test-invite")
      .digest("hex");
    const currentHash = createHmac(
      "sha256",
      "test-beta-invite-hash-secret-2026",
    )
      .update("test-invite")
      .digest("hex");
    betaInviteRepo.findOne.mockResolvedValue(null);
    betaInviteRepo.find.mockResolvedValue([
      { id: "legacy-invite", codeHash: legacyHash },
    ]);

    await service.onModuleInit();

    expect(betaInviteRepo.update).toHaveBeenCalledWith(
      { id: "legacy-invite", codeHash: legacyHash },
      { codeHash: currentHash },
    );
  });

  it("keeps a consumed configured invite rejected after JWT rotation", async () => {
    const { service, betaInviteRepo, configService } = await buildService();
    const dedicatedSecret = "test-beta-invite-hash-secret-2026";
    let jwtSecret = "jwt-secret-before-rotation";
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        JWT_SECRET: jwtSecret,
        CLAWCHAT_BETA_INVITE_HASH_SECRET: dedicatedSecret,
        CLAWCHAT_BETA_INVITE_CODES: "test-invite",
        CLAWCHAT_BETA_SIGNUP_MODE: "invite",
      };
      return values[key];
    });
    const legacyHash = createHmac("sha256", jwtSecret)
      .update("test-invite")
      .digest("hex");
    const currentHash = createHmac("sha256", dedicatedSecret)
      .update("test-invite")
      .digest("hex");
    const storedInvite = {
      id: "consumed-invite",
      codeHash: legacyHash,
      email: null,
      maxUses: 1,
      useCount: 1,
      expiresAt: null,
      revokedAt: null,
    };
    betaInviteRepo.findOne.mockImplementation(({ where }) =>
      Promise.resolve(
        where.codeHash === storedInvite.codeHash ? storedInvite : null,
      ),
    );
    betaInviteRepo.find.mockImplementation(() =>
      Promise.resolve(
        storedInvite.codeHash === legacyHash ? [storedInvite] : [],
      ),
    );
    betaInviteRepo.update.mockImplementation((criteria, update) => {
      if (
        criteria.id !== storedInvite.id ||
        criteria.codeHash !== storedInvite.codeHash
      ) {
        return Promise.resolve({ affected: 0 });
      }
      storedInvite.codeHash = update.codeHash;
      return Promise.resolve({ affected: 1 });
    });

    await service.onModuleInit();
    jwtSecret = "jwt-secret-after-rotation";

    await expect(
      (service as any).requireInviteCode(
        "test-invite",
        "new-user@example.com",
        betaInviteRepo,
      ),
    ).rejects.toThrow("A valid beta invite code is required.");
    expect(storedInvite.codeHash).toBe(currentHash);
    expect(betaInviteRepo.save).not.toHaveBeenCalled();
  });

  it("fails startup when one raw invite resolves to conflicting hash records", async () => {
    const { service, betaInviteRepo } = await buildService();
    betaInviteRepo.findOne.mockResolvedValue(null);
    betaInviteRepo.find.mockResolvedValue([
      { id: "legacy-a", codeHash: "legacy-a" },
      { id: "legacy-b", codeHash: "legacy-b" },
    ]);

    await expect(service.onModuleInit()).rejects.toThrow(
      "CLAWCHAT_BETA_INVITE_HASH_CONFLICT",
    );
    expect(betaInviteRepo.update).not.toHaveBeenCalled();
  });

  it("fails startup when current and legacy hashes both exist for one raw invite", async () => {
    const { service, betaInviteRepo } = await buildService();
    betaInviteRepo.findOne.mockResolvedValue({
      id: "current-invite",
      codeHash: "current-hash",
    });
    betaInviteRepo.find.mockResolvedValue([
      { id: "legacy-invite", codeHash: "legacy-hash" },
    ]);

    await expect(service.onModuleInit()).rejects.toThrow(
      "CLAWCHAT_BETA_INVITE_HASH_CONFLICT",
    );
    expect(betaInviteRepo.update).not.toHaveBeenCalled();
  });
});

// ─── Register ────────────────────────────────────────────────────────────────

describe("AuthService.register", () => {
  it("successfully registers a new user and returns tokens", async () => {
    const {
      service,
      userRepo,
      betaInviteRepo,
      mobileSessionRepo,
      auditLogService,
    } = await buildService();
    userRepo.findOne.mockResolvedValue(null);

    const result = await service.register(
      {
        email: "alex@clawchat.io",
        name: "Alex Chen",
        password: "UnitTestPassword2026!",
        inviteCode: "test-invite",
      },
      { deviceName: "iPad", platform: "iPadOS" },
    );

    expect(result.tokens.accessToken).toBe("mock.jwt.token");
    expect(result.tokens.refreshToken).toBe("mock.jwt.token");
    expect(result.user.email).toBe("alex@clawchat.io");
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.user).not.toHaveProperty("refreshToken");
    expect(userRepo.save).toHaveBeenCalledTimes(1);
    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        betaAccessEndsAt: expect.any(Date),
      }),
    );
    const betaAccessEndsAt = userRepo.create.mock.calls[0][0].betaAccessEndsAt;
    expect(betaAccessEndsAt.getTime()).toBeGreaterThan(
      Date.now() + 59 * 24 * 60 * 60 * 1000,
    );
    expect(betaAccessEndsAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 60 * 24 * 60 * 60 * 1000,
    );
    expect(userRepo.update).not.toHaveBeenCalled();
    expect(mobileSessionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-001",
        refreshTokenHash: "",
        deviceName: "iPad",
        platform: "iPadOS",
        revokedAt: null,
      }),
    );
    expect(mobileSessionRepo.update).toHaveBeenCalledWith(
      "mobile-session-1",
      expect.objectContaining({ refreshTokenHash: expect.any(String) }),
    );
    expect(betaInviteRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        maxUses: 1,
        useCount: 0,
      }),
    );
    expect(betaInviteRepo.queryBuilder.execute).toHaveBeenCalled();
    expect(betaInviteRepo.queryBuilder.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastUsedByUserId: "user-001",
        lastUsedEmail: "alex@clawchat.io",
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "auth.invite.accepted",
        resourceType: "beta_invite",
        resourceId: "invite-1",
      }),
    );
  });

  it("lowercases email on registration", async () => {
    const { service, userRepo } = await buildService();
    userRepo.findOne.mockResolvedValue(null);
    userRepo.save.mockImplementation((u) =>
      Promise.resolve({ ...u, id: "user-new" }),
    );

    await service.register({
      email: "ALEX@ClawChat.IO",
      name: "Alex Chen",
      password: "UnitTestPassword2026!",
      inviteCode: "test-invite",
    });

    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: "alex@clawchat.io" }),
    );
  });

  it("throws ConflictException when email already registered", async () => {
    const { service, userRepo } = await buildService();
    userRepo.findOne.mockResolvedValue(mockUser);

    await expect(
      service.register({
        email: "alex@clawchat.io",
        name: "Alex",
        password: "pass123",
        inviteCode: "test-invite",
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("requires a valid invite code while beta signup is invite-only", async () => {
    const { service, userRepo, betaInviteRepo } = await buildService();

    await expect(
      service.register({
        email: "new@test.io",
        name: "Test",
        password: "UnitTestPassword2026!",
        inviteCode: "wrong-code",
      }),
    ).rejects.toThrow(BadRequestException);
    expect(userRepo.findOne).toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(betaInviteRepo.save).not.toHaveBeenCalled();
  });

  it("rejects an exhausted invite record", async () => {
    const { service, userRepo, betaInviteRepo } = await buildService();
    userRepo.findOne.mockResolvedValue(null);
    betaInviteRepo.findOne.mockResolvedValue({
      id: "invite-1",
      codeHash: "hash",
      email: null,
      maxUses: 1,
      useCount: 1,
      expiresAt: null,
      revokedAt: null,
    });
    betaInviteRepo.queryBuilder.execute.mockResolvedValueOnce({ affected: 0 });

    await expect(
      service.register({
        email: "new@test.io",
        name: "Test",
        password: "UnitTestPassword2026!",
        inviteCode: "test-invite",
      }),
    ).rejects.toThrow(BadRequestException);
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it("rejects an email-bound invite for a different email address", async () => {
    const { service, userRepo, betaInviteRepo } = await buildService();
    userRepo.findOne.mockResolvedValue(null);
    betaInviteRepo.findOne.mockResolvedValue({
      id: "invite-1",
      codeHash: "hash",
      email: "invited@example.com",
      maxUses: 1,
      useCount: 0,
      expiresAt: null,
      revokedAt: null,
    });

    await expect(
      service.register({
        email: "new@test.io",
        name: "Test",
        password: "UnitTestPassword2026!",
        inviteCode: "test-invite",
      }),
    ).rejects.toThrow(BadRequestException);
    expect(betaInviteRepo.queryBuilder.execute).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it("hashes the password before saving", async () => {
    const { service, userRepo } = await buildService();
    userRepo.findOne.mockResolvedValue(null);
    const plainPassword = "UnitTestPassword2026!";

    await service.register({
      email: "new@test.io",
      name: "Test",
      password: plainPassword,
      inviteCode: "test-invite",
    });

    const createCall = userRepo.create.mock.calls[0][0];
    expect(createCall.passwordHash).not.toBe(plainPassword);
    const isHashed = await bcrypt.compare(
      plainPassword,
      createCall.passwordHash,
    );
    expect(isHashed).toBe(true);
  });

  it("does not consume an invite when native session creation fails", async () => {
    const {
      service,
      userRepo,
      mobileSessionRepo,
      betaInviteRepo,
      auditLogService,
    } = await buildService();
    userRepo.findOne.mockResolvedValue(null);
    mobileSessionRepo.save.mockRejectedValueOnce(
      new Error("mobile session persistence failed"),
    );

    await expect(
      service.register({
        email: "new@test.io",
        name: "Test",
        password: "UnitTestPassword2026!",
        inviteCode: "test-invite",
      }),
    ).rejects.toThrow("mobile session persistence failed");

    expect(betaInviteRepo.queryBuilder.execute).not.toHaveBeenCalled();
    expect(auditLogService.record).not.toHaveBeenCalled();
  });
});

describe("AuthService.registerWeb", () => {
  it("creates a browser cookie session without storing a legacy browser-visible refresh token", async () => {
    const { service, userRepo, betaInviteRepo, webSessionRepo, jwtService } =
      await buildService();
    userRepo.findOne.mockResolvedValue(null);

    const result = await service.registerWeb(
      {
        email: "alex@clawchat.io",
        name: "Alex Chen",
        password: "UnitTestPassword2026!",
        inviteCode: "test-invite",
      },
      { ipAddress: "203.0.113.10", userAgent: "Test Browser" },
    );

    expect(result.user.email).toBe("alex@clawchat.io");
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.user).not.toHaveProperty("refreshToken");
    expect(result.tokens.sessionId).toBe("session-1");
    expect(userRepo.update).not.toHaveBeenCalled();
    expect(webSessionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-001",
        refreshTokenHash: "",
        revokedAt: null,
        ipAddress: "203.0.113.10",
        userAgent: "Test Browser",
      }),
    );
    expect(webSessionRepo.update).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({
        refreshTokenHash: expect.any(String),
        revokedAt: null,
      }),
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "user-001",
        email: "alex@clawchat.io",
        kind: "web",
        sid: "session-1",
      }),
      expect.any(Object),
    );
    expect((userRepo as any).manager.transaction).toHaveBeenCalledTimes(1);
    expect(
      betaInviteRepo.queryBuilder.execute.mock.invocationCallOrder[0],
    ).toBeGreaterThan(webSessionRepo.update.mock.invocationCallOrder[0]);
  });

  it("does not burn an invite when browser session creation fails", async () => {
    const {
      service,
      userRepo,
      betaInviteRepo,
      webSessionRepo,
      auditLogService,
    } = await buildService();
    userRepo.findOne.mockResolvedValue(null);
    webSessionRepo.save.mockRejectedValueOnce(
      new Error("session persistence failed"),
    );

    await expect(
      service.registerWeb(
        {
          email: "alex@clawchat.io",
          name: "Alex Chen",
          password: "UnitTestPassword2026!",
          inviteCode: "test-invite",
        },
        { ipAddress: "203.0.113.10", userAgent: "Test Browser" },
      ),
    ).rejects.toThrow("session persistence failed");

    expect((userRepo as any).manager.transaction).toHaveBeenCalledTimes(1);
    expect(betaInviteRepo.queryBuilder.execute).not.toHaveBeenCalled();
    expect(auditLogService.record).not.toHaveBeenCalled();
  });
});

// ─── Login ───────────────────────────────────────────────────────────────────

describe("AuthService.login", () => {
  it("successfully logs in with correct credentials", async () => {
    const { service, userRepo, mobileSessionRepo, jwtService } =
      await buildService();
    const hash = await bcrypt.hash("UnitTestPassword2026!", 10);
    userRepo.findOne.mockResolvedValue({ ...mockUser, passwordHash: hash });

    const result = await service.login(
      { email: "alex@clawchat.io", password: "UnitTestPassword2026!" },
      { deviceName: "Mac", platform: "macOS" },
    );

    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.user.email).toBe("alex@clawchat.io");
    expect(mobileSessionRepo.update).toHaveBeenCalledWith(
      "mobile-session-1",
      expect.objectContaining({ refreshTokenHash: expect.any(String) }),
    );
    expect(userRepo.update).toHaveBeenCalledWith("user-001", {
      refreshToken: null,
    });
    expect(mobileSessionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceName: "Mac",
        platform: "macOS",
      }),
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sid: "mobile-session-1", kind: "mobile" }),
      expect.any(Object),
    );
  });

  it("throws UnauthorizedException for wrong password", async () => {
    const { service, userRepo } = await buildService();
    const hash = await bcrypt.hash("CorrectPassword", 10);
    userRepo.findOne.mockResolvedValue({ ...mockUser, passwordHash: hash });

    await expect(
      service.login({ email: "alex@clawchat.io", password: "WrongPassword" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("does not create a new session for an unverified account", async () => {
    const { service, userRepo, mobileSessionRepo } = await buildService();
    const hash = await bcrypt.hash("CorrectPassword", 10);
    userRepo.findOne.mockResolvedValue({
      ...mockUser,
      passwordHash: hash,
      emailVerifiedAt: null,
    });

    await expect(
      service.login({
        email: "alex@clawchat.io",
        password: "CorrectPassword",
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(mobileSessionRepo.create).not.toHaveBeenCalled();
  });

  it("throws UnauthorizedException for non-existent user", async () => {
    const { service, userRepo } = await buildService();
    userRepo.findOne.mockResolvedValue(null);

    await expect(
      service.login({ email: "ghost@clawchat.io", password: "anything" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("does not expose passwordHash in login response", async () => {
    const { service, userRepo } = await buildService();
    const hash = await bcrypt.hash("UnitTestPassword2026!", 10);
    userRepo.findOne.mockResolvedValue({ ...mockUser, passwordHash: hash });

    const result = await service.login({
      email: "alex@clawchat.io",
      password: "UnitTestPassword2026!",
    });

    expect(result.user).not.toHaveProperty("passwordHash");
  });
});

describe("AuthService.loginWeb", () => {
  it("does not create a browser session for an unverified account", async () => {
    const { service, userRepo, webSessionRepo } = await buildService();
    const hash = await bcrypt.hash("CorrectPassword", 10);
    userRepo.findOne.mockResolvedValue({
      ...mockUser,
      passwordHash: hash,
      emailVerifiedAt: null,
    });

    await expect(
      service.loginWeb({
        email: "alex@clawchat.io",
        password: "CorrectPassword",
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(webSessionRepo.save).not.toHaveBeenCalled();
  });
});

describe("AuthService bcrypt byte boundary", () => {
  const boundaryPassword = "€".repeat(24);
  const overLimitPassword = `${boundaryPassword}a`;

  it("authenticates an existing password of exactly 72 UTF-8 bytes", async () => {
    const { service, userRepo } = await buildService();
    userRepo.findOne.mockResolvedValue({
      ...mockUser,
      passwordHash: await bcrypt.hash(boundaryPassword, 4),
    });

    await expect(
      service.login({
        email: "alex@clawchat.io",
        password: boundaryPassword,
      }),
    ).resolves.toMatchObject({
      user: { id: "user-001" },
    });
  });

  it("rejects over-limit registration before opening a transaction", async () => {
    const { service, userRepo } = await buildService();

    await expect(
      service.register({
        email: "alex@clawchat.io",
        name: "Alex Chen",
        password: overLimitPassword,
      }),
    ).rejects.toThrow("PASSWORD_UTF8_BYTE_LENGTH_INVALID");
    await expect(
      service.registerWeb({
        email: "alex@clawchat.io",
        name: "Alex Chen",
        password: overLimitPassword,
      }),
    ).rejects.toThrow("PASSWORD_UTF8_BYTE_LENGTH_INVALID");

    expect((userRepo as any).manager.transaction).not.toHaveBeenCalled();
  });

  it("rejects over-limit mobile and web login before user lookup", async () => {
    const { service, userRepo } = await buildService();

    await expect(
      service.login({
        email: "alex@clawchat.io",
        password: overLimitPassword,
      }),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.loginWeb({
        email: "alex@clawchat.io",
        password: overLimitPassword,
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect((userRepo as any).manager.transaction).not.toHaveBeenCalled();
  });

  it("returns null for direct over-limit credential validation", async () => {
    const { service, userRepo } = await buildService();

    await expect(
      service.validateUser("alex@clawchat.io", overLimitPassword),
    ).resolves.toBeNull();
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it("rejects over-limit current and replacement passwords before lookup", async () => {
    const { service, userRepo } = await buildService();

    await expect(
      service.changePassword(
        "user-001",
        overLimitPassword,
        "ReplacementPassword2026!",
      ),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.changePassword(
        "user-001",
        "CurrentPassword2026!",
        overLimitPassword,
      ),
    ).rejects.toThrow("PASSWORD_UTF8_BYTE_LENGTH_INVALID");

    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it("rejects over-limit reset and email reauthentication before persistence", async () => {
    const {
      service,
      userRepo,
      accountActionTokenRepo,
      emailChangeRequestRepo,
    } = await buildService();

    await expect(
      service.completePasswordReset(
        "a-valid-random-reset-token-value",
        overLimitPassword,
      ),
    ).rejects.toThrow("PASSWORD_UTF8_BYTE_LENGTH_INVALID");
    await expect(
      service.requestEmailChange(
        "user-001",
        "new@example.test",
        overLimitPassword,
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(accountActionTokenRepo.findOne).not.toHaveBeenCalled();
    expect(emailChangeRequestRepo.save).not.toHaveBeenCalled();
    expect((userRepo as any).manager.transaction).not.toHaveBeenCalled();
  });
});

// ─── WebSocket Tickets ───────────────────────────────────────────────────────

describe("AuthService.issueWebSocketTicket", () => {
  it("requires workspace access before signing a workspace-scoped ticket", async () => {
    const {
      service,
      webSessionRepo,
      jwtService,
      workspaceMembershipService,
      websocketTickets,
    } = await buildService();
    webSessionRepo.findOne.mockResolvedValue({
      id: "session-1",
      userId: "user-001",
      revokedAt: null,
    });

    const result = await service.issueWebSocketTicket(
      "user-001",
      "alex@clawchat.io",
      "ws-001",
      "session-1",
    );

    expect(result.expiresIn).toBe(60);
    expect(
      workspaceMembershipService.ensureWorkspaceAccess,
    ).toHaveBeenCalledWith("ws-001", "user-001");
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "user-001",
        email: "alex@clawchat.io",
        kind: "ws_ticket",
        sid: "session-1",
        workspaceId: "ws-001",
        jti: expect.any(String),
      }),
      expect.any(Object),
    );
    const signedPayload = jwtService.signAsync.mock.calls[0][0];
    expect(websocketTickets.register).toHaveBeenCalledWith(
      {
        jti: signedPayload.jti,
        userId: "user-001",
        sessionId: "session-1",
        workspaceId: "ws-001",
      },
      60,
    );
  });

  it("fails closed when one-use ticket state cannot be registered", async () => {
    const { service, webSessionRepo, websocketTickets } = await buildService();
    webSessionRepo.findOne.mockResolvedValue({
      id: "session-1",
      userId: "user-001",
      revokedAt: null,
    });
    websocketTickets.register.mockRejectedValue(
      new Error("WEBSOCKET_TICKET_REDIS_UNAVAILABLE"),
    );

    await expect(
      service.issueWebSocketTicket(
        "user-001",
        "alex@clawchat.io",
        "ws-001",
        "session-1",
      ),
    ).rejects.toThrow("WEBSOCKET_TICKET_REDIS_UNAVAILABLE");
  });

  it("does not sign a ticket for an unauthorized workspace", async () => {
    const { service, webSessionRepo, jwtService, workspaceMembershipService } =
      await buildService();
    webSessionRepo.findOne.mockResolvedValue({
      id: "session-1",
      userId: "user-001",
      revokedAt: null,
    });
    workspaceMembershipService.ensureWorkspaceAccess.mockRejectedValue(
      new ForbiddenException("You do not have access to this workspace"),
    );

    await expect(
      service.issueWebSocketTicket(
        "user-001",
        "alex@clawchat.io",
        "ws-other",
        "session-1",
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it("fails closed instead of signing a websocket ticket with the main JWT secret", async () => {
    const { service, webSessionRepo, jwtService, configService } =
      await buildService();
    webSessionRepo.findOne.mockResolvedValue({
      id: "session-1",
      userId: "user-001",
      revokedAt: null,
    });
    configService.get.mockImplementation((key: string) =>
      key === "JWT_SECRET" ? "main-jwt-secret" : undefined,
    );

    await expect(
      service.issueWebSocketTicket(
        "user-001",
        "alex@clawchat.io",
        "ws-001",
        "session-1",
      ),
    ).rejects.toThrow("JWT_WS_SECRET_MISSING");
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});

// ─── Refresh Token ────────────────────────────────────────────────────────────

describe("AuthService.refreshTokens", () => {
  it("successfully refreshes a session-bound mobile token under the exact policy", async () => {
    const { service, userRepo, mobileSessionRepo, jwtService } =
      await buildService();
    const refreshToken = "valid-refresh-token";
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    userRepo.findOne.mockResolvedValue({
      id: "user-001",
      email: "alex@clawchat.io",
    });
    mobileSessionRepo.findOne.mockResolvedValue({
      id: "mobile-session-1",
      userId: "user-001",
      refreshTokenHash: hashedRefreshToken,
      revokedAt: null,
    });

    const result = await service.refreshTokens(
      "user-001",
      refreshToken,
      "mobile-session-1",
    );

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(mobileSessionRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "mobile-session-1" }),
      expect.objectContaining({ refreshTokenHash: expect.any(String) }),
    );
    expect(jwtService.verifyAsync).toHaveBeenCalledWith(refreshToken, {
      secret: "test-refresh-secret",
      issuer: RELAY_JWT_ISSUER,
      audience: RELAY_JWT_AUDIENCES.mobileRefresh,
      algorithms: ["HS256"],
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sid: "mobile-session-1", kind: "mobile" }),
      expect.objectContaining({
        issuer: RELAY_JWT_ISSUER,
        algorithm: "HS256",
      }),
    );
  });

  it("throws UnauthorizedException if user not found", async () => {
    const { service, userRepo } = await buildService();
    userRepo.findOne.mockResolvedValue(null);

    await expect(
      service.refreshTokens("user-001", "some-token", "mobile-session-1"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a refresh token from another credential family before database lookup", async () => {
    const { service, userRepo, jwtService } = await buildService();
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: "user-001",
      sid: "mobile-session-1",
      kind: "web",
      aud: RELAY_JWT_AUDIENCES.webRefresh,
    });

    await expect(
      service.refreshTokens("user-001", "web-token", "mobile-session-1"),
    ).rejects.toThrow(UnauthorizedException);
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it("atomically rotates a sid-bearing mobile refresh token", async () => {
    const { service, userRepo, mobileSessionRepo } = await buildService();
    const refreshToken = "valid-mobile-refresh-token";
    const storedHash = await bcrypt.hash(refreshToken, 10);
    userRepo.findOne.mockResolvedValue({
      id: "user-001",
      email: "alex@clawchat.io",
    });
    mobileSessionRepo.findOne.mockResolvedValue({
      id: "mobile-session-1",
      userId: "user-001",
      refreshTokenHash: storedHash,
      revokedAt: null,
    });

    await service.refreshTokens("user-001", refreshToken, "mobile-session-1");

    expect(mobileSessionRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "mobile-session-1",
        userId: "user-001",
        refreshTokenHash: storedHash,
        revokedAt: expect.anything(),
      }),
      expect.objectContaining({
        refreshTokenHash: expect.any(String),
        lastSeenAt: expect.any(Date),
      }),
    );
  });

  it("revokes a mobile session when a validly routed refresh token no longer matches", async () => {
    const { service, userRepo, mobileSessionRepo } = await buildService();
    const storedHash = await bcrypt.hash("newer-mobile-refresh-token", 10);
    userRepo.findOne.mockResolvedValue({
      id: "user-001",
      email: "alex@clawchat.io",
    });
    mobileSessionRepo.findOne.mockResolvedValue({
      id: "mobile-session-1",
      userId: "user-001",
      refreshTokenHash: storedHash,
      revokedAt: null,
    });

    await expect(
      service.refreshTokens(
        "user-001",
        "older-mobile-refresh-token",
        "mobile-session-1",
      ),
    ).rejects.toThrow("invalid refresh token");
    expect(mobileSessionRepo.update).toHaveBeenCalledWith("mobile-session-1", {
      revokedAt: expect.any(Date),
    });
  });

  it("revokes a mobile session when concurrent refresh rotation loses compare-and-swap", async () => {
    const { service, userRepo, mobileSessionRepo } = await buildService();
    const refreshToken = "replayed-mobile-refresh-token";
    const storedHash = await bcrypt.hash(refreshToken, 10);
    userRepo.findOne.mockResolvedValue({
      id: "user-001",
      email: "alex@clawchat.io",
    });
    mobileSessionRepo.findOne.mockResolvedValue({
      id: "mobile-session-1",
      userId: "user-001",
      refreshTokenHash: storedHash,
      revokedAt: null,
    });
    mobileSessionRepo.update
      .mockResolvedValueOnce({ affected: 0 })
      .mockResolvedValueOnce({ affected: 1 });

    await expect(
      service.refreshTokens("user-001", refreshToken, "mobile-session-1"),
    ).rejects.toThrow("refresh token already rotated");

    expect(mobileSessionRepo.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "mobile-session-1",
        userId: "user-001",
        revokedAt: expect.anything(),
      }),
      { revokedAt: expect.any(Date) },
    );
  });

  it("rejects an array audience even when it contains the mobile refresh audience", async () => {
    const { service, userRepo, jwtService } = await buildService();
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: "user-001",
      sid: "mobile-session-1",
      kind: "mobile",
      aud: [RELAY_JWT_AUDIENCES.mobileRefresh],
    });

    await expect(
      service.refreshTokens("user-001", "token", "mobile-session-1"),
    ).rejects.toThrow(UnauthorizedException);
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });
});

describe("AuthService.refreshWebTokens", () => {
  it("atomically rotates a browser refresh token and its session metadata", async () => {
    const { service, userRepo, webSessionRepo, jwtService } =
      await buildService();
    const refreshToken = "valid-web-refresh-token";
    const storedHash = await bcrypt.hash(refreshToken, 10);
    userRepo.findOne.mockResolvedValue({
      id: "user-001",
      email: "alex@clawchat.io",
    });
    webSessionRepo.findOne.mockResolvedValue({
      id: "session-1",
      userId: "user-001",
      refreshTokenHash: storedHash,
      revokedAt: null,
      ipAddress: "203.0.113.1",
      userAgent: "Old Browser",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
    });
    jwtService.verifyAsync.mockResolvedValue({
      sub: "user-001",
      kind: "web",
      sid: "session-1",
      aud: RELAY_JWT_AUDIENCES.webRefresh,
    });

    await service.refreshWebTokens("user-001", "session-1", refreshToken, {
      ipAddress: "203.0.113.2",
      userAgent: "New Browser",
    });

    expect(webSessionRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "session-1",
        userId: "user-001",
        refreshTokenHash: storedHash,
        revokedAt: expect.anything(),
      }),
      expect.objectContaining({
        refreshTokenHash: expect.any(String),
        ipAddress: "203.0.113.2",
        userAgent: "New Browser",
        lastSeenAt: expect.any(Date),
      }),
    );
  });

  it("revokes a browser session when concurrent refresh rotation loses compare-and-swap", async () => {
    const { service, userRepo, webSessionRepo, jwtService } =
      await buildService();
    const refreshToken = "replayed-web-refresh-token";
    const storedHash = await bcrypt.hash(refreshToken, 10);
    userRepo.findOne.mockResolvedValue({
      id: "user-001",
      email: "alex@clawchat.io",
    });
    webSessionRepo.findOne.mockResolvedValue({
      id: "session-1",
      userId: "user-001",
      refreshTokenHash: storedHash,
      revokedAt: null,
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
    });
    jwtService.verifyAsync.mockResolvedValue({
      sub: "user-001",
      kind: "web",
      sid: "session-1",
      aud: RELAY_JWT_AUDIENCES.webRefresh,
    });
    webSessionRepo.update
      .mockResolvedValueOnce({ affected: 0 })
      .mockResolvedValueOnce({ affected: 1 });

    await expect(
      service.refreshWebTokens("user-001", "session-1", refreshToken),
    ).rejects.toThrow("refresh token already rotated");

    expect(webSessionRepo.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "session-1",
        userId: "user-001",
        revokedAt: expect.anything(),
      }),
      { revokedAt: expect.any(Date) },
    );
  });

  it("revokes a browser session when a signed refresh token no longer matches", async () => {
    const { service, userRepo, webSessionRepo, jwtService } =
      await buildService();
    const storedHash = await bcrypt.hash("newer-web-refresh-token", 10);
    userRepo.findOne.mockResolvedValue({
      id: "user-001",
      email: "alex@clawchat.io",
    });
    webSessionRepo.findOne.mockResolvedValue({
      id: "session-1",
      userId: "user-001",
      refreshTokenHash: storedHash,
      revokedAt: null,
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSeenAt: new Date(),
    });
    jwtService.verifyAsync.mockResolvedValue({
      sub: "user-001",
      kind: "web",
      sid: "session-1",
      aud: RELAY_JWT_AUDIENCES.webRefresh,
    });

    await expect(
      service.refreshWebTokens(
        "user-001",
        "session-1",
        "older-web-refresh-token",
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(webSessionRepo.update).toHaveBeenCalledWith("session-1", {
      revokedAt: expect.any(Date),
    });
  });
});

describe("AuthService token uniqueness", () => {
  it("adds a distinct jti to every access and refresh JWT", async () => {
    const { service, jwtService } = await buildService();

    await service.generateWebTokens(
      "user-001",
      "alex@clawchat.io",
      "session-1",
    );
    await service.generateTokens(
      "user-001",
      "alex@clawchat.io",
      "mobile-session-1",
    );

    const tokenIds = jwtService.signAsync.mock.calls.map(
      ([payload]) => payload.jti,
    );
    expect(tokenIds).toHaveLength(4);
    expect(
      tokenIds.every(
        (tokenId) => typeof tokenId === "string" && tokenId.length > 0,
      ),
    ).toBe(true);
    expect(new Set(tokenIds)).toHaveProperty("size", 4);
  });
});

// ─── Validate User ───────────────────────────────────────────────────────────

describe("AuthService.validateUser", () => {
  it("returns user for valid credentials", async () => {
    const { service, userRepo } = await buildService();
    const hash = await bcrypt.hash("password123", 10);
    userRepo.findOne.mockResolvedValue({ ...mockUser, passwordHash: hash });

    const result = await service.validateUser(
      "alex@clawchat.io",
      "password123",
    );
    expect(result).not.toBeNull();
    expect(result!.email).toBe("alex@clawchat.io");
  });

  it("returns null for wrong password", async () => {
    const { service, userRepo } = await buildService();
    const hash = await bcrypt.hash("correct", 10);
    userRepo.findOne.mockResolvedValue({ ...mockUser, passwordHash: hash });

    const result = await service.validateUser("alex@clawchat.io", "wrong");
    expect(result).toBeNull();
  });

  it("returns null for an unverified account", async () => {
    const { service, userRepo } = await buildService();
    const hash = await bcrypt.hash("correct", 10);
    userRepo.findOne.mockResolvedValue({
      ...mockUser,
      passwordHash: hash,
      emailVerifiedAt: null,
    });

    await expect(
      service.validateUser("alex@clawchat.io", "correct"),
    ).resolves.toBeNull();
  });

  it("returns null for unknown user", async () => {
    const { service, userRepo } = await buildService();
    userRepo.findOne.mockResolvedValue(null);

    const result = await service.validateUser("nobody@test.io", "pass");
    expect(result).toBeNull();
  });
});

// ─── Logout ──────────────────────────────────────────────────────────────────

describe("AuthService.logout", () => {
  it("clears refresh token on logout", async () => {
    const { service, userRepo } = await buildService();
    await service.logout("user-001");
    expect(userRepo.update).toHaveBeenCalledWith("user-001", {
      refreshToken: null,
    });
  });

  it("revokes only the current sid-bearing mobile session", async () => {
    const { service, mobileSessionRepo, userRepo } = await buildService();
    await service.logout("user-001", "mobile-session-current");
    expect(mobileSessionRepo.update).toHaveBeenCalledWith(
      { id: "mobile-session-current", userId: "user-001" },
      { revokedAt: expect.any(Date) },
    );
    expect(userRepo.update).not.toHaveBeenCalled();
  });
});

describe("AuthService.changePassword", () => {
  it("returns every revoked browser and mobile session for realtime disconnect", async () => {
    const { service, userRepo, webSessionRepo, mobileSessionRepo } =
      await buildService();
    userRepo.findOne.mockResolvedValue({
      id: "user-001",
      email: "alex@clawchat.io",
      passwordHash: await bcrypt.hash("current-password", 10),
    });
    webSessionRepo.find.mockResolvedValue([{ id: "web-session-1" }]);
    mobileSessionRepo.find.mockResolvedValue([{ id: "mobile-session-1" }]);

    const result = await service.changePassword(
      "user-001",
      "current-password",
      "new-password",
    );

    expect(result).toEqual({
      revokedWebSessionIds: ["web-session-1"],
      revokedMobileSessionIds: ["mobile-session-1"],
    });
  });
});

// ─── Account Lifecycle ───────────────────────────────────────────────────────

describe("AuthService account lifecycle", () => {
  it("does not send recovery mail for an unverified account", async () => {
    const {
      service,
      userRepo,
      accountActionTokenRepo,
      transactionalEmailService,
    } = await buildService();
    transactionalEmailService.isEnabled.mockReturnValue(true);
    userRepo.findOne.mockResolvedValue({
      ...mockUser,
      emailVerifiedAt: null,
    });

    await expect(
      service.requestPasswordReset("alex@clawchat.io"),
    ).resolves.toMatchObject({ success: true });
    expect(accountActionTokenRepo.save).not.toHaveBeenCalled();
    expect(transactionalEmailService.sendPasswordReset).not.toHaveBeenCalled();
  });

  it("accepts password reset requests without revealing account existence", async () => {
    const { service, auditLogService } = await buildService();

    const result = await service.requestPasswordReset("ALEX@ClawChat.IO", {
      ipAddress: "203.0.113.20",
      userAgent: "Test Browser",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("If an account exists");
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "anonymous",
        actorId: "alex@clawchat.io",
        eventType: "auth.password_reset.requested",
        ipAddress: "203.0.113.20",
        userAgent: "Test Browser",
      }),
    );
  });

  it("issues a one-time password reset email for an existing account", async () => {
    const {
      service,
      userRepo,
      accountActionTokenRepo,
      transactionalEmailService,
    } = await buildService();
    transactionalEmailService.isEnabled.mockReturnValue(true);
    userRepo.findOne.mockResolvedValue({ ...mockUser });

    await service.requestPasswordReset("alex@clawchat.io");

    expect(accountActionTokenRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-001",
        purpose: "password_reset",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(transactionalEmailService.sendPasswordReset).toHaveBeenCalledWith(
      "alex@clawchat.io",
      "Alex Chen",
      expect.any(String),
    );
  });

  it("completes password reset once and revokes browser and mobile sessions", async () => {
    const {
      service,
      accountActionTokenRepo,
      userRepo,
      webSessionRepo,
      mobileSessionRepo,
    } = await buildService();
    accountActionTokenRepo.findOne.mockResolvedValue({
      id: "account-token-1",
      userId: "user-001",
      purpose: "password_reset",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });
    userRepo.findOne.mockResolvedValue({ id: "user-001" });

    const result = await service.completePasswordReset(
      "a-valid-random-reset-token-value",
      "ReplacementPassword2026!",
    );

    expect(result.success).toBe(true);
    expect(userRepo.update).toHaveBeenCalledWith(
      "user-001",
      expect.objectContaining({ refreshToken: null }),
    );
    expect(webSessionRepo.update).toHaveBeenCalled();
    expect(mobileSessionRepo.update).toHaveBeenCalled();
    expect(accountActionTokenRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "account-token-1",
        purpose: "password_reset",
        usedAt: IsNull(),
      }),
      { usedAt: expect.any(Date) },
    );
  });

  it("verifies an email with a one-time token", async () => {
    const { service, accountActionTokenRepo, userRepo } = await buildService();
    accountActionTokenRepo.findOne.mockResolvedValue({
      id: "account-token-1",
      userId: "user-001",
      purpose: "email_verification",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });

    await expect(
      service.verifyEmail("a-valid-random-verification-token"),
    ).resolves.toMatchObject({ success: true });
    expect(userRepo.update).toHaveBeenCalledWith("user-001", {
      emailVerifiedAt: expect.any(Date),
    });
  });
});

describe("AuthService verified email change", () => {
  it("rejects legacy direct profile email mutation", async () => {
    const { service, userRepo } = await buildService();
    userRepo.findOne.mockResolvedValue({ ...mockUser });

    await expect(
      service.updateMe("user-001", {
        email: "attacker@example.test",
      } as any),
    ).rejects.toThrow("EMAIL_CHANGE_WORKFLOW_REQUIRED");
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it("requires the current password before creating a pending request", async () => {
    const { service, userRepo, emailChangeRequestRepo } = await buildService();
    userRepo.findOne.mockResolvedValue({
      ...mockUser,
      passwordHash: await bcrypt.hash("correct-password", 10),
    });

    await expect(
      service.requestEmailChange(
        "user-001",
        "new@example.test",
        "wrong-password",
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(emailChangeRequestRepo.save).not.toHaveBeenCalled();
  });

  it("keeps the active email unchanged and sends both verification and old-address notice", async () => {
    const {
      service,
      userRepo,
      emailChangeRequestRepo,
      transactionalEmailService,
      auditLogService,
    } = await buildService();
    userRepo.findOne
      .mockResolvedValueOnce({
        ...mockUser,
        passwordHash: await bcrypt.hash("correct-password", 10),
      })
      .mockResolvedValueOnce(null);
    emailChangeRequestRepo.findOne.mockResolvedValue(null);

    await expect(
      service.requestEmailChange(
        "user-001",
        "New@Example.Test",
        "correct-password",
        {
          ipAddress: "203.0.113.10",
          userAgent: "Test Browser",
        },
      ),
    ).resolves.toMatchObject({ success: true });

    expect(userRepo.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: expect.anything() }),
    );
    expect(emailChangeRequestRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        currentEmail: "alex@clawchat.io",
        newEmail: "new@example.test",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      }),
    );
    const verificationToken =
      transactionalEmailService.sendEmailChangeVerification.mock.calls[0][2];
    expect(verificationToken).toHaveLength(43);
    expect(
      JSON.stringify(emailChangeRequestRepo.save.mock.calls),
    ).not.toContain(verificationToken);
    expect(
      transactionalEmailService.sendEmailChangeSecurityNotice,
    ).toHaveBeenCalledWith("alex@clawchat.io", "Alex Chen");
    expect(emailChangeRequestRepo.update).toHaveBeenCalledWith(
      {
        userId: "user-001",
        completedAt: IsNull(),
        cancelledAt: IsNull(),
      },
      { cancelledAt: expect.any(Date) },
    );
    expect(JSON.stringify(auditLogService.record.mock.calls)).not.toContain(
      "new@example.test",
    );
  });

  it("cancels the pending request if either required email cannot be delivered", async () => {
    const {
      service,
      userRepo,
      emailChangeRequestRepo,
      transactionalEmailService,
    } = await buildService();
    userRepo.findOne
      .mockResolvedValueOnce({
        ...mockUser,
        passwordHash: await bcrypt.hash("correct-password", 10),
      })
      .mockResolvedValueOnce(null);
    emailChangeRequestRepo.findOne.mockResolvedValue(null);
    transactionalEmailService.sendEmailChangeSecurityNotice.mockRejectedValue(
      new Error("provider unavailable"),
    );

    await expect(
      service.requestEmailChange(
        "user-001",
        "new@example.test",
        "correct-password",
      ),
    ).rejects.toThrow("provider unavailable");
    expect(emailChangeRequestRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "email-change-1" }),
      {
        cancelledAt: expect.any(Date),
      },
    );
  });

  it("atomically applies a verified email and revokes every session and action token", async () => {
    const {
      service,
      userRepo,
      emailChangeRequestRepo,
      accountActionTokenRepo,
      webSessionRepo,
      mobileSessionRepo,
      transactionalEmailService,
    } = await buildService();
    emailChangeRequestRepo.findOne.mockResolvedValue({
      id: "email-change-1",
      userId: "user-001",
      currentEmail: "alex@clawchat.io",
      newEmail: "new@example.test",
      tokenHash: "stored-hash",
      expiresAt: new Date(Date.now() + 60_000),
      completedAt: null,
      cancelledAt: null,
    });
    userRepo.findOne
      .mockResolvedValueOnce({
        id: "user-001",
        email: "alex@clawchat.io",
        name: "Alex Chen",
      })
      .mockResolvedValueOnce(null);
    webSessionRepo.find.mockResolvedValue([
      { id: "web-session-1" },
      { id: "web-session-2" },
    ]);
    mobileSessionRepo.find.mockResolvedValue([{ id: "mobile-session-1" }]);

    const result = await service.completeEmailChange(
      "a-valid-one-time-email-change-token",
    );

    expect(result).toMatchObject({
      success: true,
      userId: "user-001",
      revokedWebSessionIds: ["web-session-1", "web-session-2"],
      revokedMobileSessionIds: ["mobile-session-1"],
    });
    expect(emailChangeRequestRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "email-change-1",
        completedAt: IsNull(),
        cancelledAt: IsNull(),
      }),
      { completedAt: expect.any(Date) },
    );
    expect(userRepo.update).toHaveBeenCalledWith(
      { id: "user-001", email: "alex@clawchat.io" },
      {
        email: "new@example.test",
        emailVerifiedAt: expect.any(Date),
        refreshToken: null,
      },
    );
    expect(webSessionRepo.update).toHaveBeenCalledWith(
      { userId: "user-001", revokedAt: IsNull() },
      { revokedAt: expect.any(Date) },
    );
    expect(mobileSessionRepo.update).toHaveBeenCalledWith(
      { userId: "user-001", revokedAt: IsNull() },
      { revokedAt: expect.any(Date) },
    );
    expect(accountActionTokenRepo.update).toHaveBeenCalledWith(
      { userId: "user-001", usedAt: IsNull() },
      { usedAt: expect.any(Date) },
    );
    expect(
      transactionalEmailService.sendEmailChangeCompletedNotice,
    ).toHaveBeenCalledWith("alex@clawchat.io", "Alex Chen");
  });

  it("rejects an expired request even when its hash still exists", async () => {
    const { service, emailChangeRequestRepo, userRepo } = await buildService();
    emailChangeRequestRepo.findOne.mockResolvedValue({
      id: "email-change-1",
      expiresAt: new Date(Date.now() - 1),
    });

    await expect(
      service.completeEmailChange("expired-email-change-token"),
    ).rejects.toThrow("EMAIL_CHANGE_TOKEN_INVALID_OR_EXPIRED");
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it("allows only one concurrent completion to claim a token", async () => {
    const { service, emailChangeRequestRepo, userRepo } = await buildService();
    emailChangeRequestRepo.findOne.mockResolvedValue({
      id: "email-change-1",
      userId: "user-001",
      currentEmail: "alex@clawchat.io",
      newEmail: "new@example.test",
      tokenHash: "stored-hash",
      expiresAt: new Date(Date.now() + 60_000),
      completedAt: null,
      cancelledAt: null,
    });
    emailChangeRequestRepo.update.mockResolvedValueOnce({ affected: 0 });
    userRepo.findOne
      .mockResolvedValueOnce({
        id: "user-001",
        email: "alex@clawchat.io",
        name: "Alex Chen",
      })
      .mockResolvedValueOnce(null);

    await expect(
      service.completeEmailChange("concurrently-used-email-change-token"),
    ).rejects.toThrow("EMAIL_CHANGE_TOKEN_INVALID_OR_EXPIRED");
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it("rejects an expired, cancelled, completed, or replayed token", async () => {
    const { service, emailChangeRequestRepo, userRepo } = await buildService();
    emailChangeRequestRepo.findOne.mockResolvedValue(null);

    await expect(
      service.completeEmailChange("already-used-email-change-token"),
    ).rejects.toThrow("EMAIL_CHANGE_TOKEN_INVALID_OR_EXPIRED");
    expect(userRepo.update).not.toHaveBeenCalled();
  });
});
