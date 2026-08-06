const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildClaudeStructuredPromptArgs,
  buildCodexExecArgs,
  isRuntimeCommandRiskAccepted,
  parseClaudeStructuredOutput,
} = require("../dist/claude-cli");

test("parses Relay team publication tool calls separately from the ordinary final", () => {
  const result = parseClaudeStructuredOutput(
    JSON.stringify({
      structured_output: {
        status: "completed",
        final_reply_markdown: "hidden final",
        tool_calls: [
          {
            name: "relay_publish_message",
            call_id: "call-1",
            arguments: {
              content: "Visible update",
              mentions: [{ agentId: "agent-2" }],
            },
          },
        ],
      },
    }),
  );
  assert.equal(result.final_reply_markdown, "hidden final");
  assert.deepEqual(result.tool_calls, [
    {
      name: "relay_publish_message",
      call_id: "call-1",
      arguments: {
        content: "Visible update",
        mentions: [{ agentId: "agent-2" }],
      },
    },
  ]);
});

const acceptedRisk = {
  dangerousBypassAccepted: true,
  acceptedBy: "beta-owner@example.com",
  acceptedAt: "2026-06-21T08:00:00.000Z",
  reason: "Private beta runtime owner accepted local repo command bypass risk.",
};

test("Codex structured prompts default to sandboxed approval mode", () => {
  const args = buildCodexExecArgs({
    baseArgs: [],
    repoPath: "/repo",
    schemaPath: "/tmp/schema.json",
    prompt: "Summarize this repo.",
  });

  assert.equal(args[args.indexOf("--sandbox") + 1], "workspace-write");
  assert.equal(args[args.indexOf("--ask-for-approval") + 1], "on-request");
  assert.equal(args.includes("danger-full-access"), false);
  assert.equal(args.includes("never"), false);
});

test("Codex dangerous sandbox and approval bypass require risk acceptance", () => {
  assert.throws(
    () =>
      buildCodexExecArgs({
        baseArgs: [
          "exec",
          "--sandbox",
          "danger-full-access",
          "--ask-for-approval",
          "never",
        ],
        repoPath: "/repo",
        schemaPath: "/tmp/schema.json",
        prompt: "Run.",
      }),
    /runtimeCommandRiskAcceptance/,
  );

  const args = buildCodexExecArgs({
    baseArgs: [
      "exec",
      "--sandbox",
      "danger-full-access",
      "--ask-for-approval",
      "never",
    ],
    repoPath: "/repo",
    schemaPath: "/tmp/schema.json",
    prompt: "Run.",
    runtimeCommandRiskAcceptance: acceptedRisk,
  });

  assert.equal(args[args.indexOf("--sandbox") + 1], "danger-full-access");
  assert.equal(args[args.indexOf("--ask-for-approval") + 1], "never");
});

test("Claude structured prompts omit permission bypass unless risk accepted", () => {
  const args = buildClaudeStructuredPromptArgs({
    baseArgs: ["@anthropic-ai/claude-code"],
    requiresArgSeparator: true,
    prompt: "Summarize this repo.",
    sessionId: "session-1",
    schema: { type: "object" },
    repoPath: "/repo",
  });

  assert.equal(args.includes("--dangerously-skip-permissions"), false);
});

test("Claude dangerous permission bypass requires risk acceptance", () => {
  assert.throws(
    () =>
      buildClaudeStructuredPromptArgs({
        baseArgs: ["--dangerously-skip-permissions"],
        requiresArgSeparator: false,
        prompt: "Run.",
        sessionId: "session-1",
        schema: { type: "object" },
        repoPath: "/repo",
      }),
    /runtimeCommandRiskAcceptance/,
  );

  const args = buildClaudeStructuredPromptArgs({
    baseArgs: [],
    requiresArgSeparator: false,
    prompt: "Run.",
    sessionId: "session-1",
    schema: { type: "object" },
    repoPath: "/repo",
    runtimeCommandRiskAcceptance: acceptedRisk,
  });

  assert.equal(args.includes("--dangerously-skip-permissions"), true);
});

test("risk acceptance requires a complete documented record", () => {
  assert.equal(isRuntimeCommandRiskAccepted(undefined), false);
  assert.equal(
    isRuntimeCommandRiskAccepted({
      dangerousBypassAccepted: true,
      acceptedBy: "owner@example.com",
      acceptedAt: "not-a-date",
      reason: "accepted",
    }),
    false,
  );
  assert.equal(isRuntimeCommandRiskAccepted(acceptedRisk), true);
});
