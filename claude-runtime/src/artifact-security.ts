export const EXTERNAL_ARTIFACT_URL_BLOCKED_REASON =
  "External artifact link blocked because it does not use an approved HTTPS URL.";

const MAX_EXTERNAL_ARTIFACT_URL_LENGTH = 2_000;
const DISALLOWED_URL_CHARACTERS =
  /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;

export function isExternalArtifactPointerFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith(".artifact.json") ||
    lower.endsWith(".relay-artifact.json")
  );
}

export function normalizeExternalArtifactUrl(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_EXTERNAL_ARTIFACT_URL_LENGTH ||
    value !== value.trim() ||
    !/^https:\/\//iu.test(value) ||
    value.includes("\\") ||
    DISALLOWED_URL_CHARACTERS.test(value)
  ) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
