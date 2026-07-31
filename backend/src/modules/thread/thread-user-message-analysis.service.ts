import { Injectable } from "@nestjs/common";
import { ThreadEntity } from "../../entities/thread.entity";

type SessionMessageEntry = {
  id: string;
  createdAt: string;
  content: string;
  minutesSincePreviousMessage: number | null;
  minutesSincePreviousAgentMessage: number | null;
  minutesSincePreviousOwnMessage: number | null;
  agentMessagesSincePreviousOwnMessage: number;
  occurredAfterLongSilence: boolean;
  occurredAfterAgentSilence: boolean;
};

type SessionAnalysisInput = {
  threadSessionId: string;
  sequenceNumber: number | null;
  status: string | null;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  requestingUserMessageCount: number;
  messagesAfterLongSilenceCount: number;
  messagesAfterAgentSilenceCount: number;
  medianMinutesSincePreviousMessage: number | null;
  medianMinutesSincePreviousAgentMessage: number | null;
  messages: SessionMessageEntry[];
};

type SessionAnalysisResult = {
  status: "ready" | "failed";
  summary: string | null;
  timingInterpretation: string | null;
  repeatedPatterns: string[];
  oneOffIssues: string[];
  dominantIntentLabels: string[];
  repeatedInstructionShare: number | null;
  oneOffIssueShare: number | null;
  silencePromptShare: number | null;
  clusters: Array<{
    label: string;
    description: string;
    messageCount: number;
    exampleMessages: string[];
  }>;
  errorMessage: string | null;
};

@Injectable()
export class ThreadUserMessageAnalysisService {
  async analyze(input: {
    thread: ThreadEntity;
    activityGapMinutes: number;
    sessions: SessionAnalysisInput[];
  }): Promise<Map<string, SessionAnalysisResult>> {
    const sessionsToAnalyze = input.sessions.filter(
      (session) => session.requestingUserMessageCount > 0,
    );

    if (!sessionsToAnalyze.length) {
      return new Map();
    }
    return this.analyzeHeuristically(
      sessionsToAnalyze,
      input.activityGapMinutes,
    );
  }

  private analyzeHeuristically(
    sessions: SessionAnalysisInput[],
    activityGapMinutes: number,
  ) {
    return new Map(
      sessions.map((session) => [
        session.threadSessionId,
        buildHeuristicSessionAnalysis(session, activityGapMinutes),
      ]),
    );
  }

}

function normalizeShare(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return Math.max(0, Math.min(1, value));
}

type HeuristicIntentBucket =
  | "status_check"
  | "action_steering"
  | "blocker_triage"
  | "clarification"
  | "recap_request"
  | "decision"
  | "social_checkin"
  | "other";

const HEURISTIC_INTENT_META: Record<
  HeuristicIntentBucket,
  {
    label: string;
    description: string;
    clusterDescription: string;
    repeatable: boolean;
    oneOffIssue: boolean;
  }
> = {
  status_check: {
    label: "Status checks",
    description: "Checks current progress or asks for the latest state.",
    clusterDescription:
      "Messages focused on checking progress, asking for updates, or asking where work stands.",
    repeatable: true,
    oneOffIssue: false,
  },
  action_steering: {
    label: "Action steering",
    description: "Directs the next step or nudges the team toward execution.",
    clusterDescription:
      "Messages that redirect work, set priorities, or tell the team what to do next.",
    repeatable: true,
    oneOffIssue: false,
  },
  blocker_triage: {
    label: "Blocker triage",
    description: "Raises a concrete issue, risk, failure, or blocker.",
    clusterDescription:
      "Messages centered on debugging, blockers, errors, risks, or a specific broken item.",
    repeatable: false,
    oneOffIssue: true,
  },
  clarification: {
    label: "Clarifications",
    description: "Asks why something happened or requests explanation.",
    clusterDescription:
      "Messages asking for explanation, clarification, or more detail before proceeding.",
    repeatable: false,
    oneOffIssue: false,
  },
  recap_request: {
    label: "Recap requests",
    description: "Asks for a summary, recap, or synthesis of the current state.",
    clusterDescription:
      "Messages asking for summaries, recaps, or condensed context to reorient the discussion.",
    repeatable: true,
    oneOffIssue: false,
  },
  decision: {
    label: "Decisions and approvals",
    description: "Approves, declines, or chooses a path forward.",
    clusterDescription:
      "Messages making a decision, giving approval, or choosing between options.",
    repeatable: false,
    oneOffIssue: false,
  },
  social_checkin: {
    label: "Check-ins",
    description: "Short prompts to restart or re-engage the conversation.",
    clusterDescription:
      "Brief prompts that reopen the conversation or ask for a simple check-in.",
    repeatable: true,
    oneOffIssue: false,
  },
  other: {
    label: "General prompts",
    description: "General user prompts that do not fit a stronger category.",
    clusterDescription:
      "General-purpose prompts that keep work moving without a narrower recurring pattern.",
    repeatable: false,
    oneOffIssue: false,
  },
};

function buildHeuristicSessionAnalysis(
  session: SessionAnalysisInput,
  activityGapMinutes: number,
): SessionAnalysisResult {
  const classifiedMessages = session.messages.map((message) => ({
    message,
    bucket: classifyHeuristicIntent(message.content),
  }));
  const bucketCounts = new Map<HeuristicIntentBucket, number>();

  for (const entry of classifiedMessages) {
    bucketCounts.set(entry.bucket, (bucketCounts.get(entry.bucket) ?? 0) + 1);
  }

  const dominantBuckets = [...bucketCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([bucket]) => bucket);

  const dominantIntentLabels = dominantBuckets.map(
    (bucket) => HEURISTIC_INTENT_META[bucket].label,
  );

  const repeatedInstructionCount = classifiedMessages.filter(
    ({ bucket }) => HEURISTIC_INTENT_META[bucket].repeatable,
  ).length;
  const oneOffIssueCount = classifiedMessages.filter(
    ({ bucket }) => HEURISTIC_INTENT_META[bucket].oneOffIssue,
  ).length;
  const silencePromptCount = classifiedMessages.filter(
    ({ message }) =>
      message.occurredAfterLongSilence || message.occurredAfterAgentSilence,
  ).length;
  const totalMessages = Math.max(1, session.messages.length);

  const repeatedPatterns = [...bucketCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([bucket, count]) => {
      const meta = HEURISTIC_INTENT_META[bucket];
      return `${meta.label} appeared ${count} times`;
    });

  const oneOffIssues = classifiedMessages
    .filter(({ bucket }) => HEURISTIC_INTENT_META[bucket].oneOffIssue)
    .slice(0, 3)
    .map(({ message }) => truncateForAnalysis(message.content));

  const clusters = dominantBuckets
    .map((bucket) => {
      const examples = classifiedMessages
        .filter((entry) => entry.bucket === bucket)
        .slice(0, 3)
        .map((entry) => truncateForAnalysis(entry.message.content));
      const messageCount = bucketCounts.get(bucket) ?? 0;
      if (!messageCount) {
        return null;
      }
      return {
        label: HEURISTIC_INTENT_META[bucket].label,
        description: HEURISTIC_INTENT_META[bucket].clusterDescription,
        messageCount,
        exampleMessages: examples,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        label: string;
        description: string;
        messageCount: number;
        exampleMessages: string[];
      } => Boolean(entry),
    );

  return {
    status: "ready",
    summary: buildHeuristicSummary(
      session,
      dominantBuckets,
      repeatedInstructionCount,
      oneOffIssueCount,
      silencePromptCount,
    ),
    timingInterpretation: buildHeuristicTimingInterpretation(
      session,
      activityGapMinutes,
      silencePromptCount,
    ),
    repeatedPatterns,
    oneOffIssues,
    dominantIntentLabels,
    repeatedInstructionShare: normalizeShare(repeatedInstructionCount / totalMessages),
    oneOffIssueShare: normalizeShare(oneOffIssueCount / totalMessages),
    silencePromptShare: normalizeShare(silencePromptCount / totalMessages),
    clusters,
    errorMessage: null,
  };
}

function buildHeuristicSummary(
  session: SessionAnalysisInput,
  dominantBuckets: HeuristicIntentBucket[],
  repeatedInstructionCount: number,
  oneOffIssueCount: number,
  silencePromptCount: number,
) {
  const lead = dominantBuckets.length
    ? dominantBuckets
        .slice(0, 2)
        .map((bucket) => HEURISTIC_INTENT_META[bucket].label.toLowerCase())
        .join(" and ")
    : "general prompts";

  const details: string[] = [];
  if (repeatedInstructionCount > 0) {
    details.push(`${repeatedInstructionCount} repeatable prompts`);
  }
  if (oneOffIssueCount > 0) {
    details.push(`${oneOffIssueCount} issue-focused messages`);
  }
  if (silencePromptCount > 0) {
    details.push(`${silencePromptCount} silence-driven interventions`);
  }

  const suffix = details.length ? ` It included ${details.join(", ")}.` : "";
  return `This session was mostly ${lead} across ${session.requestingUserMessageCount} user messages.${suffix}`;
}

function buildHeuristicTimingInterpretation(
  session: SessionAnalysisInput,
  activityGapMinutes: number,
  silencePromptCount: number,
) {
  if (
    silencePromptCount > 0 &&
    (session.messagesAfterLongSilenceCount > 0 ||
      session.messagesAfterAgentSilenceCount > 0)
  ) {
    return `Several interventions landed after gaps of roughly ${activityGapMinutes}+ minutes, which suggests you were stepping back in when work appeared stalled or quiet.`;
  }

  if (
    session.medianMinutesSincePreviousAgentMessage !== null &&
    session.medianMinutesSincePreviousAgentMessage <= Math.max(3, activityGapMinutes / 6)
  ) {
    return "Your messages were closely interleaved with agent replies, which looks more like active steering inside a live exchange than delayed re-entry.";
  }

  if (session.medianMinutesSincePreviousMessage !== null) {
    return `Your interventions were spaced out with a median gap of about ${formatMinutesForAnalysis(session.medianMinutesSincePreviousMessage)}, which suggests periodic check-ins rather than constant back-and-forth.`;
  }

  return "Timing data is limited for this session, but the message mix still points to a clear intervention pattern.";
}

function classifyHeuristicIntent(content: string): HeuristicIntentBucket {
  const value = content.trim().toLowerCase();
  if (!value) {
    return "other";
  }

  if (
    /\b(blocked|blocker|error|failing|failed|broken|issue|problem|bug|fix|debug|investigate|root cause|why did)\b/.test(
      value,
    )
  ) {
    return "blocker_triage";
  }

  if (
    /\b(summary|summarise|summarize|recap|tldr|condense|brief me|catch me up)\b/.test(
      value,
    )
  ) {
    return "recap_request";
  }

  if (
    /\b(approve|approved|go ahead|ship it|deploy|let's do|lets do|choose|decision|i want)\b/.test(
      value,
    )
  ) {
    return "decision";
  }

  if (
    /\b(update|status|progress|current state|where are we|how's|how is|latest|what's the state|whats the state|check in)\b/.test(
      value,
    )
  ) {
    return "status_check";
  }

  if (
    /\b(can you|please|keep going|focus on|prioritise|prioritize|make sure|need you to|do this|handle|continue|push|send|rewrite|change|review)\b/.test(
      value,
    )
  ) {
    return "action_steering";
  }

  if (
    /\b(why|what do you mean|clarify|explain|how exactly|can you explain)\b/.test(
      value,
    )
  ) {
    return "clarification";
  }

  if (/^(hi|hello|hey|yo|anyone there|ping)\b/.test(value)) {
    return "social_checkin";
  }

  return "other";
}

function truncateForAnalysis(value: string, maxLength = 96) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function formatMinutesForAnalysis(value: number) {
  if (value < 60) {
    return `${Math.round(value)} minutes`;
  }
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  if (!minutes) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${hours}h ${minutes}m`;
}
