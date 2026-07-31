import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  AgentEntity,
  MessageEntity,
  ThreadEntity,
  ThreadWrapUpReportEntity,
} from "../../entities";
import { ThreadMembershipService } from "./thread-membership.service";
import { ThreadSessionService } from "./thread-session.service";
import { ThreadReadStateEntity } from "../../entities/thread-read-state.entity";
import { ThreadRuntimeLifecycleService } from "./thread-runtime-lifecycle.service";
import { ResourceAccessService } from "../resource-access/resource-access.service";
import {
  RUNTIME_STRUCTURED_JOB_PROVIDER,
  RuntimeStructuredJobService,
} from "../runtime/runtime-structured-job.service";

type WrapUpParticipantSummary = {
  speaker: string;
  role?: string;
  summary: string;
};

type WrapUpTimelineItem = {
  speaker: string;
  timestamp?: string;
  summary: string;
};

type WrapUpCommitment = {
  owner: string;
  commitment: string;
};

type WrapUpStructuredData = {
  reportTldr: string;
  overview: string;
  overviewTldr: string;
  participantSummaries: WrapUpParticipantSummary[];
  whoSaidWhatTldr: string;
  discoveries: string[];
  discoveriesTldr: string;
  completedActions: string[];
  completedActionsTldr: string;
  outstandingWork: string[];
  outstandingWorkTldr: string;
  commitments: WrapUpCommitment[];
  commitmentsTldr: string;
  risks: string[];
  risksTldr: string;
  nextSteps: string[];
  nextStepsTldr: string;
  timeline: WrapUpTimelineItem[];
  timelineTldr: string;
};

type WrapUpGenerationResult = {
  markdown: string;
  structuredData: WrapUpStructuredData;
  model: string;
};

const WRAP_UP_PROVIDER = RUNTIME_STRUCTURED_JOB_PROVIDER;
const WRAP_UP_PENDING_MARKDOWN =
  "Wrap-up report generation is running in the background.";

@Injectable()
export class ThreadWrapUpService {
  private readonly logger = new Logger(ThreadWrapUpService.name);

  constructor(
    @InjectRepository(ThreadEntity)
    private readonly threadRepo: Repository<ThreadEntity>,

    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,

    @InjectRepository(ThreadWrapUpReportEntity)
    private readonly wrapUpReportRepo: Repository<ThreadWrapUpReportEntity>,

    @InjectRepository(ThreadReadStateEntity)
    private readonly readStateRepo: Repository<ThreadReadStateEntity>,

    private readonly threadMembershipService: ThreadMembershipService,
    private readonly threadSessionService: ThreadSessionService,
    private readonly configService: ConfigService,
    private readonly threadRuntimeLifecycleService: ThreadRuntimeLifecycleService,
    private readonly runtimeStructuredJobService: RuntimeStructuredJobService,
    private readonly resourceAccessService: ResourceAccessService,
  ) {}

  async getWrapUpReport(threadId: string, userId: string) {
    const thread = await this.threadRepo.findOne({
      where: { id: threadId },
      select: ["id", "workspaceId"],
    });
    if (!thread) throw new NotFoundException("Thread not found");
    await this.resourceAccessService.ensureWorkspaceAccess(
      thread.workspaceId,
      userId,
    );
    const report = await this.wrapUpReportRepo.findOne({
      where: { threadId },
      order: { createdAt: "DESC" },
    });
    if (!report)
      throw new NotFoundException(
        `Wrap-up report for thread ${threadId} not found`,
      );
    return report;
  }

  async wrapUpThread(threadId: string, createdByUserId: string) {
    const thread = await this.threadRepo.findOne({ where: { id: threadId } });
    if (!thread) throw new NotFoundException("Thread not found");
    await this.resourceAccessService.ensureWorkspaceAccess(
      thread.workspaceId,
      createdByUserId,
    );
    const activeSession =
      await this.threadSessionService.ensureActiveSession(thread);
    const existingReport = await this.wrapUpReportRepo.findOne({
      where: { threadSessionId: activeSession.id },
    });

    if (existingReport) {
      return this.finalizeWrapUpThread(thread, activeSession, existingReport);
    }

    const messages = await this.messageRepo.find({
      where: { threadId, threadSessionId: activeSession.id },
      order: { createdAt: "ASC" },
    });
    if (!messages.length) {
      throw new BadRequestException("Cannot wrap up an empty chat");
    }

    const memberAgents =
      await this.threadMembershipService.listMemberAgents(threadId);
    const fileName = this.buildFileName(
      thread.title,
      activeSession.sequenceNumber,
    );

    const reportKind = this.getReportKindLabel(thread);
    let report: ThreadWrapUpReportEntity;
    try {
      report = await this.createPendingWrapUpReport({
        thread,
        activeSession,
        fileName,
        reportKind,
        messageCount: messages.length,
        createdByUserId,
      });
    } catch (error) {
      const duplicateReport = await this.wrapUpReportRepo.findOne({
        where: { threadSessionId: activeSession.id },
      });
      if (!duplicateReport || !this.isUniqueConstraintError(error)) {
        throw error;
      }
      return this.finalizeWrapUpThread(thread, activeSession, duplicateReport);
    }

    const result = await this.finalizeWrapUpThread(
      thread,
      activeSession,
      report,
    );

    void this.completeWrapUpReportInBackground({
      reportId: report.id,
      thread,
      messages,
      memberAgents,
      sessionSequenceNumber: activeSession.sequenceNumber,
    });

    return result;
  }

  async retryWrapUpReport(reportId: string, userId: string) {
    const report = await this.resourceAccessService.ensureWrapUpAccess(
      reportId,
      userId,
    );

    if (report.status === "generating") {
      return report;
    }

    if (report.status !== "failed") {
      throw new BadRequestException("Only failed wrap-up reports can be retried");
    }

    const thread = await this.threadRepo.findOne({
      where: { id: report.threadId },
    });
    if (!thread) throw new NotFoundException("Thread not found");

    const messages = await this.messageRepo.find({
      where: {
        threadId: report.threadId,
        threadSessionId: report.threadSessionId,
      },
      order: { createdAt: "ASC" },
    });
    if (!messages.length) {
      throw new BadRequestException(
        "Cannot retry this report because the archived chat cycle has no messages",
      );
    }

    const memberAgents =
      await this.threadMembershipService.listMemberAgents(report.threadId);
    const updateResult = await this.wrapUpReportRepo.update(
      { id: report.id, status: "failed" },
      {
        provider: WRAP_UP_PROVIDER,
        status: "generating",
        errorMessage: null,
        completedAt: null,
        model: "pending",
        markdown: WRAP_UP_PENDING_MARKDOWN,
        structuredData: {},
        messageCount: messages.length,
      },
    );

    const retryingReport = await this.wrapUpReportRepo.findOne({
      where: { id: report.id },
    });

    if (!updateResult.affected) {
      return retryingReport ?? report;
    }

    void this.completeWrapUpReportInBackground({
      reportId: report.id,
      thread,
      messages,
      memberAgents,
      sessionSequenceNumber: report.threadSessionSequenceNumber,
    });

    return retryingReport ?? report;
  }

  private async createPendingWrapUpReport({
    thread,
    activeSession,
    fileName,
    reportKind,
    messageCount,
    createdByUserId,
  }: {
    thread: ThreadEntity;
    activeSession: { id: string; sequenceNumber: number };
    fileName: string;
    reportKind: string;
    messageCount: number;
    createdByUserId: string;
  }) {
    return this.wrapUpReportRepo.save(
      this.wrapUpReportRepo.create({
        threadId: thread.id,
        threadSessionId: activeSession.id,
        threadSessionSequenceNumber: activeSession.sequenceNumber,
        workspaceId: thread.workspaceId,
        teamId: thread.teamId ?? null,
        title: `${thread.title} ${reportKind} · Session ${activeSession.sequenceNumber}`,
        fileName,
        provider: WRAP_UP_PROVIDER,
        model: "pending",
        status: "generating",
        errorMessage: null,
        completedAt: null,
        markdown: WRAP_UP_PENDING_MARKDOWN,
        structuredData: {},
        messageCount,
        createdByUserId,
      }),
    );
  }

  private async completeWrapUpReportInBackground({
    reportId,
    thread,
    messages,
    memberAgents,
    sessionSequenceNumber,
  }: {
    reportId: string;
    thread: ThreadEntity;
    messages: MessageEntity[];
    memberAgents: AgentEntity[];
    sessionSequenceNumber: number;
  }) {
    try {
      const generated = await this.generateWrapUp(
        reportId,
        thread,
        messages,
        memberAgents,
        sessionSequenceNumber,
      );
      await this.wrapUpReportRepo.update(reportId, {
        status: "completed",
        errorMessage: null,
        completedAt: new Date(),
        model: generated.model,
        markdown: generated.markdown,
        structuredData: generated.structuredData,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await this.wrapUpReportRepo.update(reportId, {
        status: "failed",
        errorMessage: detail,
        completedAt: new Date(),
        markdown: [
          "# Wrap-up report failed",
          "",
          "The chat cycle was safely wrapped up and reset, but report generation failed.",
          "",
          `Error: ${detail}`,
        ].join("\n"),
        structuredData: {
          overview:
            "The chat cycle was safely wrapped up and reset, but report generation failed.",
          error: detail,
        },
      });
      this.logger.warn(
        `Wrap-up report generation failed for report ${reportId}: ${detail}`,
      );
    }
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      Boolean(error) &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    );
  }

  private async finalizeWrapUpThread(
    thread: ThreadEntity,
    activeSession: { id: string; status: string },
    report: ThreadWrapUpReportEntity,
  ) {
    const nextSession =
      activeSession.status === "wrapped_up"
        ? await this.threadSessionService.ensureActiveSession(thread)
        : (await this.threadSessionService.wrapUpActiveSession(thread))
            .activeSession;

    thread.status = "active";
    thread.lastMessage = null;
    await this.threadRepo.save(thread);
    await this.readStateRepo.update(
      { threadId: thread.id },
      {
        lastReadMessageId: null,
        unreadCount: 0,
        updatedAt: new Date(),
      },
    );

    try {
      await this.threadRuntimeLifecycleService.closeThreadSessionsForThread({
        threadId: thread.id,
        threadSessionId: activeSession.id,
        reason: "thread_wrapped_up",
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Wrap-up completed for thread ${thread.id}, but runtime cleanup failed for session ${activeSession.id}: ${detail}`,
      );
    }

    return {
      threadId: thread.id,
      status: thread.status,
      activeSessionId: nextSession.id,
      report,
    };
  }

  private async generateWrapUp(
    reportId: string,
    thread: ThreadEntity,
    messages: MessageEntity[],
    memberAgents: AgentEntity[],
    sessionSequenceNumber: number,
  ): Promise<WrapUpGenerationResult> {
    const model =
      this.configService.get<string>("WRAP_UP_STRUCTURED_JOB_MODEL") ||
      this.configService.get<string>("STRUCTURED_JOBS_DEFAULT_MODEL") ||
      null;
    const timeoutMs = Number(
      this.configService.get<string>("WRAP_UP_STRUCTURED_JOB_TIMEOUT_MS") ??
        this.configService.get<string>("STRUCTURED_JOBS_TIMEOUT_MS") ??
        "180000",
    );

    const payload = {
      thread: {
        id: thread.id,
        title: thread.title,
        type: thread.type,
        teamId: thread.teamId ?? null,
        workspaceId: thread.workspaceId,
      },
      explicitThreadMembers: memberAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        externalId: agent.externalId ?? null,
      })),
      transcript: messages.map((message) => ({
        id: message.id,
        timestamp: message.createdAt.toISOString(),
        senderId: message.senderId,
        senderName: message.senderName,
        senderType: message.isFromUser ? "user" : "agent",
        messageType: message.type,
        provenance: message.provenance,
        content: this.normalizeMessageContent(message),
      })),
    };

    try {
      const result = await this.runtimeStructuredJobService.runStructuredJob<{
        reportTldr?: string;
        overview?: string;
        overviewTldr?: string;
        participantSummaries?: Array<{
          speaker?: string;
          role?: string;
          summary?: string;
        }>;
        whoSaidWhatTldr?: string;
        discoveries?: string[];
        discoveriesTldr?: string;
        completedActions?: string[];
        completedActionsTldr?: string;
        outstandingWork?: string[];
        outstandingWorkTldr?: string;
        commitments?: Array<{ owner?: string; commitment?: string }>;
        commitmentsTldr?: string;
        risks?: string[];
        risksTldr?: string;
        nextSteps?: string[];
        nextStepsTldr?: string;
        timeline?: Array<{
          speaker?: string;
          timestamp?: string;
          summary?: string;
        }>;
        timelineTldr?: string;
      }>({
        workspaceId: thread.workspaceId,
        prompt: this.buildClaudeWrapUpPrompt(payload),
        schema: this.buildWrapUpSchema(),
        schemaName: "thread_wrap_up_report_v2",
        jobType: "thread_wrap_up_report",
        model,
        timeoutMs,
        preferredAgentIds: memberAgents.map((agent) => agent.id),
        metadata: {
          reportId,
          threadId: thread.id,
          threadSessionId: messages[0]?.threadSessionId ?? null,
          threadSessionSequenceNumber: sessionSequenceNumber,
          messageCount: messages.length,
        },
      });

      const structuredData = this.normalizeStructuredData(result.output);

      return {
        markdown: this.renderMarkdown(
          thread,
          messages.length,
          structuredData,
          sessionSequenceNumber,
        ),
        structuredData,
        model: result.model ?? model ?? `${result.runtimeType}-default`,
      };
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof GatewayTimeoutException
      ) {
        throw error;
      }

      const detail = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(
        `Runtime structured job failed to generate the chat wrap-up report: ${detail}`,
      );
    }
  }

  private normalizeMessageContent(message: MessageEntity) {
    const content = message.content?.trim();
    if (content) return content;
    if (message.type === "embedded_card") return "[Embedded card]";
    return `[${message.type || "message"}]`;
  }

  private normalizeStructuredData(
    payload: Record<string, unknown>,
  ): WrapUpStructuredData {
    const stringValue = (value: unknown, fallback: string) =>
      typeof value === "string" && value.trim() ? value.trim() : fallback;
    const listOfStrings = (value: unknown) =>
      Array.isArray(value)
        ? value
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter(Boolean)
        : [];

    const participantSummaries = Array.isArray(payload.participantSummaries)
      ? (payload.participantSummaries
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const speaker =
              typeof (entry as any).speaker === "string"
                ? (entry as any).speaker.trim()
                : "";
            const summary =
              typeof (entry as any).summary === "string"
                ? (entry as any).summary.trim()
                : "";
            const role =
              typeof (entry as any).role === "string"
                ? (entry as any).role.trim()
                : undefined;
            if (!speaker || !summary) return null;
            return { speaker, summary, role };
          })
          .filter(Boolean) as WrapUpParticipantSummary[])
      : [];

    const commitments = Array.isArray(payload.commitments)
      ? payload.commitments
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const owner =
              typeof (entry as any).owner === "string"
                ? (entry as any).owner.trim()
                : "";
            const commitment =
              typeof (entry as any).commitment === "string"
                ? (entry as any).commitment.trim()
                : "";
            if (!owner || !commitment) return null;
            return { owner, commitment };
          })
          .filter((entry): entry is WrapUpCommitment => Boolean(entry))
      : [];

    const timeline = Array.isArray(payload.timeline)
      ? (payload.timeline
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const speaker =
              typeof (entry as any).speaker === "string"
                ? (entry as any).speaker.trim()
                : "";
            const summary =
              typeof (entry as any).summary === "string"
                ? (entry as any).summary.trim()
                : "";
            const timestamp =
              typeof (entry as any).timestamp === "string"
                ? (entry as any).timestamp.trim()
                : undefined;
            if (!speaker || !summary) return null;
            return { speaker, summary, timestamp };
          })
          .filter(Boolean) as WrapUpTimelineItem[])
      : [];

    return {
      reportTldr: stringValue(
        payload.reportTldr,
        "The conversation was wrapped up and summarized.",
      ),
      overview: stringValue(
        payload.overview,
        "The conversation was wrapped up, but the model did not provide a high-level overview.",
      ),
      overviewTldr: stringValue(
        payload.overviewTldr,
        "No separate overview TLDR was provided.",
      ),
      participantSummaries,
      whoSaidWhatTldr: stringValue(
        payload.whoSaidWhatTldr,
        "No participant-specific TLDR was provided.",
      ),
      discoveries: listOfStrings(payload.discoveries),
      discoveriesTldr: stringValue(
        payload.discoveriesTldr,
        "No discoveries TLDR was provided.",
      ),
      completedActions: listOfStrings(payload.completedActions),
      completedActionsTldr: stringValue(
        payload.completedActionsTldr,
        "No completed-actions TLDR was provided.",
      ),
      outstandingWork: listOfStrings(payload.outstandingWork),
      outstandingWorkTldr: stringValue(
        payload.outstandingWorkTldr,
        "No outstanding-work TLDR was provided.",
      ),
      commitments,
      commitmentsTldr: stringValue(
        payload.commitmentsTldr,
        "No commitments TLDR was provided.",
      ),
      risks: listOfStrings(payload.risks),
      risksTldr: stringValue(
        payload.risksTldr,
        "No risks or blockers TLDR was provided.",
      ),
      nextSteps: listOfStrings(payload.nextSteps),
      nextStepsTldr: stringValue(
        payload.nextStepsTldr,
        "No next-steps TLDR was provided.",
      ),
      timeline,
      timelineTldr: stringValue(
        payload.timelineTldr,
        "No timeline TLDR was provided.",
      ),
    };
  }

  private buildWrapUpSchema() {
    return {
      type: "object",
      additionalProperties: false,
      required: [
        "reportTldr",
        "overview",
        "overviewTldr",
        "participantSummaries",
        "whoSaidWhatTldr",
        "discoveries",
        "discoveriesTldr",
        "completedActions",
        "completedActionsTldr",
        "outstandingWork",
        "outstandingWorkTldr",
        "commitments",
        "commitmentsTldr",
        "risks",
        "risksTldr",
        "nextSteps",
        "nextStepsTldr",
        "timeline",
        "timelineTldr",
      ],
      properties: {
        reportTldr: { type: "string" },
        overview: { type: "string" },
        overviewTldr: { type: "string" },
        participantSummaries: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["speaker", "role", "summary"],
            properties: {
              speaker: { type: "string" },
              role: { type: "string" },
              summary: { type: "string" },
            },
          },
        },
        whoSaidWhatTldr: { type: "string" },
        discoveries: { type: "array", items: { type: "string" } },
        discoveriesTldr: { type: "string" },
        completedActions: { type: "array", items: { type: "string" } },
        completedActionsTldr: { type: "string" },
        outstandingWork: { type: "array", items: { type: "string" } },
        outstandingWorkTldr: { type: "string" },
        commitments: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["owner", "commitment"],
            properties: {
              owner: { type: "string" },
              commitment: { type: "string" },
            },
          },
        },
        commitmentsTldr: { type: "string" },
        risks: { type: "array", items: { type: "string" } },
        risksTldr: { type: "string" },
        nextSteps: { type: "array", items: { type: "string" } },
        nextStepsTldr: { type: "string" },
        timeline: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["speaker", "timestamp", "summary"],
            properties: {
              speaker: { type: "string" },
              timestamp: { type: "string" },
              summary: { type: "string" },
            },
          },
        },
        timelineTldr: { type: "string" },
      },
    };
  }

  private buildClaudeWrapUpPrompt(payload: Record<string, unknown>) {
    return [
      "You create exact, evidence-based chat wrap-up reports.",
      "You are running as an internal ClawChat structured-report job through a connected OpenClaw or Hermes runtime agent.",
      "Read the full thread transcript and return only structured JSON that matches the provided schema.",
      "Do not invent work, decisions, discoveries, commitments, risks, or next steps.",
      "If something is uncertain, either omit it or phrase it cautiously in the overview.",
      "Summaries must identify who said what in plain English.",
      "Every TLDR field must be a concise one- or two-sentence summary grounded in the transcript.",
      "The reportTldr field summarizes the whole report. Each other *Tldr field summarizes its matching section only.",
      "Use ISO timestamps from the transcript when relevant in the timeline.",
      "",
      "Thread payload:",
      JSON.stringify(payload, null, 2),
    ].join("\n");
  }

  private renderMarkdown(
    thread: ThreadEntity,
    messageCount: number,
    report: WrapUpStructuredData,
    sessionSequenceNumber: number,
  ) {
    const reportKind = this.getReportKindLabel(thread);
    const sections = [
      `# ${thread.title} ${reportKind}`,
      "",
      `- Thread ID: \`${thread.id}\``,
      `- Conversation cycle: ${sessionSequenceNumber}`,
      `- Workspace ID: \`${thread.workspaceId}\``,
      `- Messages analyzed: ${messageCount}`,
      `- Generated at: ${new Date().toISOString()}`,
      "",
      "## TLDR",
      "",
      report.reportTldr,
      "",
      "## Overview",
      "",
      `**TLDR:** ${report.overviewTldr}`,
      "",
      report.overview,
      "",
      "## Who Said What",
      "",
      `**TLDR:** ${report.whoSaidWhatTldr}`,
      "",
      this.renderBullets(
        report.participantSummaries.map(
          (entry) =>
            `**${entry.speaker}**${entry.role ? ` (${entry.role})` : ""}: ${entry.summary}`,
        ),
        "No participant-specific summary was produced.",
      ),
      "",
      "## Discoveries",
      "",
      `**TLDR:** ${report.discoveriesTldr}`,
      "",
      this.renderBullets(
        report.discoveries,
        "No concrete discoveries were identified.",
      ),
      "",
      "## Completed Actions",
      "",
      `**TLDR:** ${report.completedActionsTldr}`,
      "",
      this.renderBullets(
        report.completedActions,
        "No completed actions were identified.",
      ),
      "",
      "## Outstanding Work",
      "",
      `**TLDR:** ${report.outstandingWorkTldr}`,
      "",
      this.renderBullets(
        report.outstandingWork,
        "No remaining work items were identified.",
      ),
      "",
      "## Forward Commitments",
      "",
      `**TLDR:** ${report.commitmentsTldr}`,
      "",
      this.renderBullets(
        report.commitments.map(
          (entry) => `**${entry.owner}**: ${entry.commitment}`,
        ),
        "No explicit forward commitments were identified.",
      ),
      "",
      "## Risks / Blockers",
      "",
      `**TLDR:** ${report.risksTldr}`,
      "",
      this.renderBullets(
        report.risks,
        "No explicit blockers or risks were identified.",
      ),
      "",
      "## Recommended Next Steps",
      "",
      `**TLDR:** ${report.nextStepsTldr}`,
      "",
      this.renderBullets(report.nextSteps, "No next steps were recommended."),
      "",
      "## Timeline",
      "",
      `**TLDR:** ${report.timelineTldr}`,
      "",
      this.renderBullets(
        report.timeline.map(
          (entry) =>
            `${entry.timestamp ? `\`${entry.timestamp}\` ` : ""}**${entry.speaker}**: ${entry.summary}`,
        ),
        "No timeline highlights were produced.",
      ),
      "",
    ];

    return sections.join("\n");
  }

  private getReportKindLabel(thread: ThreadEntity) {
    if (thread.type === "direct") return "Direct Chat Report";
    if (thread.type === "team") return "Team Chat Report";
    return "Chat Report";
  }

  private renderBullets(items: string[], emptyLabel: string) {
    if (!items.length) return emptyLabel;
    return items.map((item) => `- ${item}`).join("\n");
  }

  private buildFileName(title: string, sessionSequenceNumber: number) {
    const slug =
      title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "chat";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${slug}-chat-session-${sessionSequenceNumber}-report-${stamp}.md`;
  }
}
