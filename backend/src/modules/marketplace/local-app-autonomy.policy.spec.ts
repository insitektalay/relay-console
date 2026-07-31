import {
  applyApprovalRequiredCapabilitiesToLocalAppPolicy,
  defaultLocalAppAutonomyPolicy,
  hasBlanketNoExternalConflict,
  localAppAutonomySelectedCapabilities,
  localAppAutonomyRuntimeInstruction,
  mergeLocalAppAutonomyPolicies,
  renderLocalAppAutonomyPolicyMarkdown,
} from "./local-app-autonomy.policy";

describe("local app autonomy policy", () => {
  it("defaults trusted local apps to read,draft,write_internal", () => {
    expect(localAppAutonomySelectedCapabilities(defaultLocalAppAutonomyPolicy())).toEqual([
      "read",
      "draft",
      "write_internal",
    ]);
    expect(
      localAppAutonomySelectedCapabilities(
        defaultLocalAppAutonomyPolicy("internal_write"),
      ),
    ).toEqual(["read", "draft", "write_internal"]);
  });

  it("renders safe_default as external disabled or gated", () => {
    const markdown = renderLocalAppAutonomyPolicyMarkdown(
      defaultLocalAppAutonomyPolicy("safe_default"),
    );
    expect(markdown).toContain("CURRENT LOCAL APP AUTONOMY MODE: safe_default");
    expect(markdown).toContain("External actions are disabled or approval-required");
  });

  it("renders dangerously_skip_permissions without blanket no-external doctrine", () => {
    const markdown = renderLocalAppAutonomyPolicyMarkdown(
      defaultLocalAppAutonomyPolicy("dangerously_skip_permissions"),
    );
    expect(markdown).toContain(
      "CURRENT LOCAL APP AUTONOMY MODE: dangerously_skip_permissions",
    );
    expect(markdown).toContain("supersedes stale chat history");
    expect(markdown).toContain("External actions are allowed");
    expect(markdown.toLowerCase()).not.toContain("no outreach");
    expect(markdown.toLowerCase()).not.toContain("do not submit forms");
    expect(markdown.toLowerCase()).not.toContain("no external publishing");
  });

  it("detects stale scheduled blanket no-external text", () => {
    expect(
      hasBlanketNoExternalConflict(
        "Do not send outreach, submit forms, create accounts, publish externally, or mark anything contacted/submitted/live/indexed.",
      ),
    ).toBe(true);
  });

  it("includes local app runtime recovery doctrine in runtime instructions", () => {
    const instruction = localAppAutonomyRuntimeInstruction(
      defaultLocalAppAutonomyPolicy("internal_write"),
    );
    expect(instruction).toContain(
      "Local app unreachable triggers runtime recovery; do not treat it as a final task blocker.",
    );
    expect(instruction).toContain("localApp.ensureRunning");
  });

  it("upgrades exposed approval-gated side-effect capabilities without allowing autonomous publishing", () => {
    const policy = applyApprovalRequiredCapabilitiesToLocalAppPolicy(
      defaultLocalAppAutonomyPolicy("safe_default"),
      ["external_publish", "email_send"],
    );

    expect(policy.external.externalPublishing).toBe("approval_required");
    expect(policy.external.emailSend).toBe("approval_required");
    expect(policy.external.publicFormSubmit).toBe("disabled");

    const instruction = localAppAutonomyRuntimeInstruction(policy, {
      externalPublishing: true,
      emailSend: true,
    });
    expect(instruction).toContain("- externalPublishing: approval_required");
    expect(instruction).toContain("- emailSend: approval_required");
    expect(instruction).not.toContain("- externalPublishing: disabled");
  });

  it("merges multiple marketplace policies so approval-required tools are not hidden by another app", () => {
    const base = defaultLocalAppAutonomyPolicy("safe_default");
    const publishing = applyApprovalRequiredCapabilitiesToLocalAppPolicy(base, [
      "external_publish",
    ]);

    const merged = mergeLocalAppAutonomyPolicies([base, publishing]);

    expect(merged?.external.externalPublishing).toBe("approval_required");
    expect(merged?.external.emailSend).toBe("disabled");
  });
});
