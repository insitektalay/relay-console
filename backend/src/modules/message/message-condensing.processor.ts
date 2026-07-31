import { Process, Processor } from "@nestjs/bull";
import type { Job } from "bull";
import { MessageCondensingService } from "./message-condensing.service";
import {
  CONDENSE_MESSAGE_JOB,
  MESSAGE_CONDENSING_QUEUE,
} from "./message-condensed.types";

@Processor(MESSAGE_CONDENSING_QUEUE)
export class MessageCondensingProcessor {
  constructor(
    private readonly messageCondensingService: MessageCondensingService,
  ) {}

  @Process(CONDENSE_MESSAGE_JOB)
  async handle(
    job: Job<{
      messageId: string;
      threadId: string;
      workspaceId: string;
      threadTitle: string | null;
      sourceContentHash: string;
    }>,
  ) {
    await this.messageCondensingService.processQueuedMessage(
      job.data,
      job.attemptsMade,
    );
  }
}
