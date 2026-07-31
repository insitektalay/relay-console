import * as crypto from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RuntimeStructuredJobService } from "../runtime/runtime-structured-job.service";
import {
  CONDENSED_MESSAGE_PROVIDER,
  inferCondensedLineCountHint,
  sanitizeCondensedMessageText,
  type CondensedMessageMetadata,
} from "./message-condensed.types";

@Injectable()
export class MessageStructuredSummaryService {
  constructor(
    private readonly configService: ConfigService,
    private readonly runtimeStructuredJobService: RuntimeStructuredJobService,
  ) {}

  async condenseMessage(input: {
    workspaceId: string;
    threadId: string;
    messageId: string;
    threadTitle: string | null;
    senderName: string;
    content: string;
  }): Promise<CondensedMessageMetadata> {
    const timeoutMs = Number(
      this.configService.get<string>(
        "CONDENSED_SUMMARY_STRUCTURED_JOB_TIMEOUT_MS",
      ) ??
        this.configService.get<string>("STRUCTURED_JOBS_TIMEOUT_MS") ??
        "90000",
    );
    const model =
      this.configService.get<string>("CONDENSED_SUMMARY_STRUCTURED_JOB_MODEL") ||
      this.configService.get<string>("STRUCTURED_JOBS_DEFAULT_MODEL") ||
      null;

    const response = await this.runtimeStructuredJobService.runStructuredJob<{
      text: string;
      lineCountHint: 1 | 2;
    }>({
      workspaceId: input.workspaceId,
      jobType: "condensed_team_chat_message",
      prompt: this.buildPrompt(input),
      schema: this.buildSchema(),
      schemaName: "condensed_team_chat_message_v1",
      model,
      timeoutMs,
      metadata: {
        threadId: input.threadId,
        messageId: input.messageId,
        threadTitle: input.threadTitle,
        senderName: input.senderName,
      },
    });

    const text = sanitizeCondensedMessageText(response.output.text ?? "");
    if (!text) {
      const error = new Error("Runtime structured job returned an empty condensed summary");
      (error as Error & { code?: string }).code = "malformed_output";
      throw error;
    }

    return {
      text,
      lineCountHint:
        response.output.lineCountHint === 2
          ? 2
          : response.output.lineCountHint === 1
            ? 1
            : inferCondensedLineCountHint(text),
      generatedAt: new Date().toISOString(),
      provider: CONDENSED_MESSAGE_PROVIDER,
      sourceContentHash: this.hashContent(input.content),
    };
  }

  hashContent(content: string) {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private buildPrompt(input: {
    threadId: string;
    messageId: string;
    threadTitle: string | null;
    senderName: string;
    content: string;
  }) {
    return [
      "You are condensing a single final agent-authored team chat message for a dense chat UI.",
      "Return a short, factual summary of what the message says.",
      "Do not invent information, do not editorialize, and do not add commentary.",
      "Prefer one line. Two lines are allowed only when necessary.",
      "Strip markdown, bullet formatting, and code-fence noise from the final text.",
      "The condensed text must be UI-ready plain text.",
      "Return only structured JSON that matches the provided schema.",
      "",
      "Thread context:",
      JSON.stringify(
        {
          threadId: input.threadId,
          threadTitle: input.threadTitle,
          messageId: input.messageId,
          senderName: input.senderName,
        },
        null,
        2,
      ),
      "",
      "Canonical full message:",
      input.content,
    ].join("\n");
  }

  private buildSchema() {
    return {
      type: "object",
      additionalProperties: false,
      required: ["text", "lineCountHint"],
      properties: {
        text: {
          type: "string",
          description:
            "Short plain-text condensed summary suitable for a dense chat list.",
        },
        lineCountHint: {
          type: "integer",
          enum: [1, 2],
        },
      },
    };
  }
}
