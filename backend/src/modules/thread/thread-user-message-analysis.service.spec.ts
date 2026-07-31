import { ThreadUserMessageAnalysisService } from "./thread-user-message-analysis.service";

describe("ThreadUserMessageAnalysisService", () => {
  it("falls back to heuristic analysis when bridge-backed Claude CLI is unavailable", async () => {
    const service = new ThreadUserMessageAnalysisService();

    const result = await service.analyze({
      thread: {
        id: "thread-1",
        title: "PageJourney Guys",
        type: "team",
        workspaceId: "ws-1",
      } as any,
      activityGapMinutes: 30,
      sessions: [
        {
          threadSessionId: "session-1",
          sequenceNumber: 1,
          status: "wrapped_up",
          firstMessageAt: "2026-04-16T10:00:00.000Z",
          lastMessageAt: "2026-04-16T10:30:00.000Z",
          requestingUserMessageCount: 3,
          messagesAfterLongSilenceCount: 1,
          messagesAfterAgentSilenceCount: 1,
          medianMinutesSincePreviousMessage: 18,
          medianMinutesSincePreviousAgentMessage: 2,
          messages: [
            {
              id: "m1",
              createdAt: "2026-04-16T10:05:00.000Z",
              content: "What's the current status here?",
              minutesSincePreviousMessage: 35,
              minutesSincePreviousAgentMessage: 35,
              minutesSincePreviousOwnMessage: null,
              agentMessagesSincePreviousOwnMessage: 2,
              occurredAfterLongSilence: true,
              occurredAfterAgentSilence: true,
            },
            {
              id: "m2",
              createdAt: "2026-04-16T10:12:00.000Z",
              content: "Can you summarise the blockers?",
              minutesSincePreviousMessage: 7,
              minutesSincePreviousAgentMessage: 2,
              minutesSincePreviousOwnMessage: 7,
              agentMessagesSincePreviousOwnMessage: 1,
              occurredAfterLongSilence: false,
              occurredAfterAgentSilence: false,
            },
            {
              id: "m3",
              createdAt: "2026-04-16T10:20:00.000Z",
              content: "Keep going and prioritise the fix.",
              minutesSincePreviousMessage: 8,
              minutesSincePreviousAgentMessage: 1,
              minutesSincePreviousOwnMessage: 8,
              agentMessagesSincePreviousOwnMessage: 1,
              occurredAfterLongSilence: false,
              occurredAfterAgentSilence: false,
            },
          ],
        },
      ],
    });

    const analysis = result.get("session-1");
    expect(analysis).toEqual(
      expect.objectContaining({
        status: "ready",
        errorMessage: null,
      }),
    );
    expect(analysis?.summary).toContain("3 user messages");
    expect(analysis?.timingInterpretation).toContain("30+ minutes");
    expect(analysis?.dominantIntentLabels).toEqual(
      expect.arrayContaining([
        "Status checks",
        "Recap requests",
        "Blocker triage",
      ]),
    );
    expect(analysis?.silencePromptShare).toBeGreaterThan(0);
  });
});
