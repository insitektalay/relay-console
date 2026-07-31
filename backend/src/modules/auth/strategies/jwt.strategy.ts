import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { Request } from "express";
import { UserEntity } from "../../../entities/user.entity";
import { WebSessionEntity } from "../../../entities/web-session.entity";
import { MobileSessionEntity } from "../../../entities/mobile-session.entity";
import { WEB_ACCESS_COOKIE } from "../auth.constants";
import { AuthenticatedUser } from "../auth.types";
import {
  hasExactRelayJwtAudience,
  RELAY_JWT_ALGORITHM,
  RELAY_JWT_AUDIENCES,
  resolveRelayJwtIssuer,
} from "../auth-token-policy";

export interface JwtPayload {
  sub: string;
  email: string;
  kind: "web" | "mobile";
  sid: string;
  aud: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    configService: ConfigService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(WebSessionEntity)
    private readonly webSessionRepository: Repository<WebSessionEntity>,
    @InjectRepository(MobileSessionEntity)
    private readonly mobileSessionRepository: Repository<MobileSessionEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => request?.cookies?.[WEB_ACCESS_COOKIE] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET"),
      issuer: resolveRelayJwtIssuer(configService.get<string>("JWT_ISSUER")),
      audience: [
        RELAY_JWT_AUDIENCES.webAccess,
        RELAY_JWT_AUDIENCES.mobileAccess,
      ],
      algorithms: [RELAY_JWT_ALGORITHM],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: JwtPayload,
  ): Promise<AuthenticatedUser> {
    const storedUser = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: [
        "id",
        "email",
        "name",
        "avatarUrl",
        "createdAt",
        "updatedAt",
      ],
    });
    if (!storedUser) {
      throw new UnauthorizedException("User not found");
    }
    const user = storedUser;

    const hasBearerToken = /^Bearer\s+\S+/i.test(req?.headers?.authorization ?? "");
    const hasWebCookie = Boolean(req?.cookies?.[WEB_ACCESS_COOKIE]);

    if (
      payload.kind === "web" &&
      hasExactRelayJwtAudience(payload, RELAY_JWT_AUDIENCES.webAccess)
    ) {
      // Browser tokens are deliberately cookie-only. Accepting one through the
      // bearer extractor would bypass CSRF classification and allow a revoked
      // browser token to skip its active-session lookup until JWT expiry.
      if (hasBearerToken || !hasWebCookie || !payload.sid) {
        throw new UnauthorizedException("Invalid browser session");
      }

      const session = await this.webSessionRepository.findOne({
        where: { id: payload.sid, userId: user.id, revokedAt: IsNull() },
        select: ["id"],
      });
      if (!session) {
        throw new UnauthorizedException("Invalid browser session");
      }

      return {
        ...user,
        currentWebSessionId: session.id,
      };
    }

    if (
      payload.kind !== "mobile" ||
      !hasExactRelayJwtAudience(payload, RELAY_JWT_AUDIENCES.mobileAccess) ||
      !payload.sid ||
      !hasBearerToken
    ) {
      throw new UnauthorizedException("Invalid API session");
    }

    // Mobile tokens remain bearer-only. Ignore an unrelated/stale browser
    // cookie because Passport selects the bearer extractor first.
    const session = await this.mobileSessionRepository.findOne({
      where: { id: payload.sid, userId: user.id, revokedAt: IsNull() },
      select: ["id"],
    });
    if (!session) {
      throw new UnauthorizedException("Invalid mobile session");
    }
    return { ...user, currentMobileSessionId: session.id };
  }
}
