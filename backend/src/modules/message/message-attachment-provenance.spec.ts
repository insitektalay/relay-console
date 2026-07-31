import {
  OpenClawAttachmentProvenanceInput,
  signOpenClawAttachmentProvenance,
  verifyOpenClawAttachmentProvenance,
} from "./message-attachment-provenance";

const attachment: OpenClawAttachmentProvenanceInput = {
  id: "attachment-1",
  workspaceId: "ws-1",
  threadId: "thread-1",
  bridgeDeviceId: "device-1",
  filename: "brief.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1234,
  sha256: "hash-1",
  kind: "document",
  storage: "openclaw_local",
  localMediaRef: "openclaw://device-1/attachment-1",
  createdAt: "2026-06-20T19:00:00.000Z",
};

const now = new Date("2026-06-20T20:00:00.000Z");
const provenanceSecret = "attachment-provenance-production-secret-2026-alpha";

describe("OpenClaw attachment provenance", () => {
  it("signs and verifies with the dedicated attachment provenance secret", () => {
    const token = signOpenClawAttachmentProvenance(
      attachment,
      {
        ATTACHMENT_PROVENANCE_SECRET: provenanceSecret,
      },
      now,
    );

    expect(
      verifyOpenClawAttachmentProvenance(
        attachment,
        token,
        {
          ATTACHMENT_PROVENANCE_SECRET: provenanceSecret,
        },
        now,
      ),
    ).toBe(true);
    expect(
      verifyOpenClawAttachmentProvenance(
        attachment,
        token,
        {
          ATTACHMENT_PROVENANCE_SECRET:
            "attachment-provenance-production-secret-2026-bravo",
        },
        now,
      ),
    ).toBe(false);
  });

  it("does not fall back to JWT or encryption secrets", () => {
    const token = signOpenClawAttachmentProvenance(
      attachment,
      {
        ATTACHMENT_PROVENANCE_SECRET: provenanceSecret,
        JWT_SECRET: "jwt-access-production-secret-2026-alpha",
        ENCRYPTION_KEY: "legacy-encryption-production-secret-2026",
      },
      now,
    );

    expect(
      verifyOpenClawAttachmentProvenance(
        attachment,
        token,
        {
          JWT_SECRET: provenanceSecret,
          ENCRYPTION_KEY: provenanceSecret,
        },
        now,
      ),
    ).toBe(false);
  });

  it("requires a dedicated provenance secret in production-like environments", () => {
    expect(() =>
      signOpenClawAttachmentProvenance(
        attachment,
        {
          NODE_ENV: "production",
        },
        now,
      ),
    ).toThrow(/ATTACHMENT_PROVENANCE_SECRET/);

    expect(() =>
      verifyOpenClawAttachmentProvenance(
        attachment,
        "payload.signature",
        {
          RAILWAY_ENVIRONMENT_NAME: "production",
        },
        now,
      ),
    ).toThrow(/ATTACHMENT_PROVENANCE_SECRET/);
  });
});
