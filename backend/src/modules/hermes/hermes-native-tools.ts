export const HERMES_NATIVE_BASE_HARNESS_TOOLS = [
  "memory",
  "session_search",
  "read_file",
  "write_file",
  "patch",
  "terminal",
  "skills_list",
  "skill_view",
  "skill_manage",
  "workspace",
  "cwd",
] as const;

export function filterDisabledHermesNativeTools(disabledToolsets: string[]) {
  const disabled = new Set(disabledToolsets);
  return HERMES_NATIVE_BASE_HARNESS_TOOLS.filter((toolName) => !disabled.has(toolName));
}
