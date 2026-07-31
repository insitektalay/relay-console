import { Injectable } from "@nestjs/common";
import { ClaudeService } from "../claude/claude.service";
import { RuntimeThreadSessionService } from "../runtime/runtime-thread-session.service";

@Injectable()
export class ThreadRuntimeLifecycleService {
  constructor(
    private readonly runtimeThreadSessionService: RuntimeThreadSessionService,
    private readonly claudeService: ClaudeService,
  ) {}

  // Temporary compatibility shim for Phase 2:
  // core thread lifecycle no longer calls ClaudeService directly.
  // ClaudeService currently closes generic runtime sessions first and then
  // mirrors the close into legacy Claude tables for rollback compatibility.
  async closeThreadSessionsForThread(input: {
    threadId: string;
    threadSessionId?: string | null;
    agentIds?: string[];
    reason?: string | null;
  }) {
    await this.runtimeThreadSessionService.closeForThread({
      threadId: input.threadId,
      threadSessionId: input.threadSessionId,
      agentIds: input.agentIds,
      reason: input.reason ?? null,
    });

    await this.claudeService.closeLegacyThreadSessionsForThread(input.threadId, {
      threadSessionId: input.threadSessionId,
      agentIds: input.agentIds,
      reason: input.reason ?? null,
    });
  }
}
