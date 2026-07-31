import {
  RUNTIME_CRON_OUTPUT_END_MARKER,
  RUNTIME_CRON_OUTPUT_MARKER,
  buildRuntimeArtifactContract,
  withRuntimeArtifactContract,
} from "./runtime-artifact-contract";

describe("runtime artifact contract", () => {
  it("preserves user-selected cron locations and discloses cross-platform availability", () => {
    const contract = buildRuntimeArtifactContract({
      id: "message-1",
      createdAt: new Date("2026-07-29T12:00:00.000Z"),
    });
    const prompt = withRuntimeArtifactContract(
      "Create a scheduled report.",
      contract,
    );

    expect(prompt).toContain("use the user's requested output location");
    expect(prompt).toContain(RUNTIME_CRON_OUTPUT_MARKER);
    expect(prompt).toContain("Directory: <output directory>");
    expect(prompt).toContain(RUNTIME_CRON_OUTPUT_END_MARKER);
    expect(prompt).toContain("macOS, web and iOS");
    expect(prompt).toContain("bytes remain on that source device");
    expect(prompt).toContain("file will not appear in Artifacts");
    expect(prompt).toContain("Create a scheduled report.");
  });
});
