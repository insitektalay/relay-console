import { InjectQueue } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Queue } from "bull";
import { Repository } from "typeorm";
import { EventsGateway } from "../../gateways/events.gateway";
import { MessageEntity, MessageProvenance, ThreadEntity } from "../../entities";
import { MessageStructuredSummaryService } from "./message-structured-summary.service";
import {
  CONDENSE_MESSAGE_JOB,
  CONDENSED_MESSAGE_PROVIDER,
  MESSAGE_CONDENSING_QUEUE,
  getCondensedMessageMetadata,
  withCondensedMessageMetadata,
  type MessageCondensedUpdatedPayload,
} from "./message-condensed.types";

type CondenseMessageJobData = {
  messageId: string;
  threadId: string;
  workspaceId: string;
  threadTitle: string | null;
  sourceContentHash: string;
};

@Injectable()
export class MessageCondensingService {
  private readonly logger = new Logger(MessageCondensingService.name);
  private eligibilityCount = 0;
  private enqueuedCount = 0;
  private successCount = 0;
  private failureCount = 0;
  private retryCount = 0;
  private totalSummaryLength = 0;

  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
    @InjectQueue(MESSAGE_CONDENSING_QUEUE)
    private readonly condensingQueue: Queue<CondenseMessageJobData>,
    private readonly configService: ConfigService,
    private readonly messageStructuredSummaryService: MessageStructuredSummaryService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  isSummarizationEnabled() {
    return (
      this.configService.get<string>(
        "CONDENSED_TEAM_CHAT_SUMMARIZATION_ENABLED",
      ) === "true"
    );
  }

  isRealtimeEnabled() {
    return (
      this.configService.get<string>("CONDENSED_TEAM_CHAT_REALTIME_ENABLED") ===
      "true"
    );
  }

  isEligible(thread: ThreadEntity, message: MessageEntity) {
    return (
      thread.type === "team" &&
      message.provenance === MessageProvenance.AGENT &&
      message.isFromUser === false &&
      Boolean(message.content?.trim())
    );
  }

  async maybeEnqueueSummary(thread: ThreadEntity, message: MessageEntity) {
    if (!this.isSummarizationEnabled()) {
      return;
    }

    if (!this.isEligible(thread, message)) {
      return;
    }

    this.eligibilityCount += 1;
    this.logger.log(
      `condensed_message.eligible messageId=${message.id} threadId=${thread.id} count=${this.eligibilityCount}`,
    );

    const sourceContentHash = this.messageStructuredSummaryService.hashContent(
      message.content,
    );
    const existing = getCondensedMessageMetadata(message.metadata);

    if (
      existing?.provider === CONDENSED_MESSAGE_PROVIDER &&
      existing.sourceContentHash === sourceContentHash &&
      existing.text
    ) {
      this.logger.log(
        `condensed_message.skip_already_summarized messageId=${message.id} threadId=${thread.id}`,
      );
      return;
    }

    try {
      await this.condensingQueue.add(
        CONDENSE_MESSAGE_JOB,
        {
          messageId: message.id,
          threadId: thread.id,
          workspaceId: thread.workspaceId,
          threadTitle: thread.title ?? null,
          sourceContentHash,
        },
        {
          jobId: `${message.id}:${sourceContentHash}`,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5_000,
          },
          removeOnComplete: true,
          removeOnFail: 20,
        },
      );

      this.enqueuedCount += 1;
      this.logger.log(
        `condensed_message.enqueued messageId=${message.id} threadId=${thread.id} count=${this.enqueuedCount}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue condensed summary for message ${message.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async processQueuedMessage(
    data: CondenseMessageJobData,
    attemptsMade: number,
  ) {
    if (!this.isSummarizationEnabled()) {
      return;
    }

    if (attemptsMade > 0) {
      this.retryCount += 1;
      this.logger.warn(
        `condensed_message.retry messageId=${data.messageId} attemptsMade=${attemptsMade} retryCount=${this.retryCount}`,
      );
    }

    const startedAt = Date.now();
    const message = await this.messageRepo.findOne({
      where: { id: data.messageId, threadId: data.threadId },
    });

    if (!message || !message.content?.trim()) {
      this.logger.warn(
        `condensed_message.skip_missing messageId=${data.messageId} threadId=${data.threadId}`,
      );
      return;
    }

    const currentHash = this.messageStructuredSummaryService.hashContent(
      message.content,
    );
    const existing = getCondensedMessageMetadata(message.metadata);

    if (
      existing?.provider === CONDENSED_MESSAGE_PROVIDER &&
      existing.sourceContentHash === currentHash &&
      existing.text
    ) {
      this.logger.log(
        `condensed_message.skip_existing messageId=${data.messageId} threadId=${data.threadId}`,
      );
      return;
    }

    if (currentHash !== data.sourceContentHash) {
      this.logger.warn(
        `condensed_message.skip_stale messageId=${data.messageId} threadId=${data.threadId}`,
      );
      return;
    }

    try {
      const condensed = await this.messageStructuredSummaryService.condenseMessage({
        workspaceId: data.workspaceId,
        threadId: message.threadId,
        messageId: message.id,
        threadTitle: data.threadTitle ?? null,
        senderName: message.senderName,
        content: message.content,
      });

      message.metadata = withCondensedMessageMetadata(
        message.metadata,
        condensed,
      );
      const saved = await this.messageRepo.save(message);

      this.successCount += 1;
      this.totalSummaryLength += condensed.text.length;
      const latencyMs = Date.now() - startedAt;
      const averageSummaryLength = Math.round(
        this.totalSummaryLength / Math.max(this.successCount, 1),
      );

      this.logger.log(
        `condensed_message.success messageId=${message.id} threadId=${message.threadId} latencyMs=${latencyMs} summaryLength=${condensed.text.length} averageSummaryLength=${averageSummaryLength} successCount=${this.successCount}`,
      );

      if (this.isRealtimeEnabled()) {
        const payload: MessageCondensedUpdatedPayload = {
          threadId: message.threadId,
          messageId: message.id,
          condensed,
          updatedAt: saved.updatedAt.toISOString(),
        };

        this.eventsGateway.emitToScopes(
          {
            workspaceId: data.workspaceId,
            threadId: data.threadId,
          },
          "message.condensed",
          payload,
        );
      }
    } catch (error) {
      this.failureCount += 1;
      const latencyMs = Date.now() - startedAt;
      this.logger.error(
        `condensed_message.failure messageId=${data.messageId} threadId=${data.threadId} latencyMs=${latencyMs} failureCount=${this.failureCount} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }
}
