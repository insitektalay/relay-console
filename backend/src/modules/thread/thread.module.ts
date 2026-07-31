import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThreadEntity } from "../../entities/thread.entity";
import { ThreadReadStateEntity } from "../../entities/thread-read-state.entity";
import { MessageEntity } from "../../entities/message.entity";
import { AgentEntity } from "../../entities/agent.entity";
import { ThreadAgentMembershipEntity } from "../../entities/thread-agent-membership.entity";
import { ThreadWrapUpReportEntity } from "../../entities/thread-wrap-up-report.entity";
import { ThreadSessionEntity } from "../../entities/thread-session.entity";
import { TeamEntity } from "../../entities/team.entity";
import { DepartmentEntity } from "../../entities/department.entity";
import { ThreadService } from "./thread.service";
import { ThreadController } from "./thread.controller";
import { ThreadMembershipService } from "./thread-membership.service";
import { ThreadWrapUpService } from "./thread-wrap-up.service";
import { ThreadSessionService } from "./thread-session.service";
import { WorkspaceMembershipModule } from "../workspace-membership/workspace-membership.module";
import { ClaudeModule } from "../claude/claude.module";
import { RuntimeModule } from "../runtime/runtime.module";
import { ResourceAccessModule } from "../resource-access/resource-access.module";
import { ThreadRuntimeLifecycleService } from "./thread-runtime-lifecycle.service";
import { ThreadUserMessageAnalysisService } from "./thread-user-message-analysis.service";
import { ThreadAgentRepeatAnalysisService } from "./thread-agent-repeat-analysis.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ThreadEntity,
      ThreadReadStateEntity,
      MessageEntity,
      AgentEntity,
      ThreadAgentMembershipEntity,
      ThreadWrapUpReportEntity,
      ThreadSessionEntity,
      TeamEntity,
      DepartmentEntity,
    ]),
    WorkspaceMembershipModule,
    ResourceAccessModule,
    RuntimeModule,
    forwardRef(() => ClaudeModule),
  ],
  controllers: [ThreadController],
  providers: [
    ThreadService,
    ThreadMembershipService,
    ThreadWrapUpService,
    ThreadSessionService,
    ThreadRuntimeLifecycleService,
    ThreadUserMessageAnalysisService,
    ThreadAgentRepeatAnalysisService,
  ],
  exports: [
    ThreadService,
    ThreadMembershipService,
    ThreadWrapUpService,
    ThreadSessionService,
    ThreadRuntimeLifecycleService,
  ],
})
export class ThreadModule {}
