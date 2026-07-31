interface RuntimeAttachmentSource {
  filename?: unknown;
  mimeType?: unknown;
  kind?: unknown;
  status?: unknown;
  localMediaRef?: unknown;
}

export const RUNTIME_ATTACHMENTS_MARKER = "[Relay Console attachments]";
export const RUNTIME_ATTACHMENTS_END_MARKER = "[End Relay Console attachments]";

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function withRuntimeAttachmentContext(
  content: string,
  attachments: unknown,
): string {
  if (!Array.isArray(attachments)) {
    return content;
  }

  const readable = attachments.flatMap((value, index) => {
    if (!value || typeof value !== "object") {
      return [];
    }
    const attachment = value as RuntimeAttachmentSource;
    const localMediaRef = nonEmptyString(attachment.localMediaRef);
    const status = nonEmptyString(attachment.status);
    if (
      !localMediaRef ||
      (status !== null && status !== "attached" && status !== "uploaded")
    ) {
      return [];
    }

    return [
      {
        filename:
          nonEmptyString(attachment.filename) ?? `attachment-${index + 1}`,
        mimeType:
          nonEmptyString(attachment.mimeType) ??
          nonEmptyString(attachment.kind) ??
          "application/octet-stream",
        localMediaRef,
      },
    ];
  });

  if (!readable.length) {
    return content;
  }

  return [
    RUNTIME_ATTACHMENTS_MARKER,
    `The user attached ${readable.length === 1 ? "this file" : "these files"} to the message.`,
    "Treat each localMediaRef as runtime-local media input. Inspect the attached file when the request depends on it; do not say that no file was attached without first attempting to resolve the reference.",
    ...readable.map(
      (attachment, index) =>
        `${index + 1}. ${attachment.filename} (${attachment.mimeType}) — localMediaRef: ${attachment.localMediaRef}`,
    ),
    RUNTIME_ATTACHMENTS_END_MARKER,
    "",
    content,
  ].join("\n");
}
