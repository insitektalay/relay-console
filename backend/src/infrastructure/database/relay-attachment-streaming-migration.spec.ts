import { readFileSync } from "fs";
import { join } from "path";

describe("relay attachment streaming migration", () => {
  const source = readFileSync(
    join(__dirname, "../../migrations/072_stream_relay_attachment_content.ts"),
    "utf8",
  );

  it("adds complete claim state and a bounded versioned chunk object store", () => {
    expect(source).toContain('"uploadClaimToken" uuid');
    expect(source).toContain('"uploadClaimExpiresAt" timestamptz');
    expect(source).toContain('"uploadAttemptCount" integer NOT NULL DEFAULT 0');
    expect(source).toContain('"storageVersion" uuid');
    expect(source).toContain('"relay_sync_attachment_chunks"');
    expect(source).toContain("BETWEEN 1 AND 65536");
    expect(source).toContain('octet_length("content") = "byteLength"');
    expect(source).toContain("CHK_relay_sync_attachment_upload_claim");
    expect(source).toContain("IDX_relay_sync_attachment_stale_claim");
  });

  it("losslessly chunks legacy bytea before clearing the legacy column", () => {
    const insert = source.indexOf('INSERT INTO "relay_sync_attachment_chunks"');
    const clear = source.indexOf('"content" = NULL');
    expect(insert).toBeGreaterThan(-1);
    expect(clear).toBeGreaterThan(insert);
    expect(source).toContain("generate_series(");
    expect(source).toContain("FOR 65536");
    expect(source).toContain("string_agg(");
  });

  it("uses a TypeORM-compatible identity and has an explicit reverse path", () => {
    expect(source).toContain("StreamRelayAttachmentContent1785187000072");
    expect(source).toContain(
      'DROP TABLE IF EXISTS "relay_sync_attachment_chunks"',
    );
    expect(source).toContain('DROP COLUMN IF EXISTS "uploadClaimToken"');
  });
});
