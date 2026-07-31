interface RuntimeArtifactSource {
  id: string;
  createdAt: Date;
}

export interface RuntimeArtifactContract {
  rootPath: string;
  runDirectoryPath: string;
  cronDirectoryRootPath: string;
  pointerManifestSuffix: string;
}

export const RUNTIME_CRON_OUTPUT_MARKER =
  "[Relay Console cron artifact output]";
export const RUNTIME_CRON_OUTPUT_END_MARKER =
  "[End Relay Console cron artifact output]";

export function buildRuntimeArtifactContract(
  saved: RuntimeArtifactSource,
): RuntimeArtifactContract {
  const day = saved.createdAt.toISOString().slice(0, 10);
  const rootPath = ".clawchat/artifacts";
  return {
    rootPath,
    runDirectoryPath: `${rootPath}/runs/${day}/${saved.id}`,
    cronDirectoryRootPath: `${rootPath}/cron`,
    pointerManifestSuffix: ".artifact.json",
  };
}

export function withRuntimeArtifactContract(
  content: string,
  contract: RuntimeArtifactContract,
): string {
  return [
    "[Relay Console artifact contract]",
    `Write durable deliverables under: ${contract.runDirectoryPath}`,
    "Use that directory for documents, images, media, data exports and other user-facing work products.",
    `For external deliverables, write a ${contract.pointerManifestSuffix} JSON pointer with title, kind, external_url and provider. external_url must be an absolute HTTPS URL without embedded credentials.`,
    `For scheduled work, use the user's requested output location when it is accessible and permitted. Otherwise choose a maintained output directory under: ${contract.cronDirectoryRootPath}`,
    "If the user supplies a filename, preserve it and register its parent directory.",
    "Save this exact machine-readable block in the scheduled job instructions, replacing the placeholder with the chosen output directory:",
    RUNTIME_CRON_OUTPUT_MARKER,
    "Directory: <output directory>",
    RUNTIME_CRON_OUTPUT_END_MARKER,
    "Do not rename or omit that block. Read the job back when the scheduler supports it, and do not claim artifact registration if the block was not retained.",
    "Confirm the chosen location and repeated-run behavior to the user.",
    "For a registered local file, explain that its catalogue entry appears in Relay Console Artifacts on macOS, web and iOS after the source device synchronizes, while the bytes remain on that source device. Approved external HTTPS artifacts can be opened from all three platforms. If registration was not retained, explicitly say the file will not appear in Artifacts.",
    "[End Relay Console artifact contract]",
    "",
    content,
  ].join("\n");
}
