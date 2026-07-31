import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { UserEntity } from "../../entities/user.entity";
import { BetaInviteEntity } from "../../entities/beta-invite.entity";
import { WebSessionEntity } from "../../entities/web-session.entity";
import { MobileSessionEntity } from "../../entities/mobile-session.entity";
import { AccountActionTokenEntity } from "../../entities/account-action-token.entity";
import { EmailChangeRequestEntity } from "../../entities/email-change-request.entity";
import { EventsModule } from "../../gateways/events.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { WorkspaceMembershipModule } from "../workspace-membership/workspace-membership.module";
import { TransactionalEmailService } from "./transactional-email.service";
import { AccountDataLifecycleService } from "./account-data-lifecycle.service";
import {
  RELAY_JWT_ALGORITHM,
  resolveRelayJwtIssuer,
} from "./auth-token-policy";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      BetaInviteEntity,
      WebSessionEntity,
      MobileSessionEntity,
      AccountActionTokenEntity,
      EmailChangeRequestEntity,
    ]),
    EventsModule,
    AuditLogModule,
    WorkspaceMembershipModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: config.get<string>("JWT_EXPIRES_IN") || "15m",
          issuer: resolveRelayJwtIssuer(config.get<string>("JWT_ISSUER")),
          algorithm: RELAY_JWT_ALGORITHM,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    TransactionalEmailService,
    AccountDataLifecycleService,
    JwtStrategy,
    JwtAuthGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
