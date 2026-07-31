import {
  BadRequestException,
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  EntityManager,
  In,
  IsNull,
  LessThanOrEqual,
  Repository,
} from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { createHash, createHmac, randomBytes, randomUUID } from "crypto";
import { UserEntity } from "../../entities/user.entity";
import { BetaInviteEntity } from "../../entities/beta-invite.entity";
import { WebSessionEntity } from "../../entities/web-session.entity";
import { MobileSessionEntity } from "../../entities/mobile-session.entity";
import {
  AccountActionTokenEntity,
  AccountActionTokenPurpose,
} from "../../entities/account-action-token.entity";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { AuditLogService } from "../audit-log/audit-log.service";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import { parseBetaInviteCodes } from "../../config/production-env";
import { TransactionalEmailService } from "./transactional-email.service";
import { EmailChangeRequestEntity } from "../../entities/email-change-request.entity";
import { WebsocketTicketReplayService } from "../../gateways/websocket-ticket-replay.service";
import {
  assertBcryptCompatiblePassword,
  compareAccountPassword,
  hashAccountPassword,
  isBcryptCompatiblePassword,
} from "./password-policy";
import {
  hasExactRelayJwtAudience,
  RELAY_JWT_ALGORITHM,
  RELAY_JWT_AUDIENCES,
  resolveRelayJwtIssuer,
} from "./auth-token-policy";

export interface WebSessionContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: Omit<UserEntity, "passwordHash" | "refreshToken">;
  tokens: TokenPair;
}

export interface WebTokenPair {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export interface MobileLoginContext {
  deviceName?: string | null;
  platform?: string | null;
  pushToken?: string | null;
}

type RegistrationRepositories = {
  userRepository: Repository<UserEntity>;
  betaInviteRepository: Repository<BetaInviteEntity>;
  webSessionRepository: Repository<WebSessionEntity>;
  mobileSessionRepository: Repository<MobileSessionEntity>;
  emailChangeRequestRepository: Repository<EmailChangeRequestEntity>;
};

type PendingInviteRedemption = {
  invite: BetaInviteEntity;
  inviteEmail: string | null;
  normalizedEmail: string;
};

type InviteAcceptedAudit = {
  inviteId: string;
  normalizedEmail: string;
  inviteEmail: string | null;
  maxUses: number;
};

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(BetaInviteEntity)
    private readonly betaInviteRepository: Repository<BetaInviteEntity>,
    @InjectRepository(WebSessionEntity)
    private readonly webSessionRepository: Repository<WebSessionEntity>,
    @InjectRepository(MobileSessionEntity)
    private readonly mobileSessionRepository: Repository<MobileSessionEntity>,
    @InjectRepository(AccountActionTokenEntity)
    private readonly accountActionTokenRepository: Repository<AccountActionTokenEntity>,
    @InjectRepository(EmailChangeRequestEntity)
    private readonly emailChangeRequestRepository: Repository<EmailChangeRequestEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly workspaceMembershipService: WorkspaceMembershipService,
    private readonly transactionalEmail: TransactionalEmailService,
    private readonly websocketTickets: WebsocketTicketReplayService,
  ) {}

  async onModuleInit(): Promise<void> {
    const configuredCodes = parseBetaInviteCodes(
      this.configService.get<string>("CLAWCHAT_BETA_INVITE_CODES"),
    );
    if (!configuredCodes.size) return;

    this.inviteHashSecret();
    for (const code of configuredCodes) {
      await this.resolveInviteByHash(this.betaInviteRepository, code);
    }
  }

  async register(
    dto: RegisterDto,
    context: MobileLoginContext = {},
  ): Promise<AuthResult> {
    assertBcryptCompatiblePassword(dto.password);
    let inviteAudit: InviteAcceptedAudit | null = null;
    const result = await this.userRepository.manager.transaction(
      async (manager) => {
        const repositories = this.registrationRepositories(manager);
        const { user: savedUser, pendingInvite } =
          await this.createRegisteredUser(dto, repositories);
        const session = repositories.mobileSessionRepository.create({
          userId: savedUser.id,
          refreshTokenHash: "",
          deviceName: context.deviceName ?? null,
          platform: context.platform ?? null,
          pushToken: null,
          revokedAt: null,
          lastSeenAt: new Date(),
        });
        const savedSession =
          await repositories.mobileSessionRepository.save(session);
        const tokens = await this.generateTokens(
          savedUser.id,
          savedUser.email,
          savedSession.id,
        );
        await this.updateMobileSession(
          savedSession.id,
          tokens.refreshToken,
          repositories.mobileSessionRepository,
        );
        inviteAudit = await this.consumeInviteCode(
          pendingInvite,
          savedUser.id,
          repositories.betaInviteRepository,
        );

        return { user: this.sanitizeUser(savedUser), tokens };
      },
    );
    await this.recordInviteAccepted(inviteAudit);
    await this.sendEmailVerification(result.user.id, true);

    return result;
  }

  async registerWeb(
    dto: RegisterDto,
    context: WebSessionContext = {},
  ): Promise<{
    user: Omit<UserEntity, "passwordHash" | "refreshToken">;
    tokens: WebTokenPair;
  }> {
    assertBcryptCompatiblePassword(dto.password);
    let inviteAudit: InviteAcceptedAudit | null = null;
    const result = await this.userRepository.manager.transaction(
      async (manager) => {
        const repositories = this.registrationRepositories(manager);
        const { user: savedUser, pendingInvite } =
          await this.createRegisteredUser(dto, repositories);
        const session = repositories.webSessionRepository.create({
          userId: savedUser.id,
          refreshTokenHash: "",
          revokedAt: null,
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null,
          lastSeenAt: new Date(),
        });
        const savedSession =
          await repositories.webSessionRepository.save(session);
        const tokens = await this.generateWebTokens(
          savedUser.id,
          savedUser.email,
          savedSession.id,
        );
        await this.updateWebSession(
          savedSession.id,
          tokens.refreshToken,
          repositories.webSessionRepository,
        );
        inviteAudit = await this.consumeInviteCode(
          pendingInvite,
          savedUser.id,
          repositories.betaInviteRepository,
        );

        return {
          user: this.sanitizeUser(savedUser),
          tokens,
        };
      },
    );
    await this.recordInviteAccepted(inviteAudit);
    await this.sendEmailVerification(result.user.id, true);

    return result;
  }

  async requestPasswordReset(email: string, context: WebSessionContext = {}) {
    const normalizedEmail = email.trim().toLowerCase();
    await this.auditLogService.record({
      actorType: "anonymous",
      actorId: normalizedEmail,
      eventType: "auth.password_reset.requested",
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (user?.emailVerifiedAt && this.transactionalEmail.isEnabled()) {
      try {
        const token = await this.issueAccountActionToken(
          user.id,
          "password_reset",
          30 * 60_000,
        );
        await this.transactionalEmail.sendPasswordReset(
          user.email,
          user.name,
          token,
        );
        await this.auditLogService.record({
          actorType: "user",
          actorId: user.id,
          eventType: "auth.password_reset.email_sent",
        });
      } catch {
        await this.auditLogService.record({
          actorType: "user",
          actorId: user.id,
          eventType: "auth.password_reset.email_failed",
        });
      }
    }
    return {
      success: true,
      message:
        "If an account exists for that email, a one-time reset link has been sent.",
    };
  }

  async completePasswordReset(token: string, newPassword: string) {
    if (newPassword.length < 8) {
      throw new BadRequestException("PASSWORD_LENGTH_INVALID");
    }
    assertBcryptCompatiblePassword(newPassword);
    const tokenHash = this.hashAccountActionToken(token);
    const userId = await this.userRepository.manager.transaction(
      async (manager) => {
        const tokens = manager.getRepository(AccountActionTokenEntity);
        const candidate = await tokens.findOne({
          where: { tokenHash, purpose: "password_reset", usedAt: IsNull() },
        });
        if (!candidate || candidate.expiresAt <= new Date()) {
          throw new BadRequestException(
            "PASSWORD_RESET_TOKEN_INVALID_OR_EXPIRED",
          );
        }
        const users = manager.getRepository(UserEntity);
        const user = await users.findOne({
          where: { id: candidate.userId },
          select: ["id"],
          lock: { mode: "pessimistic_write" },
        });
        if (!user) {
          throw new BadRequestException(
            "PASSWORD_RESET_TOKEN_INVALID_OR_EXPIRED",
          );
        }
        const record = await tokens.findOne({
          where: {
            id: candidate.id,
            tokenHash,
            purpose: "password_reset",
            usedAt: IsNull(),
          },
          lock: { mode: "pessimistic_write" },
        });
        if (!record || record.expiresAt <= new Date()) {
          throw new BadRequestException(
            "PASSWORD_RESET_TOKEN_INVALID_OR_EXPIRED",
          );
        }
        const passwordHash = await hashAccountPassword(newPassword, 12);
        const usedAt = new Date();
        const claim = await tokens.update(
          {
            id: record.id,
            tokenHash,
            purpose: "password_reset",
            usedAt: IsNull(),
          },
          { usedAt },
        );
        if (claim.affected !== 1) {
          throw new BadRequestException(
            "PASSWORD_RESET_TOKEN_INVALID_OR_EXPIRED",
          );
        }
        await users.update(record.userId, {
          passwordHash,
          refreshToken: null,
        });
        const revokedAt = usedAt;
        await manager
          .getRepository(WebSessionEntity)
          .update(
            { userId: record.userId, revokedAt: IsNull() },
            { revokedAt },
          );
        await manager
          .getRepository(MobileSessionEntity)
          .update(
            { userId: record.userId, revokedAt: IsNull() },
            { revokedAt },
          );
        await tokens.update(
          { userId: record.userId, usedAt: IsNull() },
          { usedAt },
        );
        return record.userId;
      },
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      eventType: "auth.password_reset.completed",
    });
    return {
      success: true,
      message: "Password reset. Sign in with your new password.",
      userId,
    };
  }

  async sendEmailVerification(userId: string, suppressDeliveryFailure = false) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.emailVerifiedAt) {
      return { success: true };
    }
    if (!this.transactionalEmail.isEnabled()) {
      if (suppressDeliveryFailure) return { success: true };
      throw new BadRequestException("TRANSACTIONAL_EMAIL_NOT_ENABLED");
    }
    try {
      const token = await this.issueAccountActionToken(
        user.id,
        "email_verification",
        24 * 60 * 60_000,
      );
      await this.transactionalEmail.sendEmailVerification(
        user.email,
        user.name,
        token,
      );
      await this.auditLogService.record({
        actorType: "user",
        actorId: user.id,
        eventType: "auth.email_verification.sent",
      });
    } catch (error) {
      await this.auditLogService.record({
        actorType: "user",
        actorId: user.id,
        eventType: "auth.email_verification.failed",
      });
      if (!suppressDeliveryFailure) throw error;
    }
    return { success: true };
  }

  async verifyEmail(token: string) {
    const tokenHash = this.hashAccountActionToken(token);
    const userId = await this.userRepository.manager.transaction(
      async (manager) => {
        const tokens = manager.getRepository(AccountActionTokenEntity);
        const record = await tokens.findOne({
          where: { tokenHash, purpose: "email_verification", usedAt: IsNull() },
        });
        if (!record || record.expiresAt <= new Date()) {
          throw new BadRequestException(
            "EMAIL_VERIFICATION_TOKEN_INVALID_OR_EXPIRED",
          );
        }
        const verifiedAt = new Date();
        await manager
          .getRepository(UserEntity)
          .update(record.userId, { emailVerifiedAt: verifiedAt });
        record.usedAt = verifiedAt;
        await tokens.save(record);
        return record.userId;
      },
    );
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      eventType: "auth.email_verified",
    });
    return { success: true, message: "Email verified." };
  }

  async login(
    dto: LoginDto,
    context: MobileLoginContext = {},
  ): Promise<AuthResult> {
    if (!isBcryptCompatiblePassword(dto.password)) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.userRepository.manager.transaction(async (manager) => {
      const users = manager.getRepository(UserEntity);
      const mobileSessions = manager.getRepository(MobileSessionEntity);
      const user = await users.findOne({
        where: { email: dto.email.toLowerCase() },
        select: [
          "id",
          "email",
          "name",
          "avatarUrl",
          "passwordHash",
          "emailVerifiedAt",
          "createdAt",
          "updatedAt",
        ],
        lock: { mode: "pessimistic_read" },
      });
      if (
        !user ||
        !user.emailVerifiedAt ||
        !(await compareAccountPassword(dto.password, user.passwordHash))
      ) {
        throw new UnauthorizedException("Invalid credentials");
      }
      const session = mobileSessions.create({
        userId: user.id,
        refreshTokenHash: "",
        deviceName: context.deviceName ?? null,
        platform: context.platform ?? null,
        pushToken: context.pushToken ?? null,
        revokedAt: null,
        lastSeenAt: new Date(),
      });
      const savedSession = await mobileSessions.save(session);
      const result = await this.generateTokens(
        user.id,
        user.email,
        savedSession.id,
      );
      await this.updateMobileSession(
        savedSession.id,
        result.refreshToken,
        mobileSessions,
      );
      await users.update(user.id, { refreshToken: null });
      return { user: this.sanitizeUser(user), tokens: result };
    });
  }

  async refreshTokens(
    userId: string,
    refreshToken: string,
    sessionId: string,
  ): Promise<TokenPair> {
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
        issuer: resolveRelayJwtIssuer(
          this.configService.get<string>("JWT_ISSUER"),
        ),
        audience: RELAY_JWT_AUDIENCES.mobileRefresh,
        algorithms: [RELAY_JWT_ALGORITHM],
      });
    } catch {
      throw new UnauthorizedException("Access denied");
    }
    if (
      payload.sub !== userId ||
      payload.sid !== sessionId ||
      payload.kind !== "mobile" ||
      !hasExactRelayJwtAudience(
        payload,
        RELAY_JWT_AUDIENCES.mobileRefresh,
      )
    ) {
      throw new UnauthorizedException("Access denied");
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ["id", "email"],
    });
    if (!user) {
      throw new UnauthorizedException("Access denied");
    }

    const session = await this.mobileSessionRepository.findOne({
      where: { id: sessionId, userId, revokedAt: IsNull() },
      select: ["id", "userId", "refreshTokenHash", "revokedAt"],
    });
    if (!session) {
      throw new UnauthorizedException(
        "Access denied - mobile session not found",
      );
    }
    const tokenMatches = await bcrypt.compare(
      refreshToken,
      session.refreshTokenHash,
    );
    if (!tokenMatches) {
      await this.mobileSessionRepository.update(session.id, {
        revokedAt: new Date(),
      });
      throw new UnauthorizedException(
        "Access denied - invalid refresh token",
      );
    }
    const tokens = await this.generateTokens(user.id, user.email, session.id);
    await this.rotateMobileSessionRefreshToken(session, tokens.refreshToken);
    return tokens;
  }

  async loginWeb(
    dto: LoginDto,
    context: WebSessionContext = {},
  ): Promise<{
    user: Omit<UserEntity, "passwordHash" | "refreshToken">;
    tokens: WebTokenPair;
  }> {
    if (!isBcryptCompatiblePassword(dto.password)) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.userRepository.manager.transaction(async (manager) => {
      const users = manager.getRepository(UserEntity);
      const webSessions = manager.getRepository(WebSessionEntity);
      const user = await users.findOne({
        where: { email: dto.email.toLowerCase() },
        select: [
          "id",
          "email",
          "name",
          "avatarUrl",
          "passwordHash",
          "emailVerifiedAt",
          "createdAt",
          "updatedAt",
        ],
        lock: { mode: "pessimistic_read" },
      });
      if (
        !user ||
        !user.emailVerifiedAt ||
        !(await compareAccountPassword(dto.password, user.passwordHash))
      ) {
        throw new UnauthorizedException("Invalid credentials");
      }
      const session = webSessions.create({
        userId: user.id,
        refreshTokenHash: "",
        revokedAt: null,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
        lastSeenAt: new Date(),
      });
      const savedSession = await webSessions.save(session);
      const tokens = await this.generateWebTokens(
        user.id,
        user.email,
        savedSession.id,
      );
      await this.updateWebSession(
        savedSession.id,
        tokens.refreshToken,
        webSessions,
      );
      return {
        user: this.sanitizeUser(user),
        tokens,
      };
    });
  }

  async refreshWebTokens(
    userId: string,
    sessionId: string,
    refreshToken: string,
    context: WebSessionContext = {},
  ): Promise<WebTokenPair> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ["id", "email"],
    });
    if (!user) {
      throw new UnauthorizedException("Access denied");
    }

    const session = await this.getActiveWebSession(sessionId, userId);
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
        issuer: resolveRelayJwtIssuer(
          this.configService.get<string>("JWT_ISSUER"),
        ),
        audience: RELAY_JWT_AUDIENCES.webRefresh,
        algorithms: [RELAY_JWT_ALGORITHM],
      });
    } catch {
      throw new UnauthorizedException("Access denied");
    }

    if (
      payload.sub !== userId ||
      payload.kind !== "web" ||
      payload.sid !== session.id ||
      !hasExactRelayJwtAudience(payload, RELAY_JWT_AUDIENCES.webRefresh)
    ) {
      throw new UnauthorizedException("Access denied");
    }

    const tokenMatches = await bcrypt.compare(
      refreshToken,
      session.refreshTokenHash,
    );
    if (!tokenMatches) {
      await this.webSessionRepository.update(session.id, {
        revokedAt: new Date(),
      });
      throw new UnauthorizedException("Access denied");
    }

    const tokens = await this.generateWebTokens(
      user.id,
      user.email,
      session.id,
    );
    await this.rotateWebSessionRefreshToken(session, tokens.refreshToken, {
      ipAddress: context.ipAddress ?? session.ipAddress ?? null,
      userAgent: context.userAgent ?? session.userAgent ?? null,
    });
    return tokens;
  }

  async logout(userId: string, mobileSessionId?: string | null): Promise<void> {
    if (mobileSessionId) {
      await this.mobileSessionRepository.update(
        { id: mobileSessionId, userId },
        { revokedAt: new Date() },
      );
    } else {
      // Legacy: null single-slot refresh token
      await this.userRepository.update(userId, { refreshToken: null });
    }
  }

  async logoutWeb(userId: string, sessionId?: string): Promise<string | null> {
    if (!sessionId) return null;

    const session = await this.webSessionRepository.findOne({
      where: { id: sessionId, userId, revokedAt: IsNull() },
      select: ["id"],
    });
    if (!session) {
      return null;
    }

    await this.webSessionRepository.update(session.id, {
      revokedAt: new Date(),
    });
    return session.id;
  }

  async listWebSessions(userId: string) {
    const sessions = await this.webSessionRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      select: [
        "id",
        "userId",
        "revokedAt",
        "createdAt",
        "updatedAt",
        "ipAddress",
        "userAgent",
        "lastSeenAt",
      ],
    });

    return sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      revokedAt: session.revokedAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      lastSeenAt: session.lastSeenAt,
      active: !session.revokedAt,
    }));
  }

  async revokeWebSession(userId: string, sessionId: string) {
    const session = await this.getOwnedWebSession(sessionId, userId);
    if (session.revokedAt) {
      return null;
    }

    await this.webSessionRepository.update(session.id, {
      revokedAt: new Date(),
    });

    return session.id;
  }

  async revokeAllWebSessions(userId: string, exceptSessionId?: string) {
    const sessions = await this.webSessionRepository.find({
      where: { userId, revokedAt: IsNull() },
      select: ["id"],
    });
    const targetIds = sessions
      .map((session) => session.id)
      .filter((sessionId) => sessionId !== exceptSessionId);

    if (!targetIds.length) {
      return [];
    }

    await this.webSessionRepository
      .createQueryBuilder()
      .update(WebSessionEntity)
      .set({ revokedAt: new Date() })
      .where("id IN (:...ids)", { ids: targetIds })
      .execute();

    return targetIds;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{
    revokedWebSessionIds: string[];
    revokedMobileSessionIds: string[];
  }> {
    if (!isBcryptCompatiblePassword(currentPassword)) {
      throw new UnauthorizedException("Current password is incorrect");
    }
    if (newPassword.length < 8) {
      throw new BadRequestException("PASSWORD_LENGTH_INVALID");
    }
    assertBcryptCompatiblePassword(newPassword);

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ["id", "email", "passwordHash"],
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const passwordValid = await compareAccountPassword(
      currentPassword,
      user.passwordHash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    const newHash = await hashAccountPassword(newPassword, 12);

    // Phase A: null single-slot refresh token and update password hash atomically
    await this.userRepository.update(userId, {
      passwordHash: newHash,
      refreshToken: null,
    });

    // Phase A: revoke all web sessions (full logout from all browsers)
    const revokedWebSessionIds = await this.revokeAllWebSessions(userId);

    // Phase B: revoke all mobile sessions (migration 026 shipped)
    const revokedMobileSessionIds = await this.revokeAllMobileSessions(userId);

    return { revokedWebSessionIds, revokedMobileSessionIds };
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserEntity | null> {
    if (!isBcryptCompatiblePassword(password)) return null;

    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
      select: [
        "id",
        "email",
        "name",
        "avatarUrl",
        "passwordHash",
        "emailVerifiedAt",
        "createdAt",
        "updatedAt",
      ],
    });
    if (!user) return null;

    const passwordValid = await compareAccountPassword(
      password,
      user.passwordHash,
    );
    if (!passwordValid || !user.emailVerifiedAt) return null;

    return user;
  }

  async getMe(
    userId: string,
  ): Promise<Omit<UserEntity, "passwordHash" | "refreshToken">> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.sanitizeUser(user);
  }

  async updateMe(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<Omit<UserEntity, "passwordHash" | "refreshToken">> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if ("email" in (dto as unknown as Record<string, unknown>)) {
      throw new BadRequestException("EMAIL_CHANGE_WORKFLOW_REQUIRED");
    }

    if (dto.name?.trim()) {
      user.name = dto.name.trim();
    }

    const saved = await this.userRepository.save(user);
    return this.sanitizeUser(saved);
  }

  async requestEmailChange(
    userId: string,
    newEmailInput: string,
    currentPassword: string,
    context: WebSessionContext = {},
  ) {
    if (!isBcryptCompatiblePassword(currentPassword)) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    const newEmail = newEmailInput.trim().toLowerCase();
    const token = randomBytes(32).toString("base64url");
    const tokenHash = this.hashAccountActionToken(token);
    const now = new Date();
    let request: EmailChangeRequestEntity;
    let user: UserEntity;

    try {
      ({ request, user } = await this.userRepository.manager.transaction(
        async (manager) => {
          const users = manager.getRepository(UserEntity);
          const requests = manager.getRepository(EmailChangeRequestEntity);
          const lockedUser = await users.findOne({
            where: { id: userId },
            select: ["id", "email", "name", "passwordHash", "emailVerifiedAt"],
            lock: { mode: "pessimistic_write" },
          });
          if (!lockedUser) throw new NotFoundException("User not found");
          const passwordValid = await compareAccountPassword(
            currentPassword,
            lockedUser.passwordHash,
          );
          if (!passwordValid) {
            throw new UnauthorizedException("Current password is incorrect");
          }
          if (!lockedUser.emailVerifiedAt) {
            throw new BadRequestException("CURRENT_EMAIL_NOT_VERIFIED");
          }
          if (newEmail === lockedUser.email.toLowerCase()) {
            throw new BadRequestException("NEW_EMAIL_MUST_BE_DIFFERENT");
          }

          await requests.update(
            {
              expiresAt: LessThanOrEqual(now),
              completedAt: IsNull(),
              cancelledAt: IsNull(),
            },
            { cancelledAt: now },
          );
          const existingUser = await users.findOne({
            where: { email: newEmail },
            select: ["id"],
          });
          if (existingUser) {
            throw new ConflictException("Email already registered");
          }
          const existingRequest = await requests.findOne({
            where: {
              newEmail,
              completedAt: IsNull(),
              cancelledAt: IsNull(),
            },
            select: ["id", "userId"],
          });
          if (existingRequest && existingRequest.userId !== userId) {
            throw new ConflictException("Email change already pending");
          }

          await requests.update(
            {
              userId,
              completedAt: IsNull(),
              cancelledAt: IsNull(),
            },
            { cancelledAt: now },
          );
          const savedRequest = await requests.save(
            requests.create({
              userId,
              currentEmail: lockedUser.email.toLowerCase(),
              newEmail,
              tokenHash,
              expiresAt: new Date(now.getTime() + 30 * 60_000),
              completedAt: null,
              cancelledAt: null,
            }),
          );
          return { request: savedRequest, user: lockedUser };
        },
      ));
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException("Email change already pending");
      }
      throw error;
    }

    try {
      await Promise.all([
        this.transactionalEmail.sendEmailChangeVerification(
          request.newEmail,
          user.name,
          token,
        ),
        this.transactionalEmail.sendEmailChangeSecurityNotice(
          request.currentEmail,
          user.name,
        ),
      ]);
    } catch (error) {
      await this.emailChangeRequestRepository.update(
        {
          id: request.id,
          completedAt: IsNull(),
          cancelledAt: IsNull(),
        },
        { cancelledAt: new Date() },
      );
      await this.auditLogService.record({
        actorType: "user",
        actorId: userId,
        eventType: "auth.email_change.delivery_failed",
        resourceType: "email_change_request",
        resourceId: request.id,
      });
      throw error;
    }

    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      eventType: "auth.email_change.requested",
      resourceType: "email_change_request",
      resourceId: request.id,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });
    return {
      success: true,
      message:
        "Check the new address to confirm the change. Your current email remains active until verification.",
    };
  }

  async completeEmailChange(token: string) {
    const tokenHash = this.hashAccountActionToken(token);
    const now = new Date();
    let result: {
      userId: string;
      userName: string;
      previousEmail: string;
      revokedWebSessionIds: string[];
      revokedMobileSessionIds: string[];
    };

    try {
      result = await this.userRepository.manager.transaction(
        async (manager) => {
          const requests = manager.getRepository(EmailChangeRequestEntity);
          const users = manager.getRepository(UserEntity);
          const webSessions = manager.getRepository(WebSessionEntity);
          const mobileSessions = manager.getRepository(MobileSessionEntity);
          const actionTokens = manager.getRepository(AccountActionTokenEntity);
          const request = await requests.findOne({
            where: {
              tokenHash,
              completedAt: IsNull(),
              cancelledAt: IsNull(),
            },
            lock: { mode: "pessimistic_write" },
          });
          if (!request || request.expiresAt <= now) {
            throw new BadRequestException(
              "EMAIL_CHANGE_TOKEN_INVALID_OR_EXPIRED",
            );
          }
          const user = await users.findOne({
            where: { id: request.userId },
            select: ["id", "email", "name"],
            lock: { mode: "pessimistic_write" },
          });
          if (
            !user ||
            user.email.toLowerCase() !== request.currentEmail.toLowerCase()
          ) {
            throw new BadRequestException(
              "EMAIL_CHANGE_TOKEN_INVALID_OR_EXPIRED",
            );
          }
          const emailOwner = await users.findOne({
            where: { email: request.newEmail },
            select: ["id"],
          });
          if (emailOwner && emailOwner.id !== user.id) {
            throw new ConflictException("Email already registered");
          }

          const claim = await requests.update(
            {
              id: request.id,
              tokenHash,
              completedAt: IsNull(),
              cancelledAt: IsNull(),
            },
            { completedAt: now },
          );
          if (claim.affected !== 1) {
            throw new BadRequestException(
              "EMAIL_CHANGE_TOKEN_INVALID_OR_EXPIRED",
            );
          }
          const emailUpdate = await users.update(
            { id: user.id, email: request.currentEmail },
            {
              email: request.newEmail,
              emailVerifiedAt: now,
              refreshToken: null,
            },
          );
          if (emailUpdate.affected !== 1) {
            throw new BadRequestException(
              "EMAIL_CHANGE_TOKEN_INVALID_OR_EXPIRED",
            );
          }

          const [activeWebSessions, activeMobileSessions] = await Promise.all([
            webSessions.find({
              where: { userId: user.id, revokedAt: IsNull() },
              select: ["id"],
            }),
            mobileSessions.find({
              where: { userId: user.id, revokedAt: IsNull() },
              select: ["id"],
            }),
          ]);
          await Promise.all([
            webSessions.update(
              { userId: user.id, revokedAt: IsNull() },
              { revokedAt: now },
            ),
            mobileSessions.update(
              { userId: user.id, revokedAt: IsNull() },
              { revokedAt: now },
            ),
            actionTokens.update(
              { userId: user.id, usedAt: IsNull() },
              { usedAt: now },
            ),
            requests.update(
              {
                userId: user.id,
                completedAt: IsNull(),
                cancelledAt: IsNull(),
              },
              { cancelledAt: now },
            ),
          ]);
          return {
            userId: user.id,
            userName: user.name,
            previousEmail: request.currentEmail,
            revokedWebSessionIds: activeWebSessions.map(
              (session) => session.id,
            ),
            revokedMobileSessionIds: activeMobileSessions.map(
              (session) => session.id,
            ),
          };
        },
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException("Email already registered");
      }
      throw error;
    }

    await this.auditLogService.record({
      actorType: "user",
      actorId: result.userId,
      eventType: "auth.email_change.completed",
    });
    try {
      await this.transactionalEmail.sendEmailChangeCompletedNotice(
        result.previousEmail,
        result.userName,
      );
    } catch {
      await this.auditLogService.record({
        actorType: "user",
        actorId: result.userId,
        eventType: "auth.email_change.completion_notice_failed",
      });
    }
    return {
      success: true,
      message: "Email changed. Sign in again with your new address.",
      userId: result.userId,
      revokedWebSessionIds: result.revokedWebSessionIds,
      revokedMobileSessionIds: result.revokedMobileSessionIds,
    };
  }

  async generateTokens(
    userId: string,
    email: string,
    sessionId: string,
  ): Promise<TokenPair> {
    const payload = {
      sub: userId,
      email,
      kind: "mobile",
      sid: sessionId,
    };
    const issuer = resolveRelayJwtIssuer(
      this.configService.get<string>("JWT_ISSUER"),
    );
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: this.configService.get<string>("JWT_SECRET"),
          expiresIn: this.configService.get<string>("JWT_EXPIRES_IN") || "15m",
          issuer,
          audience: RELAY_JWT_AUDIENCES.mobileAccess,
          algorithm: RELAY_JWT_ALGORITHM,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
          expiresIn:
            this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") || "30d",
          issuer,
          audience: RELAY_JWT_AUDIENCES.mobileRefresh,
          algorithm: RELAY_JWT_ALGORITHM,
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  async generateWebTokens(
    userId: string,
    email: string,
    sessionId: string,
  ): Promise<WebTokenPair> {
    const payload = { sub: userId, email, kind: "web", sid: sessionId };
    const issuer = resolveRelayJwtIssuer(
      this.configService.get<string>("JWT_ISSUER"),
    );
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: this.configService.get<string>("JWT_SECRET"),
          expiresIn: this.configService.get<string>("JWT_EXPIRES_IN") || "15m",
          issuer,
          audience: RELAY_JWT_AUDIENCES.webAccess,
          algorithm: RELAY_JWT_ALGORITHM,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
          expiresIn:
            this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") || "30d",
          issuer,
          audience: RELAY_JWT_AUDIENCES.webRefresh,
          algorithm: RELAY_JWT_ALGORITHM,
        },
      ),
    ]);

    return { accessToken, refreshToken, sessionId };
  }

  async issueWebSocketTicket(
    userId: string,
    email: string,
    workspaceId: string,
    sessionId: string,
  ): Promise<{ ticket: string; expiresIn: number }> {
    const session = await this.getActiveWebSession(sessionId, userId);
    await this.workspaceMembershipService.ensureWorkspaceAccess(
      workspaceId,
      userId,
    );
    const websocketSecret = this.configService
      .get<string>("JWT_WS_SECRET")
      ?.trim();
    if (!websocketSecret) throw new Error("JWT_WS_SECRET_MISSING");

    const expiresIn = 60;
    const jti = randomUUID();
    const ticket = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
        kind: "ws_ticket",
        sid: session.id,
        workspaceId,
        jti,
      },
      {
        secret: websocketSecret,
        expiresIn: `${expiresIn}s`,
        issuer: resolveRelayJwtIssuer(
          this.configService.get<string>("JWT_ISSUER"),
        ),
        audience: RELAY_JWT_AUDIENCES.browserWebsocket,
        algorithm: RELAY_JWT_ALGORITHM,
      },
    );
    await this.websocketTickets.register(
      {
        jti,
        userId,
        sessionId: session.id,
        workspaceId,
      },
      expiresIn,
    );

    return { ticket, expiresIn };
  }

  async recordSessionAuditEvent(
    eventType: string,
    userId: string,
    sessionId: string | null,
    context: WebSessionContext = {},
    metadata?: Record<string, unknown>,
  ) {
    await this.auditLogService.record({
      actorType: "user",
      actorId: userId,
      eventType,
      resourceType: "web_session",
      resourceId: sessionId,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      metadata: metadata ?? null,
    });
  }

  async listMobileSessions(userId: string, currentSessionId?: string | null) {
    const sessions = await this.mobileSessionRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      select: [
        "id",
        "userId",
        "deviceName",
        "platform",
        "revokedAt",
        "lastSeenAt",
        "createdAt",
        "updatedAt",
      ],
    });

    return sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      platform: session.platform,
      revokedAt: session.revokedAt,
      lastSeenAt: session.lastSeenAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      active: !session.revokedAt,
      // current: null when caller has a legacy token with no sid (unknown); true/false otherwise
      current:
        currentSessionId != null ? session.id === currentSessionId : null,
    }));
  }

  async revokeMobileSession(
    userId: string,
    sessionId: string,
  ): Promise<string | null> {
    const session = await this.mobileSessionRepository.findOne({
      where: { id: sessionId, userId },
      select: ["id", "userId", "revokedAt"],
    });
    if (!session) {
      throw new NotFoundException("Mobile session not found");
    }
    if (session.revokedAt) {
      return null;
    }
    await this.mobileSessionRepository.update(session.id, {
      revokedAt: new Date(),
    });
    return session.id;
  }

  async revokeAllMobileSessions(
    userId: string,
    exceptSessionId?: string | null,
  ): Promise<string[]> {
    const sessions = await this.mobileSessionRepository.find({
      where: { userId, revokedAt: IsNull() },
      select: ["id"],
    });
    const targetIds = sessions
      .map((s) => s.id)
      .filter((id) => id !== exceptSessionId);

    if (!targetIds.length) return [];

    await this.mobileSessionRepository
      .createQueryBuilder()
      .update(MobileSessionEntity)
      .set({ revokedAt: new Date() })
      .where("id IN (:...ids)", { ids: targetIds })
      .execute();

    return targetIds;
  }

  private registrationRepositories(
    manager: EntityManager,
  ): RegistrationRepositories {
    return {
      userRepository: manager.getRepository(UserEntity),
      betaInviteRepository: manager.getRepository(BetaInviteEntity),
      webSessionRepository: manager.getRepository(WebSessionEntity),
      mobileSessionRepository: manager.getRepository(MobileSessionEntity),
      emailChangeRequestRepository: manager.getRepository(
        EmailChangeRequestEntity,
      ),
    };
  }

  private async createRegisteredUser(
    dto: RegisterDto,
    repositories: RegistrationRepositories,
  ): Promise<{
    user: UserEntity;
    pendingInvite: PendingInviteRedemption | null;
  }> {
    assertBcryptCompatiblePassword(dto.password);
    const normalizedEmail = dto.email.toLowerCase();

    const existing = await repositories.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException("Email already registered");
    }
    const now = new Date();
    await repositories.emailChangeRequestRepository.update(
      {
        newEmail: normalizedEmail,
        expiresAt: LessThanOrEqual(now),
        completedAt: IsNull(),
        cancelledAt: IsNull(),
      },
      { cancelledAt: now },
    );
    const reserved = await repositories.emailChangeRequestRepository.findOne({
      where: {
        newEmail: normalizedEmail,
        completedAt: IsNull(),
        cancelledAt: IsNull(),
      },
      select: ["id"],
    });
    if (reserved) {
      throw new ConflictException("Email change already pending");
    }

    const pendingInvite = await this.requireInviteCode(
      dto.inviteCode,
      normalizedEmail,
      repositories.betaInviteRepository,
    );

    const passwordHash = await hashAccountPassword(dto.password, 12);
    const user = repositories.userRepository.create({
      email: normalizedEmail,
      name: dto.name,
      passwordHash,
      avatarUrl: dto.avatarUrl,
      emailVerifiedAt: null,
      betaAccessEndsAt: pendingInvite
        ? new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
        : null,
    });

    return {
      user: await repositories.userRepository.save(user),
      pendingInvite,
    };
  }

  private async updateMobileSession(
    sessionId: string,
    refreshToken: string,
    repository: Repository<MobileSessionEntity> = this.mobileSessionRepository,
  ): Promise<void> {
    const hashed = await this.hashToken(refreshToken);
    await repository.update(sessionId, { refreshTokenHash: hashed });
  }

  private async updateWebSession(
    sessionId: string,
    refreshToken: string,
    repository: Repository<WebSessionEntity> = this.webSessionRepository,
  ): Promise<void> {
    const hashed = await this.hashToken(refreshToken);
    await repository.update(sessionId, {
      refreshTokenHash: hashed,
      revokedAt: null,
    });
  }

  private async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  private async rotateMobileSessionRefreshToken(
    session: Pick<MobileSessionEntity, "id" | "userId" | "refreshTokenHash">,
    nextRefreshToken: string,
  ): Promise<void> {
    const nextHash = await this.hashToken(nextRefreshToken);
    const rotation = await this.mobileSessionRepository.update(
      {
        id: session.id,
        userId: session.userId,
        revokedAt: IsNull(),
        refreshTokenHash: session.refreshTokenHash,
      },
      { refreshTokenHash: nextHash, lastSeenAt: new Date() },
    );
    if (rotation.affected === 1) return;

    await this.mobileSessionRepository.update(
      { id: session.id, userId: session.userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    throw new UnauthorizedException(
      "Access denied - refresh token already rotated",
    );
  }

  private async rotateWebSessionRefreshToken(
    session: Pick<
      WebSessionEntity,
      "id" | "userId" | "refreshTokenHash" | "ipAddress" | "userAgent"
    >,
    nextRefreshToken: string,
    context: WebSessionContext,
  ): Promise<void> {
    const nextHash = await this.hashToken(nextRefreshToken);
    const rotation = await this.webSessionRepository.update(
      {
        id: session.id,
        userId: session.userId,
        revokedAt: IsNull(),
        refreshTokenHash: session.refreshTokenHash,
      },
      {
        refreshTokenHash: nextHash,
        ipAddress: context.ipAddress ?? session.ipAddress ?? null,
        userAgent: context.userAgent ?? session.userAgent ?? null,
        lastSeenAt: new Date(),
      },
    );
    if (rotation.affected === 1) return;

    await this.webSessionRepository.update(
      { id: session.id, userId: session.userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    throw new UnauthorizedException(
      "Access denied - refresh token already rotated",
    );
  }

  private async issueAccountActionToken(
    userId: string,
    purpose: AccountActionTokenPurpose,
    ttlMs: number,
  ) {
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    await this.accountActionTokenRepository.update(
      { userId, purpose, usedAt: IsNull() },
      { usedAt: now },
    );
    await this.accountActionTokenRepository.save(
      this.accountActionTokenRepository.create({
        userId,
        purpose,
        tokenHash: this.hashAccountActionToken(token),
        expiresAt: new Date(now.getTime() + ttlMs),
        usedAt: null,
      }),
    );
    return token;
  }

  private hashAccountActionToken(token: string) {
    if (!token || token.length > 512) {
      throw new BadRequestException("ACCOUNT_ACTION_TOKEN_INVALID");
    }
    return createHash("sha256").update(token).digest("hex");
  }

  private isUniqueViolation(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "23505"
    );
  }

  private sanitizeUser(
    user: UserEntity,
  ): Omit<UserEntity, "passwordHash" | "refreshToken"> {
    const { passwordHash, refreshToken, ...sanitized } = user as UserEntity & {
      passwordHash?: string;
      refreshToken?: string | null;
    };
    return sanitized;
  }

  private async requireInviteCode(
    inviteCode: string | undefined,
    normalizedEmail: string,
    repository: Repository<BetaInviteEntity>,
  ): Promise<PendingInviteRedemption | null> {
    const mode =
      this.configService.get<string>("CLAWCHAT_BETA_SIGNUP_MODE") || "invite";
    if (
      mode === "open" &&
      this.configService.get<string>("NODE_ENV") !== "production"
    ) {
      return null;
    }

    const inviteCodes = parseBetaInviteCodes(
      this.configService.get<string>("CLAWCHAT_BETA_INVITE_CODES"),
    );
    if (!inviteCodes.size) {
      throw new BadRequestException("Beta signup is closed.");
    }

    const submitted = inviteCode?.trim();
    if (!submitted) {
      throw new BadRequestException("A valid beta invite code is required.");
    }

    const codeHash = this.hashInviteCode(submitted);
    let invite = await this.resolveInviteByHash(repository, submitted);

    if (!invite && inviteCodes.has(submitted)) {
      invite = await repository.save(
        repository.create({
          codeHash,
          email: null,
          maxUses: 1,
          useCount: 0,
          expiresAt: null,
          revokedAt: null,
          lastUsedAt: null,
        }),
      );
    }

    if (!invite) {
      throw new BadRequestException("A valid beta invite code is required.");
    }

    const now = new Date();
    const inviteEmail = invite.email?.trim().toLowerCase() ?? null;
    if (invite.revokedAt || (invite.expiresAt && invite.expiresAt <= now)) {
      throw new BadRequestException("A valid beta invite code is required.");
    }
    if (inviteEmail && inviteEmail !== normalizedEmail) {
      throw new BadRequestException("A valid beta invite code is required.");
    }
    if (invite.useCount >= invite.maxUses) {
      throw new BadRequestException("A valid beta invite code is required.");
    }

    return { invite, inviteEmail, normalizedEmail };
  }

  private async consumeInviteCode(
    pendingInvite: PendingInviteRedemption | null,
    userId: string,
    repository: Repository<BetaInviteEntity>,
  ): Promise<InviteAcceptedAudit | null> {
    if (!pendingInvite) return null;

    const { invite, inviteEmail, normalizedEmail } = pendingInvite;
    const now = new Date();

    const updateResult = await repository
      .createQueryBuilder()
      .update(BetaInviteEntity)
      .set({
        useCount: () => '"useCount" + 1',
        lastUsedAt: now,
        lastUsedByUserId: userId,
        lastUsedEmail: normalizedEmail,
      })
      .where("id = :id", { id: invite.id })
      .andWhere('"revokedAt" IS NULL')
      .andWhere('("expiresAt" IS NULL OR "expiresAt" > :now)', { now })
      .andWhere("(email IS NULL OR LOWER(email) = :normalizedEmail)", {
        normalizedEmail,
      })
      .andWhere('"useCount" < "maxUses"')
      .execute();

    if (!updateResult.affected) {
      throw new BadRequestException("A valid beta invite code is required.");
    }

    return {
      inviteId: invite.id,
      normalizedEmail,
      inviteEmail,
      maxUses: invite.maxUses,
    };
  }

  private async recordInviteAccepted(inviteAudit: InviteAcceptedAudit | null) {
    if (!inviteAudit) return;

    await this.auditLogService.record({
      actorType: "anonymous",
      actorId: inviteAudit.normalizedEmail,
      eventType: "auth.invite.accepted",
      resourceType: "beta_invite",
      resourceId: inviteAudit.inviteId,
      metadata: {
        emailBound: Boolean(inviteAudit.inviteEmail),
        maxUses: inviteAudit.maxUses,
      },
    });
  }

  private hashInviteCode(inviteCode: string) {
    return this.hashInviteCodeWithSecret(inviteCode, this.inviteHashSecret());
  }

  private inviteHashSecret() {
    const secret = this.configService
      .get<string>("CLAWCHAT_BETA_INVITE_HASH_SECRET")
      ?.trim();
    if (!secret) throw new Error("CLAWCHAT_BETA_INVITE_HASH_SECRET_MISSING");
    return secret;
  }

  private transitionalInviteHashSecrets() {
    const current = this.inviteHashSecret();
    return [
      ...(this.configService
        .get<string>("CLAWCHAT_BETA_INVITE_HASH_PREVIOUS_SECRETS")
        ?.split(",") ?? []),
      this.configService.get<string>("JWT_SECRET"),
      this.configService.get<string>("APP_ENCRYPTION_KEY"),
    ]
      .map((secret) => secret?.trim())
      .filter(
        (secret, index, all): secret is string =>
          Boolean(secret) &&
          secret !== current &&
          all.indexOf(secret) === index,
      );
  }

  private hashInviteCodeWithSecret(inviteCode: string, secret: string) {
    return createHmac("sha256", secret).update(inviteCode.trim()).digest("hex");
  }

  private async resolveInviteByHash(
    repository: Repository<BetaInviteEntity>,
    inviteCode: string,
  ) {
    const currentHash = this.hashInviteCode(inviteCode);
    const current = await repository.findOne({
      where: { codeHash: currentHash },
    });
    const transitionalHashes = this.transitionalInviteHashSecrets().map(
      (secret) => this.hashInviteCodeWithSecret(inviteCode, secret),
    );
    const legacyMatches = transitionalHashes.length
      ? await repository.find({ where: { codeHash: In(transitionalHashes) } })
      : [];
    if (legacyMatches.length > 1 || (current && legacyMatches.length)) {
      throw new Error("CLAWCHAT_BETA_INVITE_HASH_CONFLICT");
    }
    if (current) return current;
    const legacy = legacyMatches[0];
    if (!legacy) return null;

    const migration = await repository.update(
      { id: legacy.id, codeHash: legacy.codeHash },
      { codeHash: currentHash },
    );
    if (migration.affected !== 1) {
      const migrated = await repository.findOne({
        where: { codeHash: currentHash },
      });
      if (migrated?.id === legacy.id) return migrated;
      throw new Error("CLAWCHAT_BETA_INVITE_HASH_MIGRATION_CONFLICT");
    }

    legacy.codeHash = currentHash;
    return legacy;
  }

  private async getActiveWebSession(
    sessionId: string,
    userId: string,
  ): Promise<WebSessionEntity> {
    const session = await this.webSessionRepository.findOne({
      where: { id: sessionId, userId, revokedAt: IsNull() },
      select: [
        "id",
        "userId",
        "refreshTokenHash",
        "revokedAt",
        "createdAt",
        "updatedAt",
        "ipAddress",
        "userAgent",
        "lastSeenAt",
      ],
    });
    if (!session) {
      throw new UnauthorizedException("Web session not found");
    }
    return session;
  }

  private async getOwnedWebSession(sessionId: string, userId: string) {
    const session = await this.webSessionRepository.findOne({
      where: { id: sessionId, userId },
      select: [
        "id",
        "userId",
        "revokedAt",
        "createdAt",
        "updatedAt",
        "ipAddress",
        "userAgent",
        "lastSeenAt",
      ],
    });
    if (!session) {
      throw new UnauthorizedException("Web session not found");
    }
    return session;
  }
}
