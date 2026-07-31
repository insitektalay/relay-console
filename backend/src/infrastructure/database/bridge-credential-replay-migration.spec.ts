import { readFileSync } from "fs";
import { join } from "path";

describe("bridge credential replay migration", () => {
  const source = readFileSync(
    join(
      __dirname,
      "../../migrations/070_add_bridge_credential_replay_state.ts",
    ),
    "utf8",
  );

  it("adds a bounded previous-generation replay marker with a consistency check", () => {
    expect(source).toContain('"previousCredentialHash"');
    expect(source).toContain('"previousCredentialVersion"');
    expect(source).toContain('"previousCredentialConsumedAt"');
    expect(source).toContain("CHK_bridge_previous_credential_state");
    expect(source).toContain("^[0-9a-f]{64}$");
  });

  it("has an explicit reverse migration", () => {
    expect(source).toContain("AddBridgeCredentialReplayState1785185000070");
    expect(source).toContain(
      'DROP CONSTRAINT IF EXISTS "CHK_bridge_previous_credential_state"',
    );
    expect(source).toContain('DROP COLUMN IF EXISTS "previousCredentialHash"');
  });
});
