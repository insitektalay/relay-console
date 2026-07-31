import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  AgentEntity,
  ApprovalEntity,
  MessageEntity,
  RuntimeBindingEntity,
  RuntimeDispatchEntity,
  RuntimeThreadSessionEntity,
  TaskEntity,
  ThreadEntity,
} from "../../entities";
import { RuntimeModule } from "../runtime/runtime.module";
import { WorkspaceMembershipModule } from "../workspace-membership/workspace-membership.module";
import { AgentOpsController } from "./agent-ops.controller";
import { AgentOpsService } from "./agent-ops.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentEntity,
      RuntimeBindingEntity,
      RuntimeThreadSessionEntity,
      RuntimeDispatchEntity,
      TaskEntity,
      ApprovalEntity,
      MessageEntity,
      ThreadEntity,
    ]),
    RuntimeModule,
    WorkspaceMembershipModule,
  ],
  controllers: [AgentOpsController],
  providers: [AgentOpsService],
  exports: [AgentOpsService],
})
export class AgentOpsModule {}
