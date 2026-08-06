import { BullModule } from "@nestjs/bull";
import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MessageEntity } from "../../entities/message.entity";
import { LinkedApplicationEntity } from "../../entities/linked-application.entity";
import { MarketplaceConnectionEntity } from "../../entities/marketplace-connection.entity";
import { MarketplaceInstallEntity } from "../../entities/marketplace-install.entity";
import { MeetingRulePackSnapshotEntity } from "../../entities/meeting-rule-pack-snapshot.entity";
import { MeetingSessionEntity } from "../../entities/meeting-session.entity";
import { MessageReactionEntity } from "../../entities/message-reaction.entity";
import { ThreadEntity } from "../../entities/thread.entity";
import { TeamEntity } from "../../entities/team.entity";
import { DepartmentEntity } from "../../entities/department.entity";
import { AgentEntity } from "../../entities/agent.entity";
import { TaskEntity } from "../../entities/task.entity";
import { RuntimeDispatchEntity } from "../../entities/runtime-dispatch.entity";
import { MessageService } from "./message.service";
import { MessageController } from "./message.controller";
import { EventsModule } from "../../gateways/events.module";
import { ThreadModule } from "../thread/thread.module";
import { WorkspaceMembershipModule } from "../workspace-membership/workspace-membership.module";
import { ClaudeModule } from "../claude/claude.module";
import { RuntimeModule } from "../runtime/runtime.module";
import { MessageCondensingService } from "./message-condensing.service";
import { MessageCondensingProcessor } from "./message-condensing.processor";
import { MessageStructuredSummaryService } from "./message-structured-summary.service";
import { MESSAGE_CONDENSING_QUEUE } from "./message-condensed.types";

@Module({
  imports: [
    BullModule.registerQueue({
      name: MESSAGE_CONDENSING_QUEUE,
    }),
    TypeOrmModule.forFeature([
      MessageEntity,
      MessageReactionEntity,
      ThreadEntity,
      TeamEntity,
      DepartmentEntity,
      AgentEntity,
      LinkedApplicationEntity,
      MarketplaceConnectionEntity,
      MarketplaceInstallEntity,
      MeetingRulePackSnapshotEntity,
      MeetingSessionEntity,
      TaskEntity,
      RuntimeDispatchEntity,
    ]),
    EventsModule,
    forwardRef(() => ThreadModule),
    WorkspaceMembershipModule,
    RuntimeModule,
    forwardRef(() => ClaudeModule),
  ],
  controllers: [MessageController],
  providers: [
    MessageService,
    MessageCondensingService,
    MessageCondensingProcessor,
    MessageStructuredSummaryService,
  ],
  exports: [MessageService, MessageCondensingService],
})
export class MessageModule {}
