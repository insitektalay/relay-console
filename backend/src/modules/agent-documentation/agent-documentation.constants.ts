export const AGENT_DOCS_PACK_PATH = ".clawchat/agent-docs";
export const AGENT_DOCS_COMPILER_VERSION = "agent-docs-compiler-1.0.0";

export const PROPOSAL_FILE_CLASSIFICATIONS = [
  "generated_doctrine",
  "generated_app_capability_docs",
  "generated_workspace_router",
  "mutable_state",
  "user_override",
] as const;

export const REFRESH_POLICIES = [
  "regenerate_allowed",
  "install_only",
  "clawchat_state_export",
  "protected_user_override",
  "never_generate",
] as const;

export const COMPILER_MODES = [
  "generate_initial_pack",
  "refresh_from_blueprint",
  "refresh_from_repo",
  "review_existing_pack",
  "generate_agent_workspace_files",
  "refresh_agent_install",
] as const;

export const MUTABLE_PATH_PATTERNS = [
  "_state/",
  "memory/",
  "MEMORY.md",
  "history_log.md",
  "task_list.md",
  "approvals",
  "current-state",
  "current_packet",
];

export const LIBRARY_INSTALL_PREFIX = "library/";
export const WORKSPACE_FILES_PREFIX = "workspace_files/";
