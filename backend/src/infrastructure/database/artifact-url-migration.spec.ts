import { QuarantineUnsafeArtifactUrls1785187000074 } from "../../migrations/074_quarantine_unsafe_artifact_urls";

describe("external artifact URL quarantine migration", () => {
  it("scrubs current objects and change history without retaining raw URLs", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new QuarantineUnsafeArtifactUrls1785187000074();

    await migration.up({ query } as any);

    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(migration.name).toBe(
      "QuarantineUnsafeArtifactUrls1785187000074",
    );
    expect(sql).toContain(`UPDATE "relay_sync_objects"`);
    expect(sql).toContain(`UPDATE "relay_workspace_changes"`);
    expect(sql).toContain(`"payload" - 'externalUrl'`);
    expect(sql).toContain(`!~* '^https://'`);
    expect(sql).toContain(`~* '^https://[^/?#]*@'`);
    expect(sql).toContain(`'"unavailable"'::jsonb`);
  });

  it("never attempts to restore discarded unsafe URLs", async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new QuarantineUnsafeArtifactUrls1785187000074();

    await migration.down({ query } as any);

    expect(query).not.toHaveBeenCalled();
  });
});
