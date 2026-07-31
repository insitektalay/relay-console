import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  AgentEntity,
  BridgeDeviceEntity,
  ClaudeAgentBindingEntity,
  ClaudeDispatchEntity,
  ClaudeThreadSessionEntity,
  ThreadEntity,
  ThreadSessionEntity,
} from "../../entities";
import { EventsModule } from "../../gateways/events.module";
import { ClaudeService } from "./claude.service";
import { MessageModule } from "../message/message.module";
import { RuntimeModule } from "../runtime/runtime.module";
import { ClaudeCodeRuntimeAdapter } from "./claude-code-runtime.adapter";
import { ClaudeCliService } from "./claude-cli.service";

@Module({
  imports: [
    forwardRef(() => MessageModule),
    EventsModule,
    RuntimeModule,
    TypeOrmModule.forFeature([
      ClaudeAgentBindingEntity,
      ClaudeThreadSessionEntity,
      ClaudeDispatchEntity,
      AgentEntity,
      ThreadEntity,
      ThreadSessionEntity,
      BridgeDeviceEntity,
    ]),
  ],
  providers: [ClaudeService, ClaudeCodeRuntimeAdapter, ClaudeCliService],
  exports: [ClaudeService, ClaudeCliService],
})
export class ClaudeModule {}
