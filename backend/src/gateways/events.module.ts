import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventsGateway } from "./events.gateway";
import { BridgeControlCoordinatorService } from "./bridge-control-coordinator.service";
import { BridgeControlBusService } from "./bridge-control-bus.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WebSessionEntity } from "../entities/web-session.entity";
import { MobileSessionEntity } from "../entities/mobile-session.entity";
import { ThreadEntity } from "../entities/thread.entity";
import { AgentEntity } from "../entities/agent.entity";
import { BridgeDeviceEntity } from "../entities/bridge-device.entity";
import { MessageEntity } from "../entities/message.entity";
import { WorkspaceMembershipModule } from "../modules/workspace-membership/workspace-membership.module";
import { AuditLogModule } from "../modules/audit-log/audit-log.module";
import { WebsocketTicketReplayService } from "./websocket-ticket-replay.service";
import {
  RELAY_JWT_ALGORITHM,
  resolveRelayJwtIssuer,
} from "../modules/auth/auth-token-policy";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebSessionEntity,
      MobileSessionEntity,
      ThreadEntity,
      AgentEntity,
      BridgeDeviceEntity,
      MessageEntity,
    ]),
    WorkspaceMembershipModule,
    AuditLogModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get("JWT_SECRET"),
        signOptions: {
          issuer: resolveRelayJwtIssuer(config.get<string>("JWT_ISSUER")),
          algorithm: RELAY_JWT_ALGORITHM,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    EventsGateway,
    BridgeControlCoordinatorService,
    BridgeControlBusService,
    WebsocketTicketReplayService,
  ],
  exports: [
    EventsGateway,
    BridgeControlCoordinatorService,
    BridgeControlBusService,
    WebsocketTicketReplayService,
  ],
})
export class EventsModule {}
