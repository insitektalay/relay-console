import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./modules/auth/auth.module";
import { EventsModule } from "./gateways/events.module";
import { JobsModule } from "./jobs/jobs.module";
import { WorkspaceModule } from "./modules/workspace/workspace.module";
import { AgentModule } from "./modules/agent/agent.module";
import { TeamModule } from "./modules/team/team.module";
import { DepartmentModule } from "./modules/department/department.module";
import { OrgModule } from "./modules/org/org.module";
import { ThreadModule } from "./modules/thread/thread.module";
import { MessageModule } from "./modules/message/message.module";
import { TaskModule } from "./modules/task/task.module";
import { ApprovalModule } from "./modules/approval/approval.module";
import { IncidentModule } from "./modules/incident/incident.module";
import { ReportModule } from "./modules/report/report.module";
import { PerformanceModule } from "./modules/performance/performance.module";
import { BridgeModule } from "./modules/bridge/bridge.module";
import { NotificationModule } from "./modules/notification/notification.module";
import { CapacityModule } from "./modules/capacity/capacity.module";
import { WorkLogsModule } from "./modules/worklogs/worklogs.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { SchedulingModule } from "./modules/schedule/schedule.module";
import { MeetingModule } from "./modules/meeting/meeting.module";
import { WorkspaceMembershipModule } from "./modules/workspace-membership/workspace-membership.module";
import { AuditLogModule } from "./modules/audit-log/audit-log.module";
import { SecurityModule } from "./modules/security/security.module";
import { ClaudeModule } from "./modules/claude/claude.module";
import { HermesModule } from "./modules/hermes/hermes.module";
import { RuntimeModule } from "./modules/runtime/runtime.module";
import { PaperclipModule } from "./modules/paperclip/paperclip.module";
import { AgentDocumentationModule } from "./modules/agent-documentation/agent-documentation.module";
import { MarketplaceModule } from "./modules/marketplace/marketplace.module";
import { AgentOpsModule } from "./modules/agent-ops/agent-ops.module";
import { HealthModule } from "./modules/health/health.module";
import { ToolRequestModule } from "./modules/tool-request/tool-request.module";
import { RelaySyncModule } from "./modules/relay-sync/relay-sync.module";
import { CloudCommercialModule } from "./modules/cloud-commercial/cloud-commercial.module";
import { EntitlementWriteGuard } from "./modules/cloud-commercial/entitlement-write.guard";
import { WaitlistModule } from "./modules/waitlist/waitlist.module";
import { AbuseThrottlerGuard } from "./modules/security/abuse-throttler.guard";
import { buildTypeOrmLoggingConfig } from "./infrastructure/database/typeorm-logging";
import { getRateLimitTracker } from "./modules/security/client-ip";
import { JwtAuthGuard } from "./modules/auth/guards/jwt-auth.guard";
import { DistributedRateLimitService } from "./modules/security/distributed-rate-limit.service";
import { databaseTlsForEnvironment } from "./infrastructure/database/production-database-tls";

function buildBullRedisConfig(config: ConfigService) {
  const redisUrl =
    config.get<string>("REDIS_URL") || config.get<string>("REDIS_PUBLIC_URL");

  if (redisUrl?.trim()) {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || "6379"),
      username: decodeURIComponent(parsed.username || "").trim() || undefined,
      password: decodeURIComponent(parsed.password || "").trim() || undefined,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
    };
  }

  return {
    host:
      config.get<string>("REDIS_HOST") ||
      config.get<string>("REDISHOST") ||
      "localhost",
    port:
      config.get<number>("REDIS_PORT") ||
      Number(config.get<string>("REDISPORT") || "6379"),
    username:
      config.get<string>("REDIS_USER") ||
      config.get<string>("REDISUSER") ||
      undefined,
    password:
      config.get<string>("REDIS_PASSWORD") ||
      config.get<string>("REDISPASSWORD") ||
      undefined,
  };
}

function configNumber(config: ConfigService, key: string, fallback: number) {
  const value = config.get<string | number>(key);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        url: config.get("DATABASE_URL"),
        host: config.get("DATABASE_HOST"),
        port: config.get<number>("DATABASE_PORT"),
        database: config.get("DATABASE_NAME"),
        username: config.get("DATABASE_USER"),
        password: config.get("DATABASE_PASSWORD"),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
        migrations: [__dirname + "/migrations/*{.ts,.js}"],
        synchronize: false,
        ...buildTypeOrmLoggingConfig(process.env),
        ssl: databaseTlsForEnvironment(process.env),
      }),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: buildBullRedisConfig(config),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule, SecurityModule],
      useFactory: (
        config: ConfigService,
        storage: DistributedRateLimitService,
      ) => ({
        throttlers: [
          {
            ttl: configNumber(config, "THROTTLE_TTL", 60) * 1000,
            limit: configNumber(config, "THROTTLE_LIMIT", 100),
          },
        ],
        getTracker: getRateLimitTracker,
        storage,
      }),
      inject: [ConfigService, DistributedRateLimitService],
    }),
    HealthModule,
    WaitlistModule,
    ToolRequestModule,
    RelaySyncModule,
    CloudCommercialModule,
    AuthModule,
    SecurityModule,
    RuntimeModule,
    PaperclipModule,
    AgentDocumentationModule,
    MarketplaceModule,
    AgentOpsModule,
    ClaudeModule,
    HermesModule,
    WorkspaceMembershipModule,
    AuditLogModule,
    EventsModule,
    JobsModule,
    WorkspaceModule,
    AgentModule,
    TeamModule,
    DepartmentModule,
    OrgModule,
    ThreadModule,
    MessageModule,
    MeetingModule,
    TaskModule,
    ApprovalModule,
    IncidentModule,
    ReportModule,
    SchedulingModule,
    PerformanceModule,
    BridgeModule,
    NotificationModule,
    CapacityModule,
    WorkLogsModule,
    PermissionsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AbuseThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: EntitlementWriteGuard,
    },
  ],
})
export class AppModule {}
