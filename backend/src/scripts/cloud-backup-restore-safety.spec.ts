import { readFileSync } from "fs";
import { join } from "path";
import { runCloudRestore } from "./cloud-restore";

const required = {
  BACKUP_ENCRYPTION_PASSPHRASE: "rehearsal-only-passphrase",
  BACKUP_DOWNLOAD_URL: "https://object.example.test/backup",
  RESTORE_CONFIRM_DEPLOYMENT_ID: "deployment-under-test",
  CLAWCHAT_DEPLOYMENT_ID: "deployment-under-test",
};

describe("cloud backup/restore safety boundary", () => {
  it("refuses to label a remote database as an isolated restore target", async () => {
    await expect(
      runCloudRestore({
        ...required,
        RESTORE_DATABASE_URL:
          "postgresql://user:password@database.example.test/relay",
        RESTORE_TARGET_KIND: "isolated",
      }),
    ).rejects.toThrow("ISOLATED_RESTORE_REQUIRES_LOOPBACK_DATABASE");
  });

  it("requires a second explicit replacement confirmation for a production target", async () => {
    await expect(
      runCloudRestore({
        ...required,
        RESTORE_DATABASE_URL:
          "postgresql://user:password@database.example.test/relay",
        RESTORE_TARGET_KIND: "confirmed-production",
      }),
    ).rejects.toThrow(
      "RESTORE_TARGET_KIND_AND_REPLACEMENT_CONFIRMATION_REQUIRED",
    );
  });

  it("keeps the restore transactional and the isolated-target preflight ahead of download", () => {
    const source = readFileSync(join(__dirname, "cloud-restore.ts"), "utf8");
    expect(source).toContain('"--single-transaction"');
    expect(source).toContain('"--exit-on-error"');
    expect(
      source.indexOf("assertIsolatedTargetEmpty(databaseUrl)"),
    ).toBeLessThan(source.indexOf("fetch(downloadUrl)"));
  });

  it("supports a non-overwriting encrypted export with checksum evidence", () => {
    const source = readFileSync(join(__dirname, "cloud-backup.ts"), "utf8");
    expect(source).toContain(
      "Set exactly one of BACKUP_UPLOAD_URL or BACKUP_OUTPUT_PATH",
    );
    expect(source).toContain("BACKUP_OUTPUT_PATH must be absolute");
    expect(source).toContain(
      'writeFile(dump, Buffer.alloc(0), { mode: 0o600, flag: "wx" })',
    );
    expect(source.indexOf("writeFile(dump")).toBeLessThan(
      source.indexOf('command("pg_dump"'),
    );
    expect(source).toContain("constants.COPYFILE_EXCL");
    expect(source).toContain("await chmod(outputPath, 0o600)");
    expect(source).toContain('createHash("sha256")');
    expect(source).toContain("backupId: sha256");
    expect(source).toContain("buildVerifiedLibpqConnection");
    expect(source).not.toContain("dump,\n      databaseUrl");
  });

  it("verifies a local encrypted export before decryption or restore", () => {
    const source = readFileSync(join(__dirname, "cloud-restore.ts"), "utf8");
    expect(source).toContain(
      "Set exactly one of BACKUP_DOWNLOAD_URL or BACKUP_INPUT_PATH",
    );
    expect(source).toContain("BACKUP_INPUT_PATH must be absolute");
    expect(source).toContain(
      "BACKUP_EXPECTED_SHA256 is required for a local encrypted export",
    );
    expect(source).toContain("BACKUP_SHA256_MISMATCH");
    expect(source.indexOf("BACKUP_SHA256_MISMATCH")).toBeLessThan(
      source.indexOf('"pg_restore"'),
    );
    expect(source).toContain(
      'environment.RESTORE_TARGET_KIND === "confirmed-production"',
    );
    expect(source).toContain("buildVerifiedLibpqConnection");
  });
});
