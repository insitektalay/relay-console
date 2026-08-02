import type {
  Agent,
  AgentOpsLiveStateSnapshot,
  AgentOpsRuntimeOverviewSnapshot,
  AgentWorkCalendar,
  AgentProvisioningJob,
  AgentPerformanceMetric,
  ApiEnvelope,
  Alert,
  Approval,
  ApprovalActionInput,
  AvailabilityState,
  CapacityEntry,
  CapacitySuggestion,
  Company,
  CreateAgentInput,
  CreateCompanyInput,
  CreateConnectionInput,
  CreateDepartmentInput,
  CreateIncidentInput,
  CreateMessageInput,
  CreatePermissionPolicyInput,
  CreateProvisionedAgentInput,
  CreateTaskInput,
  CreateTeamInput,
  CreateTeamMemoryItemInput,
  CreateThreadInput,
  CreateWorkspaceInput,
  Department,
  DeleteLibraryFileInput,
  DeleteLibraryFolderInput,
  LibraryDeleteFolderResult,
  DepartmentDashboard,
  HandoverNote,
  HermesWorkspaceCreateFolderInput,
  HermesWorkspaceDeleteFileInput,
  HermesWorkspaceFolder,
  HermesWorkspaceWriteFilesInput,
  Incident,
  LibraryDeleteResult,
  LibraryListResult,
  LibraryReadResult,
  LibraryWriteResult,
  LogoutResult,
  Message,
  OpenClawConnection,
  OpenClawIntegrationStatus,
  Paginated,
  PaperclipConnection,
  PaperclipConnectionTestResult,
  PutThreadPaperclipLinkInput,
  ThreadPaperclipLinkView,
  CreatePaperclipConnectionInput,
  UpdatePaperclipConnectionInput,
  PermissionPolicy,
  ReportSnapshot,
  RequestEmailChangeInput,
  ResolveIncidentInput,
  Review,
  Run,
  RunEvent,
  RuntimeRunContextPayload,
  RuntimeDispatchCancelResult,
  Schedule,
  SetAgentStatusInput,
  Task,
  TaskStatus,
  Team,
  TeamDashboard,
  TeamMemoryItem,
  ThreadAnalytics,
  Thread,
  ThreadWrapUpReport,
  ThreadWrapUpResult,
  UpdateTaskInput,
  UpdateSessionUserInput,
  UpdateAgentScheduleInput,
  UpdateWorkspaceInput,
  WriteLibraryFilesInput,
  WebSession,
  Workspace,
  WorkspaceArtifact,
  WorkspaceArtifactListResult,
  WsTicket,
  WorkLog,
  OrgChart,
  BridgeDevice,
  BridgeEnrollment,
  AgentDocumentationInstall,
  ApplicationDocumentationPack,
  BeginOpenClawAttachmentUploadInput,
  BeginOpenClawAttachmentUploadResult,
  CreateLinkedApplicationInput,
  CreateLocalMarketplaceAppInput,
  MarketplaceLocalRepoSourceHost,
  UpdateLocalMarketplaceAppInput,
  CompleteOpenClawAttachmentUploadInput,
  DocumentationBlueprint,
  DocumentationGenerationProposal,
  GenerateDocumentationProposalInput,
  LinkedApplication,
  MarketplaceCatalog,
  MarketplaceApp,
  MarketplaceConnection,
  MarketplaceAgentDocsRefreshResult,
  MarketplaceDocumentationHistory,
  MarketplaceLocalRepoDocsProposalApplyInput,
  MarketplaceLocalRepoDocsProposalApplyResult,
  MarketplaceLocalRepoDocsStatus,
  MarketplaceInstallResult,
  MarketplaceInstall,
  MarketplaceInstallRole,
  StartXMarketplaceOAuthInput,
  StartXMarketplaceOAuthResult,
  StartMarketplaceConnectorOAuthInput,
  StartMarketplaceConnectorOAuthResult,
  MarketplaceGeneratedPackDetail,
  MarketplaceGeneratedPackSummary,
  MarketplacePackCoverageReport,
  MarketplacePackPreview,
  MarketplaceRuntimeFormat,
  XMarketplaceOAuthConfig,
  MarketplaceConnectorHealth,
  MarketplaceConnectorOAuthConfig,
  MobileSessionSummary,
  SecurityMetrics,
  MessageAttachment,
  UploadOpenClawAttachmentChunkInput,
  UploadOpenClawAttachmentChunkResult,
  UpdateLinkedApplicationInput,
  WebSessionSummary,
  RelayDeploymentCapabilities,
  RelayWorkspaceChangePage,
  RelayMutationOutcome,
  RelayEntitlements,
  RelaySignedDocument,
  RuntimeAuthoritySnapshot,
  RuntimeObservation,
  RuntimeProvisioningTarget,
  ActivateReviewedRuntimeObservationRequest,
  RuntimeReconciliationReport,
  ManagedRuntime,
  RuntimeMigration,
  RuntimeMigrationManifest,
  RelayRemediationOperation,
  RelayRemediationManifest,
} from "@clawchat/contracts";

export interface WebSdkOptions {
  apiBaseUrl: string;
}

export type WorkspaceMembershipRole = "owner" | "admin" | "member" | "viewer";
export type WorkspaceDetail = Workspace & {
  stats?: Record<string, unknown>;
  membershipRole?: WorkspaceMembershipRole;
};

export interface TeamRelayState {
  threadId: string;
  threadSessionId: string;
  runState: "running" | "paused";
  pauseReason: "manual" | "reply_limit" | null;
  replyLimit: number;
  replyCount: number;
}

export interface PairedHostOperationResult {
  requestId: string;
  acknowledged: boolean;
  [key: string]: unknown;
}

export interface NativeCronJob {
  id: string;
  name: string;
  enabled: boolean;
  status?: string | null;
  schedule?: unknown;
  payload?: Record<string, unknown> | null;
  state?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface NativeCronJobsResult {
  requestId?: string;
  runtimeType: "openclaw" | "hermes" | "mixed";
  jobs: NativeCronJob[];
  scheduler?: {
    available?: boolean;
    running?: boolean;
    message?: string;
  } | null;
  refreshing?: boolean;
}

type RequestInitWithRetry = RequestInit & {
  skipRefresh?: boolean;
  timeoutMs?: number | null;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

export class ClawChatApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly body: unknown = null,
  ) {
    super(message);
    this.name = "ClawChatApiError";
  }
}

export type ClawChatNetworkErrorKind = "network" | "timeout";

export class ClawChatNetworkError extends Error {
  constructor(
    message: string,
    readonly path: string,
    readonly kind: ClawChatNetworkErrorKind,
    readonly timeoutMs: number | null = null,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ClawChatNetworkError";
  }
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function withQuery(
  path: string,
  params: Record<string, string | number | boolean | null | undefined>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export class ClawChatWebSdk {
  private readonly apiBaseUrl: string;
  private browserRefreshPromise: Promise<WebSession> | null = null;

  constructor(options: WebSdkOptions) {
    this.apiBaseUrl = trimTrailingSlash(options.apiBaseUrl);
  }

  auth = {
    csrf: async () => {
      const existing = getCookie("clawchat_web_csrf");
      if (existing) return { csrfToken: existing };
      return this.request<{ csrfToken: string }>("/auth/csrf", {
        method: "GET",
        skipRefresh: true,
      });
    },
    session: async () => {
      try {
        return await this.request<WebSession>("/auth/session", {
          method: "GET",
        });
      } catch (error) {
        if (
          !(error instanceof ClawChatApiError) ||
          (error.status !== 401 && error.status !== 403)
        ) {
          throw error;
        }

        await this.auth.refresh();
        return this.request<WebSession>("/auth/session", {
          method: "GET",
          skipRefresh: true,
        });
      }
    },
    updateProfile: (input: UpdateSessionUserInput) =>
      this.request<WebSession["user"]>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    requestEmailChange: (input: RequestEmailChangeInput) =>
      this.request<{ success: boolean; message: string }>(
        "/auth/email-change/request",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    completeEmailChange: (token: string) =>
      this.request<{ success: boolean; message: string }>(
        "/auth/email-change/complete",
        {
          method: "POST",
          body: JSON.stringify({ token }),
          skipRefresh: true,
        },
      ),
    register: async (
      name: string,
      email: string,
      password: string,
      inviteCode?: string,
    ) =>
      this.request<WebSession>("/auth/web/register", {
        method: "POST",
        headers: await this.browserCsrfHeaders(),
        body: JSON.stringify({ name, email, password, inviteCode }),
        skipRefresh: true,
      }),
    requestPasswordReset: (email: string) =>
      this.request<{ success: boolean; message: string }>(
        "/auth/password-reset/request",
        {
          method: "POST",
          body: JSON.stringify({ email }),
          skipRefresh: true,
        },
      ),
    completePasswordReset: (token: string, newPassword: string) =>
      this.request<{ success: boolean; message: string }>(
        "/auth/password-reset/complete",
        {
          method: "POST",
          body: JSON.stringify({ token, newPassword }),
          skipRefresh: true,
        },
      ),
    verifyEmail: (token: string) =>
      this.request<{ success: boolean; message: string }>(
        "/auth/email-verification/complete",
        {
          method: "POST",
          body: JSON.stringify({ token }),
          skipRefresh: true,
        },
      ),
    resendEmailVerification: () =>
      this.request<{ success: boolean }>("/auth/email-verification/resend", {
        method: "POST",
      }),
    login: async (email: string, password: string) => {
      return this.request<WebSession>("/auth/web/login", {
        method: "POST",
        headers: await this.browserCsrfHeaders(),
        body: JSON.stringify({ email, password }),
        skipRefresh: true,
      });
    },
    refresh: async () => this.refreshBrowserSession(),
    changePassword: (currentPassword: string, newPassword: string) =>
      this.request<void>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    logout: async () => {
      try {
        return await this.request<LogoutResult>("/auth/web/logout", {
          method: "POST",
          skipRefresh: true,
        });
      } catch (error) {
        if (!(error instanceof ClawChatApiError) || error.status !== 401) {
          throw error;
        }

        try {
          await this.auth.refresh();
          return await this.request<LogoutResult>("/auth/web/logout", {
            method: "POST",
            skipRefresh: true,
          });
        } catch (refreshOrLogoutError) {
          if (
            refreshOrLogoutError instanceof ClawChatApiError &&
            refreshOrLogoutError.status === 401
          ) {
            return { success: true };
          }
          throw refreshOrLogoutError;
        }
      }
    },
    wsTicket: (workspaceId: string) =>
      this.request<WsTicket>("/auth/ws-ticket", {
        method: "POST",
        body: JSON.stringify({ workspaceId }),
      }),
    sessions: () =>
      this.request<WebSessionSummary[]>("/auth/web/sessions", {
        method: "GET",
      }),
    mobileSessions: () =>
      this.request<MobileSessionSummary[]>("/auth/sessions", {
        method: "GET",
      }),
    revokeSession: (sessionId: string) =>
      this.request<{ success: boolean; sessionId: string }>(
        `/auth/web/sessions/${sessionId}/revoke`,
        {
          method: "POST",
        },
      ),
    revokeMobileSession: (sessionId: string) =>
      this.request<{ success: boolean; sessionId: string | null }>(
        `/auth/sessions/${sessionId}`,
        {
          method: "DELETE",
        },
      ),
    revokeAllSessions: () =>
      this.request<{ success: boolean; revokedSessionIds: string[] }>(
        "/auth/web/sessions/revoke-all",
        {
          method: "POST",
        },
      ),
    revokeAllMobileSessions: () =>
      this.request<{ success: boolean; revokedSessionIds: string[] }>(
        "/auth/sessions",
        {
          method: "DELETE",
        },
      ),
    accessToken: () => null,
    exportAccount: () =>
      this.request<Record<string, unknown>>("/auth/account/export", {
        method: "GET",
      }),
    deleteAccount: (currentPassword: string, confirmation: string) =>
      this.request<{ success: boolean; message: string }>("/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ currentPassword, confirmation }),
      }),
  };

  workspaces = {
    list: () =>
      this.request<Paginated<Workspace>>("/workspaces", { method: "GET" }),
    create: (input: CreateWorkspaceInput) =>
      this.request<Workspace>("/workspaces", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    detail: (workspaceId: string) =>
      this.request<WorkspaceDetail>(`/workspaces/${workspaceId}`, {
        method: "GET",
      }),
    openClawIntegrationStatus: (workspaceId: string) =>
      this.request<OpenClawIntegrationStatus>(
        `/workspaces/${workspaceId}/integrations/openclaw/status`,
        {
          method: "GET",
        },
      ),
    update: (workspaceId: string, input: UpdateWorkspaceInput) =>
      this.request<Workspace>(`/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    stats: (workspaceId: string) =>
      this.request<Record<string, unknown>>(
        `/workspaces/${workspaceId}/stats`,
        { method: "GET" },
      ),
    artifactsList: (workspaceId: string) =>
      this.request<WorkspaceArtifactListResult>(
        `/workspaces/${workspaceId}/artifacts`,
        { method: "GET" },
      ),
    artifactDetail: (workspaceId: string, artifactId: string) =>
      this.request<WorkspaceArtifact>(
        `/workspaces/${workspaceId}/artifacts/${encodeURIComponent(artifactId)}`,
        { method: "GET" },
      ),
    runtimeAuthority: (workspaceId: string) =>
      this.request<RuntimeAuthoritySnapshot>(
        `/workspaces/${workspaceId}/runtime-authority`,
        { method: "GET" },
      ),
    runtimeProvisioningTargets: (workspaceId: string) =>
      this.request<RuntimeProvisioningTarget[]>(
        `/workspaces/${workspaceId}/runtime-authority/provisioning-targets`,
        { method: "GET" },
      ),
    selectRuntimeProvisioningTarget: (
      workspaceId: string,
      runtimeType: "hermes" | "openclaw",
      runtimeHostId: string,
    ) =>
      this.request<RuntimeProvisioningTarget>(
        `/workspaces/${workspaceId}/runtime-authority/provisioning-targets/${runtimeType}`,
        {
          method: "PATCH",
          body: JSON.stringify({ runtimeHostId }),
        },
      ),
    scanRuntimeHost: (workspaceId: string, runtimeHostId: string) =>
      this.request<{
        requested: boolean;
        runtimeHostId: string;
        requestedAt?: string;
        code?: string;
      }>(
        `/workspaces/${workspaceId}/runtime-authority/hosts/${encodeURIComponent(runtimeHostId)}/scan`,
        { method: "POST" },
      ),
    reconcileRuntimeAuthority: (
      workspaceId: string,
      input: { apply?: boolean; expectedChecksum?: string } = {},
    ) =>
      this.request<RuntimeReconciliationReport | Record<string, unknown>>(
        `/workspaces/${workspaceId}/runtime-authority/reconcile`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    activateReviewedRuntimeObservation: (
      workspaceId: string,
      observationId: string,
      input: ActivateReviewedRuntimeObservationRequest,
    ) =>
      this.request<RuntimeAuthoritySnapshot["observations"][number]>(
        `/workspaces/${workspaceId}/runtime-authority/observations/${encodeURIComponent(observationId)}/activate`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    linkRelayConnectAgent: (
      workspaceId: string,
      agentId: string,
      input: {
        installationId: string;
        runtimeType: string;
        externalAgentId: string;
        adapterKind: string;
        displayName?: string | null;
      },
    ) =>
      this.request<Record<string, unknown>>(
        `/workspaces/${workspaceId}/runtime-authority/connect/${agentId}/link`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    unlinkRelayConnectAgent: (workspaceId: string, agentId: string) =>
      this.request<Record<string, unknown>>(
        `/workspaces/${workspaceId}/runtime-authority/connect/${agentId}/unlink`,
        { method: "POST" },
      ),
    managedRuntimes: (workspaceId: string) =>
      this.request<ManagedRuntime[]>(
        `/workspaces/${workspaceId}/runtime-authority/managed-runtimes`,
        { method: "GET" },
      ),
    runtimeMigrations: (workspaceId: string) =>
      this.request<RuntimeMigration[]>(
        `/workspaces/${workspaceId}/runtime-authority/migrations`,
        { method: "GET" },
      ),
    createManagedRuntime: (
      workspaceId: string,
      input: {
        operationKey: string;
        displayName: string;
        region?: string | null;
        runtimeType?: "hermes";
      },
    ) =>
      this.request<ManagedRuntime>(
        `/workspaces/${workspaceId}/runtime-authority/managed-runtimes`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    provisionManagedRuntime: (workspaceId: string, runtimeId: string) =>
      this.request<ManagedRuntime>(
        `/workspaces/${workspaceId}/runtime-authority/managed-runtimes/${runtimeId}/provision`,
        { method: "POST" },
      ),
    authorizeManagedRuntimeModel: (
      workspaceId: string,
      runtimeId: string,
      input: {
        authorized: boolean;
        provider?: "anthropic" | "openai";
        credential?: string;
      },
    ) =>
      this.request<ManagedRuntime>(
        `/workspaces/${workspaceId}/runtime-authority/managed-runtimes/${runtimeId}/model-authorization`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    refreshManagedRuntimeHealth: (workspaceId: string, runtimeId: string) =>
      this.request<{
        runtime: ManagedRuntime;
        health: Record<string, unknown>;
      }>(
        `/workspaces/${workspaceId}/runtime-authority/managed-runtimes/${runtimeId}/refresh-health`,
        { method: "POST" },
      ),
    attachManagedRuntimeAgent: (
      workspaceId: string,
      runtimeId: string,
      agentId: string,
    ) =>
      this.request<Record<string, unknown>>(
        `/workspaces/${workspaceId}/runtime-authority/managed-runtimes/${runtimeId}/attach-agent`,
        { method: "POST", body: JSON.stringify({ agentId }) },
      ),
    suspendManagedRuntime: (workspaceId: string, runtimeId: string) =>
      this.request<ManagedRuntime>(
        `/workspaces/${workspaceId}/runtime-authority/managed-runtimes/${runtimeId}/suspend`,
        { method: "POST" },
      ),
    resumeManagedRuntime: (workspaceId: string, runtimeId: string) =>
      this.request<ManagedRuntime>(
        `/workspaces/${workspaceId}/runtime-authority/managed-runtimes/${runtimeId}/resume`,
        { method: "POST" },
      ),
    cancelManagedRuntime: (workspaceId: string, runtimeId: string) =>
      this.request<ManagedRuntime>(
        `/workspaces/${workspaceId}/runtime-authority/managed-runtimes/${runtimeId}/cancel`,
        { method: "POST" },
      ),
    createRuntimeMigration: (
      workspaceId: string,
      input: {
        agentId: string;
        operationKey: string;
        sourceRuntimeHostId: string;
        destinationRuntimeHostId: string;
        runtimeType: "hermes" | "openclaw";
      },
    ) =>
      this.request<RuntimeMigration>(
        `/workspaces/${workspaceId}/runtime-authority/migrations`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    advanceRuntimeMigration: (
      workspaceId: string,
      migrationId: string,
      input: {
        expectedStatus: string;
        manifest?: RuntimeMigrationManifest;
        validationChecks?: Array<{
          name: string;
          passed: boolean;
          detail?: string;
        }>;
        credentialsReauthorized?: boolean;
        destinationExternalAgentId?: string;
        adapterKind?: string;
      },
    ) =>
      this.request<RuntimeMigration>(
        `/workspaces/${workspaceId}/runtime-authority/migrations/${migrationId}/advance`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    rollbackRuntimeMigration: (workspaceId: string, migrationId: string) =>
      this.request<RuntimeMigration>(
        `/workspaces/${workspaceId}/runtime-authority/migrations/${migrationId}/rollback`,
        { method: "POST" },
      ),
    remediationOperation: (workspaceId: string, operationKey: string) =>
      this.request<RelayRemediationOperation>(
        `/workspaces/${workspaceId}/runtime-authority/remediation/${encodeURIComponent(operationKey)}`,
        { method: "GET" },
      ),
    inventoryRemediation: (
      workspaceId: string,
      input: {
        operationKey: string;
        backupReference?: string | null;
        swiftInventory?: RelayRemediationManifest["swiftInventory"];
      },
    ) =>
      this.request<Record<string, unknown>>(
        `/workspaces/${workspaceId}/runtime-authority/remediation/inventory`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    dryRunRemediation: (
      workspaceId: string,
      input: {
        operationKey: string;
        manifest: RelayRemediationManifest;
        expectedInventoryChecksum: string;
        expectedCounts: Record<string, number>;
      },
    ) =>
      this.request<Record<string, unknown>>(
        `/workspaces/${workspaceId}/runtime-authority/remediation/dry-run`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    applyRemediation: (
      workspaceId: string,
      input: {
        operationKey: string;
        expectedInventoryChecksum: string;
        expectedDryRunChecksum: string;
        backupReference: string;
      },
    ) =>
      this.request<Record<string, unknown>>(
        `/workspaces/${workspaceId}/runtime-authority/remediation/apply`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    libraryList: (workspaceId: string, folder: string = "") =>
      this.request<LibraryListResult>(
        withQuery(`/workspaces/${workspaceId}/library/list`, { folder }),
        { method: "GET" },
      ),
    libraryReadFile: (workspaceId: string, folder: string, filename: string) =>
      this.request<LibraryReadResult>(
        withQuery(`/workspaces/${workspaceId}/library/file`, {
          folder,
          filename,
        }),
        { method: "GET" },
      ),
    libraryCreateFolder: (workspaceId: string, folder: string) =>
      this.request<LibraryWriteResult>(
        `/workspaces/${workspaceId}/library/folders`,
        {
          method: "POST",
          body: JSON.stringify({ folder }),
        },
      ),
    libraryWriteFiles: (workspaceId: string, input: WriteLibraryFilesInput) =>
      this.request<LibraryWriteResult>(
        `/workspaces/${workspaceId}/library/files`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    libraryDeleteFile: (workspaceId: string, input: DeleteLibraryFileInput) =>
      this.request<LibraryDeleteResult>(
        `/workspaces/${workspaceId}/library/file/delete`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    libraryDeleteFolder: (
      workspaceId: string,
      input: DeleteLibraryFolderInput,
    ) =>
      this.request<LibraryDeleteFolderResult>(
        `/workspaces/${workspaceId}/library/folder/delete`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    agentWorkspaceList: (
      workspaceId: string,
      agentId: string,
      folder: string = "",
    ) =>
      this.request<LibraryListResult>(
        withQuery(`/workspaces/${workspaceId}/openclaw/agent-workspace/list`, {
          agentId,
          folder,
        }),
        { method: "GET" },
      ),
    agentWorkspaceReadFile: (
      workspaceId: string,
      agentId: string,
      folder: string,
      filename: string,
    ) =>
      this.request<LibraryReadResult>(
        withQuery(`/workspaces/${workspaceId}/openclaw/agent-workspace/file`, {
          agentId,
          folder,
          filename,
        }),
        { method: "GET" },
      ),
    agentWorkspaceCreateFolder: (
      workspaceId: string,
      agentId: string,
      folder: string,
    ) =>
      this.request<LibraryWriteResult>(
        `/workspaces/${workspaceId}/openclaw/agent-workspace/folders`,
        {
          method: "POST",
          body: JSON.stringify({ agentId, folder }),
        },
      ),
    agentWorkspaceWriteFiles: (
      workspaceId: string,
      agentId: string,
      input: WriteLibraryFilesInput,
    ) =>
      this.request<LibraryWriteResult>(
        `/workspaces/${workspaceId}/openclaw/agent-workspace/files`,
        {
          method: "POST",
          body: JSON.stringify({ agentId, ...input }),
        },
      ),
    agentWorkspaceDeleteFile: (
      workspaceId: string,
      agentId: string,
      input: DeleteLibraryFileInput,
    ) =>
      this.request<LibraryDeleteResult>(
        `/workspaces/${workspaceId}/openclaw/agent-workspace/file/delete`,
        {
          method: "POST",
          body: JSON.stringify({ agentId, ...input }),
        },
      ),
    agentWorkspaceDeleteFolder: (
      workspaceId: string,
      agentId: string,
      input: DeleteLibraryFolderInput,
    ) =>
      this.request<LibraryDeleteFolderResult>(
        `/workspaces/${workspaceId}/openclaw/agent-workspace/folder/delete`,
        {
          method: "POST",
          body: JSON.stringify({ agentId, ...input }),
        },
      ),
    hermesWorkspaceList: (
      workspaceId: string,
      agentId: string,
      folder: HermesWorkspaceFolder,
      path: string = "/",
    ) =>
      this.request<LibraryListResult>(
        withQuery(`/workspaces/${workspaceId}/hermes/agent-workspace/list`, {
          agentId,
          folder,
          path,
        }),
        { method: "GET" },
      ),
    hermesWorkspaceReadFile: (
      workspaceId: string,
      agentId: string,
      folder: HermesWorkspaceFolder,
      path: string,
      filename: string,
    ) =>
      this.request<LibraryReadResult>(
        withQuery(`/workspaces/${workspaceId}/hermes/agent-workspace/file`, {
          agentId,
          folder,
          path,
          filename,
        }),
        { method: "GET" },
      ),
    hermesWorkspaceCreateFolder: (
      workspaceId: string,
      input: HermesWorkspaceCreateFolderInput,
    ) =>
      this.request<LibraryWriteResult>(
        `/workspaces/${workspaceId}/hermes/agent-workspace/folders`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    hermesWorkspaceWriteFiles: (
      workspaceId: string,
      input: HermesWorkspaceWriteFilesInput,
    ) =>
      this.request<LibraryWriteResult>(
        `/workspaces/${workspaceId}/hermes/agent-workspace/files`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    hermesWorkspaceDeleteFile: (
      workspaceId: string,
      input: HermesWorkspaceDeleteFileInput,
    ) =>
      this.request<LibraryDeleteResult>(
        `/workspaces/${workspaceId}/hermes/agent-workspace/file/delete`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    agentWorkCalendar: (
      workspaceId: string,
      params: {
        startDate: string;
        endDate: string;
        groupType?: string;
        activityGapMinutes?: number;
        timeZone?: string;
      },
    ) =>
      this.request<AgentWorkCalendar>(
        withQuery(`/workspaces/${workspaceId}/agent-work-calendar`, params),
        { method: "GET" },
      ),
  };

  threads = {
    list: (workspaceId: string, page: number = 1, pageSize: number = 20) =>
      this.request<Paginated<Thread>>(
        withQuery(`/workspaces/${workspaceId}/threads`, { page, pageSize }),
        { method: "GET", timeoutMs: 30_000 },
      ),
    search: (
      workspaceId: string,
      q: string,
      page: number = 1,
      pageSize: number = 20,
    ) =>
      this.request<Paginated<Thread>>(
        withQuery(`/threads/search`, { workspaceId, q, page, pageSize }),
        { method: "GET", timeoutMs: 30_000 },
      ),
    detail: (threadId: string) =>
      this.request<Thread>(`/threads/${threadId}`, {
        method: "GET",
        timeoutMs: 15_000,
      }),
    analytics: (
      threadId: string,
      activityGapMinutes: number = 30,
      options?: {
        agentRepeatSessionId?: string | null;
      },
    ) =>
      this.request<ThreadAnalytics>(
        withQuery(`/threads/${threadId}/analytics`, {
          activityGapMinutes,
          agentRepeatSessionId: options?.agentRepeatSessionId ?? null,
        }),
        { method: "GET", timeoutMs: 180000 },
      ),
    create: (workspaceId: string, input: CreateThreadInput) =>
      this.request<Thread>(`/workspaces/${workspaceId}/threads`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (
      threadId: string,
      input: {
        title?: string;
        isPinned?: boolean;
        isMuted?: boolean;
        agentIds?: string[];
        avatarUrl?: string;
      },
    ) =>
      this.request<Thread>(`/threads/${threadId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    archive: (threadId: string) =>
      this.request<Thread>(`/threads/${threadId}/archive`, { method: "POST" }),
    markRead: (threadId: string) =>
      this.request<{ success: boolean }>(`/threads/${threadId}/read`, {
        method: "POST",
      }),
    participants: (threadId: string) =>
      this.request<{ participantIds: string[]; agentIds: string[] }>(
        `/threads/${threadId}/participants`,
        { method: "GET" },
      ),
    runtimeContextUsage: (threadId: string) =>
      this.request<RuntimeRunContextPayload[]>(
        `/threads/${threadId}/runtime-context-usage`,
        { method: "GET" },
      ),
    wrapUpReport: (threadId: string) =>
      this.request<ThreadWrapUpReport>(`/threads/${threadId}/wrap-up-report`, {
        method: "GET",
      }),
    wrapUp: (threadId: string) =>
      this.request<ThreadWrapUpResult>(`/threads/${threadId}/wrap-up`, {
        method: "POST",
        timeoutMs: 180000,
      }),
  };

  agentOps = {
    liveState: (workspaceId: string, agentIds: string[]) =>
      this.request<AgentOpsLiveStateSnapshot>(
        withQuery(`/workspaces/${workspaceId}/agent-ops/live-state`, {
          agentIds: agentIds.join(","),
        }),
        { method: "GET", timeoutMs: 15_000 },
      ),
    runtimeOverview: (
      workspaceId: string,
      options?: {
        dispatchLimit?: number;
        sessionLimit?: number;
        windowHours?: number;
      },
    ) =>
      this.request<AgentOpsRuntimeOverviewSnapshot>(
        withQuery(`/workspaces/${workspaceId}/agent-ops/runtime-overview`, {
          dispatchLimit: options?.dispatchLimit,
          sessionLimit: options?.sessionLimit,
          windowHours: options?.windowHours,
        }),
        { method: "GET", timeoutMs: 15_000 },
      ),
  };

  runtimeDispatches = {
    cancel: (dispatchId: string) =>
      this.request<RuntimeDispatchCancelResult>(
        `/dispatches/${dispatchId}/cancel`,
        {
          method: "POST",
        },
      ),
  };

  paperclip = {
    connections: (workspaceId: string) =>
      this.request<PaperclipConnection[]>(
        `/workspaces/${workspaceId}/paperclip/connections`,
        { method: "GET" },
      ),
    createConnection: (
      workspaceId: string,
      input: CreatePaperclipConnectionInput,
    ) =>
      this.request<PaperclipConnection>(
        `/workspaces/${workspaceId}/paperclip/connections`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    updateConnection: (
      workspaceId: string,
      connectionId: string,
      input: UpdatePaperclipConnectionInput,
    ) =>
      this.request<PaperclipConnection>(
        `/workspaces/${workspaceId}/paperclip/connections/${connectionId}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      ),
    testConnection: (workspaceId: string, connectionId: string) =>
      this.request<PaperclipConnectionTestResult>(
        `/workspaces/${workspaceId}/paperclip/connections/${connectionId}/test`,
        {
          method: "POST",
        },
      ),
    threadLink: (threadId: string) =>
      this.request<ThreadPaperclipLinkView>(
        `/threads/${threadId}/paperclip-link`,
        {
          method: "GET",
          timeoutMs: 10_000,
        },
      ),
    putThreadLink: (threadId: string, input: PutThreadPaperclipLinkInput) =>
      this.request<ThreadPaperclipLinkView>(
        `/threads/${threadId}/paperclip-link`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
      ),
    deleteThreadLink: (threadId: string) =>
      this.request<{ success: boolean }>(
        `/threads/${threadId}/paperclip-link`,
        {
          method: "DELETE",
        },
      ),
  };

  messages = {
    list: (
      threadId: string,
      page: number = 1,
      pageSize: number = 50,
      threadSessionId?: string,
      before?: string,
    ) =>
      this.request<Paginated<Message>>(
        withQuery(`/threads/${threadId}/messages`, {
          page,
          pageSize,
          threadSessionId,
          before,
        }),
        { method: "GET" },
      ),
    latest: (threadId: string, limit: number = 50, before?: string) =>
      this.request<Message[]>(
        withQuery(`/threads/${threadId}/messages/latest`, {
          limit,
          before,
        }),
        { method: "GET", timeoutMs: 15_000 },
      ),
    create: (threadId: string, input: CreateMessageInput) =>
      this.request<Message>(`/threads/${threadId}/messages`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    teamRelay: (threadId: string) =>
      this.request<TeamRelayState>(`/threads/${threadId}/team-relay`, {
        method: "GET",
      }),
    pauseTeamRelay: (threadId: string) =>
      this.request<TeamRelayState>(`/threads/${threadId}/team-relay/pause`, {
        method: "POST",
      }),
    continueTeamRelay: (threadId: string) =>
      this.request<TeamRelayState>(`/threads/${threadId}/team-relay/continue`, {
        method: "POST",
      }),
    updateTeamRelay: (threadId: string, replyLimit: number) =>
      this.request<TeamRelayState>(`/threads/${threadId}/team-relay`, {
        method: "PATCH",
        body: JSON.stringify({ replyLimit }),
      }),
  };

  attachments = {
    beginOpenClawUpload: (input: BeginOpenClawAttachmentUploadInput) =>
      this.request<BeginOpenClawAttachmentUploadResult>(
        "/bridge/attachments/openclaw/init",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    uploadOpenClawChunk: (input: UploadOpenClawAttachmentChunkInput) =>
      this.request<UploadOpenClawAttachmentChunkResult>(
        "/bridge/attachments/openclaw/chunk",
        {
          method: "POST",
          body: JSON.stringify(input),
          timeoutMs: 45_000,
        },
      ),
    completeOpenClawUpload: (input: CompleteOpenClawAttachmentUploadInput) =>
      this.request<MessageAttachment>("/bridge/attachments/openclaw/complete", {
        method: "POST",
        body: JSON.stringify(input),
        timeoutMs: 45_000,
      }),
    cancelOpenClawUpload: (input: CompleteOpenClawAttachmentUploadInput) =>
      this.request<{ success: boolean; attachmentId: string }>(
        "/bridge/attachments/openclaw/cancel",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
  };

  agents = {
    modelOptions: (workspaceId?: string) =>
      this.request<{
        source: string;
        observedAt?: string | null;
        stale?: boolean;
        harnesses: Record<string, { defaultModel: string; models: string[] }>;
      }>(withQuery("/agents/model-options", { workspaceId }), {
        method: "GET",
      }),
    list: (params: {
      workspaceId?: string;
      page?: number;
      pageSize?: number;
      teamId?: string;
      status?: string;
      search?: string;
    }) =>
      this.request<Paginated<Agent>>(withQuery("/agents", params), {
        method: "GET",
      }),
    detail: (agentId: string) =>
      this.request<Agent>(`/agents/${agentId}`, { method: "GET" }),
    create: (input: CreateAgentInput) =>
      this.request<Agent>("/agents", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    provision: (input: CreateProvisionedAgentInput) =>
      this.request<AgentProvisioningJob>("/agents/provision", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    provisionJob: (jobId: string) =>
      this.request<AgentProvisioningJob>(`/agents/provision-jobs/${jobId}`, {
        method: "GET",
      }),
    nativeObservations: (workspaceId: string, runtimeHostId?: string | null) =>
      this.request<RuntimeObservation[]>(
        withQuery("/agents/native-observations", {
          workspaceId,
          runtimeHostId: runtimeHostId ?? undefined,
        }),
        { method: "GET" },
      ),
    connectNativeObservation: (
      workspaceId: string,
      observationId: string,
      input: {
        expectedState?: string;
        documentConsentVersion: number;
        relayDisplayName?: string | null;
      },
    ) =>
      this.request<Agent>(
        `/agents/native-observations/${encodeURIComponent(observationId)}/connect`,
        {
          method: "POST",
          body: JSON.stringify({ workspaceId, ...input }),
        },
      ),
    connectNativeObservations: (
      workspaceId: string,
      observationIds: string[],
      documentConsentVersion: number,
    ) =>
      this.request<{
        results: Array<{
          observationId: string;
          status: "connected" | "failed";
          agent?: Agent;
          error?: string;
        }>;
      }>("/agents/native-observations/connect-batch", {
        method: "POST",
        body: JSON.stringify({
          workspaceId,
          observationIds,
          documentConsentVersion,
        }),
      }),
    retryNativeObservation: (
      workspaceId: string,
      observationId: string,
      documentConsentVersion: number,
    ) =>
      this.request<Agent>(
        `/agents/native-observations/${encodeURIComponent(observationId)}/retry`,
        {
          method: "POST",
          body: JSON.stringify({ workspaceId, documentConsentVersion }),
        },
      ),
    disconnectNativeObservation: (workspaceId: string, observationId: string) =>
      this.request<{
        observationId: string;
        agentId?: string | null;
        connectionState: "disconnected";
        nativeAgentPreserved: true;
        disconnectedAt: string;
      }>(
        `/agents/native-observations/${encodeURIComponent(observationId)}/disconnect`,
        {
          method: "POST",
          body: JSON.stringify({ workspaceId }),
        },
      ),
    dismissNativeObservation: (workspaceId: string, observationId: string) =>
      this.request<{
        observationId: string;
        dismissed: true;
        dismissedAt: string;
        identitySuppressed: false;
        nativeAgentPreserved: true;
      }>(
        `/agents/native-observations/${encodeURIComponent(observationId)}/dismiss`,
        {
          method: "POST",
          body: JSON.stringify({ workspaceId }),
        },
      ),
    update: (agentId: string, input: Partial<CreateAgentInput>) =>
      this.request<Agent>(`/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    delete: (agentId: string) =>
      this.request<{
        success: boolean;
        id: string;
        lifecycleStatus: "retired";
        retiredAt: string;
      }>(`/agents/${agentId}`, {
        method: "DELETE",
      }),
    restore: (agentId: string) =>
      this.request<Agent>(`/agents/${agentId}/restore`, { method: "POST" }),
    permanentlyDelete: (agentId: string) =>
      this.request<{
        success: boolean;
        id: string;
        lifecycleStatus: "deleted";
      }>(`/agents/${agentId}/permanent`, { method: "DELETE" }),
    maintainCronScheduler: (
      agentId: string,
      jobId: string,
      action: "activate" | "recover" = "recover",
    ) =>
      this.request<PairedHostOperationResult>(
        `/agents/${agentId}/cron/maintenance`,
        {
          method: "POST",
          body: JSON.stringify({ jobId, action }),
          timeoutMs: 70_000,
        },
      ),
    cronJobs: (agentId: string) =>
      this.request<NativeCronJobsResult>(`/agents/${agentId}/cron/jobs`, {
        method: "GET",
        timeoutMs: 30_000,
      }),
    setStatus: (agentId: string, input: SetAgentStatusInput) =>
      this.request<Agent>(`/agents/${agentId}/status`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    performance: (agentId: string, period: string = "daily") =>
      this.request<AgentPerformanceMetric[]>(
        withQuery(`/agents/${agentId}/performance`, { period }),
        { method: "GET" },
      ),
    workLogs: (agentId: string, page: number = 1, pageSize: number = 20) =>
      this.request<Paginated<WorkLog>>(
        withQuery(`/agents/${agentId}/work-logs`, { page, pageSize }),
        { method: "GET" },
      ),
    schedule: (agentId: string) =>
      this.request<Schedule | null>(`/agents/${agentId}/schedule`, {
        method: "GET",
      }),
    updateSchedule: (agentId: string, input: UpdateAgentScheduleInput) =>
      this.request<Schedule>(`/agents/${agentId}/schedule`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    availability: (agentId: string) =>
      this.request<AvailabilityState | null>(
        `/schedules/agent/${agentId}/availability`,
        { method: "GET" },
      ),
    runs: (agentId: string, page: number = 1, pageSize: number = 20) =>
      this.request<Paginated<Run>>(
        withQuery(`/agents/${agentId}/runs`, { page, pageSize }),
        { method: "GET" },
      ),
    reviews: (agentId: string, page: number = 1, pageSize: number = 20) =>
      this.request<Paginated<Review>>(
        withQuery(`/agents/${agentId}/reviews`, { page, pageSize }),
        { method: "GET" },
      ),
    tasks: (
      agentId: string,
      status?: string,
      page: number = 1,
      pageSize: number = 20,
    ) =>
      this.request<Paginated<Task>>(
        withQuery(`/agents/${agentId}/tasks`, { status, page, pageSize }),
        { method: "GET" },
      ),
  };

  tasks = {
    list: (params: {
      workspaceId?: string;
      status?: TaskStatus;
      agentId?: string;
      teamId?: string;
      priority?: string;
      page?: number;
      pageSize?: number;
    }) =>
      this.request<Paginated<Task>>(withQuery("/tasks", params), {
        method: "GET",
      }),
    detail: (taskId: string) =>
      this.request<Task>(`/tasks/${taskId}`, { method: "GET" }),
    create: (input: CreateTaskInput) =>
      this.request<Task>("/tasks", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (taskId: string, input: UpdateTaskInput) =>
      this.request<Task>(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    updateStatus: (taskId: string, status: TaskStatus) =>
      this.request<Task>(`/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    dispatch: (taskId: string) =>
      this.request<Task>(`/tasks/${taskId}/dispatch`, { method: "POST" }),
    cancel: (taskId: string) =>
      this.request<Task>(`/tasks/${taskId}/cancel`, { method: "POST" }),
    runs: (taskId: string, page: number = 1, pageSize: number = 20) =>
      this.request<Paginated<Run>>(
        withQuery(`/tasks/${taskId}/runs`, { page, pageSize }),
        { method: "GET" },
      ),
    runDetail: (runId: string) =>
      this.request<Run>(`/runs/${runId}`, { method: "GET" }),
    runEvents: (runId: string, page: number = 1, pageSize: number = 50) =>
      this.request<Paginated<RunEvent>>(
        withQuery(`/runs/${runId}/events`, { page, pageSize }),
        { method: "GET" },
      ),
  };

  alerts = {
    list: (
      workspaceId: string,
      unreadOnly?: boolean,
      page: number = 1,
      pageSize: number = 50,
    ) =>
      this.request<Paginated<Alert>>(
        withQuery("/alerts", { workspaceId, unreadOnly, page, pageSize }),
        { method: "GET" },
      ),
    markRead: (alertId: string) =>
      this.request<Alert>(`/alerts/${alertId}/read`, { method: "POST" }),
    markAllRead: (workspaceId: string) =>
      this.request<{ count: number }>(
        withQuery("/alerts/read-all", { workspaceId }),
        { method: "POST" },
      ),
    count: (workspaceId: string) =>
      this.request<number>(withQuery("/alerts/count", { workspaceId }), {
        method: "GET",
      }),
  };

  approvals = {
    list: (workspaceId: string, status?: string) => {
      const params = new URLSearchParams({ workspaceId });
      if (status) params.set("status", status);
      params.set("page", "1");
      params.set("pageSize", "50");
      return this.request<Paginated<Approval>>(
        `/approvals?${params.toString()}`,
        {
          method: "GET",
        },
      );
    },
    detail: (approvalId: string) =>
      this.request<Approval>(`/approvals/${approvalId}`, { method: "GET" }),
    approve: (approvalId: string, input: ApprovalActionInput) =>
      this.request<Approval>(`/approvals/${approvalId}/approve`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    reject: (approvalId: string, input: ApprovalActionInput) =>
      this.request<Approval>(`/approvals/${approvalId}/reject`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  };

  incidents = {
    list: (params: {
      workspaceId?: string;
      status?: string;
      severity?: string;
      page?: number;
      pageSize?: number;
    }) =>
      this.request<Paginated<Incident>>(withQuery("/incidents", params), {
        method: "GET",
      }),
    detail: (incidentId: string) =>
      this.request<Incident>(`/incidents/${incidentId}`, { method: "GET" }),
    create: (input: CreateIncidentInput) =>
      this.request<Incident>("/incidents", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    resolve: (incidentId: string, input: ResolveIncidentInput) =>
      this.request<Incident>(`/incidents/${incidentId}/resolve`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (incidentId: string, input: Partial<CreateIncidentInput>) =>
      this.request<Incident>(`/incidents/${incidentId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
  };

  reports = {
    list: (
      workspaceId: string,
      type?: string,
      page: number = 1,
      pageSize: number = 20,
    ) =>
      this.request<Paginated<ReportSnapshot>>(
        withQuery("/reports", { workspaceId, type, page, pageSize }),
        { method: "GET" },
      ),
    detail: (reportId: string) =>
      this.request<ReportSnapshot>(`/reports/${reportId}`, { method: "GET" }),
    wrapUps: (
      workspaceId: string,
      search?: string,
      page: number = 1,
      pageSize: number = 100,
      threadId?: string,
      teamId?: string,
    ) =>
      this.request<Paginated<ThreadWrapUpReport>>(
        withQuery("/reports/wrap-ups", {
          workspaceId,
          search,
          page,
          pageSize,
          threadId,
          teamId,
        }),
        { method: "GET" },
      ),
    wrapUpDetail: (reportId: string) =>
      this.request<ThreadWrapUpReport>(`/reports/wrap-ups/${reportId}`, {
        method: "GET",
      }),
    retryWrapUp: (reportId: string) =>
      this.request<ThreadWrapUpReport>(`/reports/wrap-ups/${reportId}/retry`, {
        method: "POST",
      }),
    generate: (
      workspaceId: string,
      type: string,
      period: string,
      start: string,
      end: string,
    ) =>
      this.request<ReportSnapshot>("/reports/generate", {
        method: "POST",
        body: JSON.stringify({ workspaceId, type, period, start, end }),
      }),
    metrics: (
      workspaceId: string,
      period: string,
      agentId?: string,
      teamId?: string,
    ) =>
      this.request<AgentPerformanceMetric[]>(
        withQuery("/reports/metrics", { workspaceId, period, agentId, teamId }),
        { method: "GET" },
      ),
  };

  teams = {
    list: (workspaceId?: string, departmentId?: string) =>
      this.request<Team[]>(withQuery("/teams", { workspaceId, departmentId }), {
        method: "GET",
      }),
    detail: (teamId: string) =>
      this.request<Team>(`/teams/${teamId}`, { method: "GET" }),
    create: (input: CreateTeamInput) =>
      this.request<Team>("/teams", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (teamId: string, input: Partial<CreateTeamInput>) =>
      this.request<Team>(`/teams/${teamId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    dashboard: (teamId: string) =>
      this.request<TeamDashboard>(`/teams/${teamId}/dashboard`, {
        method: "GET",
      }),
    agents: (
      teamId: string,
      status?: string,
      page: number = 1,
      pageSize: number = 20,
    ) =>
      this.request<Paginated<Agent>>(
        withQuery(`/teams/${teamId}/agents`, { status, page, pageSize }),
        { method: "GET" },
      ),
    handovers: (teamId: string, page: number = 1, pageSize: number = 20) =>
      this.request<Paginated<HandoverNote>>(
        withQuery(`/teams/${teamId}/handovers`, { page, pageSize }),
        { method: "GET" },
      ),
    memory: (
      teamId: string,
      type?: string,
      search?: string,
      page: number = 1,
      pageSize: number = 20,
    ) =>
      this.request<Paginated<TeamMemoryItem>>(
        withQuery(`/teams/${teamId}/memory`, { type, search, page, pageSize }),
        { method: "GET" },
      ),
    createMemory: (teamId: string, input: CreateTeamMemoryItemInput) =>
      this.request<TeamMemoryItem>(`/teams/${teamId}/memory`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateMemory: (
      teamId: string,
      memoryId: string,
      input: Partial<CreateTeamMemoryItemInput>,
    ) =>
      this.request<TeamMemoryItem>(`/teams/${teamId}/memory/${memoryId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    deleteMemory: (teamId: string, memoryId: string) =>
      this.request<{ success: boolean }>(
        `/teams/${teamId}/memory/${memoryId}`,
        {
          method: "DELETE",
        },
      ),
    delete: (teamId: string) =>
      this.request<{ success: boolean }>(`/teams/${teamId}`, {
        method: "DELETE",
      }),
  };

  departments = {
    list: (workspaceId?: string, companyId?: string) =>
      this.request<Department[]>(
        withQuery("/departments", { workspaceId, companyId }),
        { method: "GET" },
      ),
    detail: (departmentId: string) =>
      this.request<Department>(`/departments/${departmentId}`, {
        method: "GET",
      }),
    create: (input: CreateDepartmentInput) =>
      this.request<Department>("/departments", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (departmentId: string, input: Partial<CreateDepartmentInput>) =>
      this.request<Department>(`/departments/${departmentId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    dashboard: (departmentId: string) =>
      this.request<DepartmentDashboard>(
        `/departments/${departmentId}/dashboard`,
        { method: "GET" },
      ),
    inbox: (departmentId: string, page: number = 1, pageSize: number = 20) =>
      this.request<Paginated<Alert>>(
        withQuery(`/departments/${departmentId}/inbox`, { page, pageSize }),
        { method: "GET" },
      ),
    delete: (departmentId: string) =>
      this.request<{ deleted: boolean }>(`/departments/${departmentId}`, {
        method: "DELETE",
      }),
  };

  org = {
    chart: (workspaceId: string) =>
      this.request<OrgChart>(withQuery("/org/chart", { workspaceId }), {
        method: "GET",
      }),
    companies: (workspaceId: string) =>
      this.request<Company[]>(withQuery("/org/companies", { workspaceId }), {
        method: "GET",
      }),
    company: (companyId: string) =>
      this.request<Company & { departments?: Department[] }>(
        `/org/companies/${companyId}`,
        { method: "GET" },
      ),
    createCompany: (input: CreateCompanyInput) =>
      this.request<Company>("/org/companies", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateCompany: (companyId: string, input: Partial<CreateCompanyInput>) =>
      this.request<Company>(`/org/companies/${companyId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    createRelationship: (managerId: string, reportId: string) =>
      this.request<{ id: string }>("/org/relationships", {
        method: "POST",
        body: JSON.stringify({ managerId, reportId }),
      }),
    deleteRelationship: (managerId: string, reportId: string) =>
      this.request<{ success: boolean }>(
        `/org/relationships/${managerId}/${reportId}`,
        {
          method: "DELETE",
        },
      ),
  };

  schedules = {
    list: (workspaceId: string) =>
      this.request<Schedule[]>(withQuery("/schedules", { workspaceId }), {
        method: "GET",
      }),
    agent: (agentId: string) =>
      this.request<Schedule | null>(`/schedules/agent/${agentId}`, {
        method: "GET",
      }),
    updateAgent: (agentId: string, input: UpdateAgentScheduleInput) =>
      this.request<Schedule>(`/schedules/agent/${agentId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    availability: (agentId: string) =>
      this.request<AvailabilityState | null>(
        `/schedules/agent/${agentId}/availability`,
        { method: "GET" },
      ),
  };

  capacity = {
    workspace: (workspaceId: string) =>
      this.request<{
        total: number;
        overloaded: number;
        available: number;
        items: CapacityEntry[];
      }>(withQuery("/capacity", { workspaceId }), { method: "GET" }),
    team: (teamId: string) =>
      this.request<{
        total: number;
        overloaded: number;
        available: number;
        items: CapacityEntry[];
      }>(`/capacity/team/${teamId}`, { method: "GET" }),
    suggestions: (workspaceId: string) =>
      this.request<CapacitySuggestion[]>(
        withQuery("/capacity/suggestions", { workspaceId }),
        { method: "GET" },
      ),
  };

  permissions = {
    list: (workspaceId: string) =>
      this.request<PermissionPolicy[]>(
        withQuery("/permissions", { workspaceId }),
        { method: "GET" },
      ),
    create: (input: CreatePermissionPolicyInput) =>
      this.request<PermissionPolicy>("/permissions", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (policyId: string, permissions: Array<Record<string, unknown>>) =>
      this.request<PermissionPolicy>(`/permissions/${policyId}`, {
        method: "PATCH",
        body: JSON.stringify({ permissions }),
      }),
    delete: (policyId: string) =>
      this.request<void>(`/permissions/${policyId}`, { method: "DELETE" }),
  };

  bridge = {
    connections: (workspaceId: string) =>
      this.request<OpenClawConnection[]>(
        withQuery("/bridge/connections", { workspaceId }),
        { method: "GET" },
      ),
    createConnection: (input: CreateConnectionInput) =>
      this.request<OpenClawConnection>("/bridge/connections", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    reconnect: (connectionId: string) =>
      this.request<{ success: boolean }>(
        `/bridge/connections/${connectionId}/reconnect`,
        { method: "POST" },
      ),
    sync: (workspaceId: string) =>
      this.request<{ success: boolean; message: string; workspaceId: string }>(
        "/bridge/sync",
        {
          method: "POST",
          body: JSON.stringify({ workspaceId }),
        },
      ),
    createEnrollment: (
      workspaceId: string,
      input: { deviceLabel?: string; expiresInMinutes?: number } = {},
    ) =>
      this.request<BridgeEnrollment>(
        `/bridge/workspaces/${workspaceId}/enrollments`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    devices: (workspaceId: string) =>
      this.request<BridgeDevice[]>(
        `/bridge/workspaces/${workspaceId}/devices`,
        {
          method: "GET",
        },
      ),
    revokeDevice: (deviceId: string) =>
      this.request<{ success: boolean; deviceId: string }>(
        `/bridge/devices/${deviceId}/revoke`,
        {
          method: "POST",
        },
      ),
    revokeAllDevices: (workspaceId: string) =>
      this.request<{ success: boolean; revokedDeviceIds: string[] }>(
        `/bridge/workspaces/${workspaceId}/devices/revoke-all`,
        {
          method: "POST",
        },
      ),
  };

  relaySync = {
    capabilities: () =>
      this.request<RelayDeploymentCapabilities>("/deployment/capabilities", {
        method: "GET",
      }),
    changes: (workspaceId: string, after: string = "0", limit: number = 200) =>
      this.request<RelayWorkspaceChangePage>(
        withQuery(`/workspaces/${workspaceId}/changes`, { after, limit }),
        { method: "GET" },
      ),
    mutate: (
      workspaceId: string,
      installationId: string,
      mutations: Array<Record<string, unknown>>,
    ) =>
      this.request<{ outcomes: RelayMutationOutcome[] }>(
        `/workspaces/${workspaceId}/mutations`,
        { method: "POST", body: JSON.stringify({ installationId, mutations }) },
      ),
    reconcile: (
      workspaceId: string,
      cursor: string,
      counts: Record<string, number>,
    ) =>
      this.request<{
        latestCursor: string;
        canonicalCounts: Record<string, number>;
        drift: string[];
        rebuildRequired: boolean;
      }>(`/workspaces/${workspaceId}/reconcile`, {
        method: "POST",
        body: JSON.stringify({ cursor, counts }),
      }),
  };

  agentDocumentation = {
    linkedApps: (workspaceId: string) =>
      this.request<LinkedApplication[]>(
        `/workspaces/${workspaceId}/agent-documentation/linked-apps`,
        { method: "GET" },
      ),
    createLinkedApp: (
      workspaceId: string,
      input: CreateLinkedApplicationInput,
    ) =>
      this.request<LinkedApplication>(
        `/workspaces/${workspaceId}/agent-documentation/linked-apps`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    updateLinkedApp: (
      workspaceId: string,
      id: string,
      input: UpdateLinkedApplicationInput,
    ) =>
      this.request<LinkedApplication>(
        `/workspaces/${workspaceId}/agent-documentation/linked-apps/${id}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    deleteLinkedApp: (workspaceId: string, id: string) =>
      this.request<{ success: boolean; id: string }>(
        `/workspaces/${workspaceId}/agent-documentation/linked-apps/${id}`,
        { method: "DELETE" },
      ),
    scanLinkedApp: (workspaceId: string, id: string) =>
      this.request<LinkedApplication>(
        `/workspaces/${workspaceId}/agent-documentation/linked-apps/${id}/scan`,
        { method: "POST" },
      ),
    blueprints: (workspaceId: string) =>
      this.request<DocumentationBlueprint[]>(
        `/workspaces/${workspaceId}/agent-documentation/blueprints`,
        { method: "GET" },
      ),
    forkBlueprint: (workspaceId: string, id: string, name?: string) =>
      this.request<DocumentationBlueprint>(
        `/workspaces/${workspaceId}/agent-documentation/blueprints/${id}/fork`,
        { method: "POST", body: JSON.stringify({ name }) },
      ),
    updateBlueprint: (
      workspaceId: string,
      id: string,
      input: { name?: string; content?: string; changelog?: string },
    ) =>
      this.request<DocumentationBlueprint>(
        `/workspaces/${workspaceId}/agent-documentation/blueprints/${id}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    publishBlueprint: (workspaceId: string, id: string) =>
      this.request<DocumentationBlueprint>(
        `/workspaces/${workspaceId}/agent-documentation/blueprints/${id}/publish`,
        { method: "POST" },
      ),
    retireBlueprint: (workspaceId: string, id: string) =>
      this.request<DocumentationBlueprint>(
        `/workspaces/${workspaceId}/agent-documentation/blueprints/${id}/retire`,
        { method: "POST" },
      ),
    packs: (workspaceId: string) =>
      this.request<ApplicationDocumentationPack[]>(
        `/workspaces/${workspaceId}/agent-documentation/packs`,
        { method: "GET" },
      ),
    generateProposal: (
      workspaceId: string,
      input: GenerateDocumentationProposalInput,
    ) =>
      this.request<DocumentationGenerationProposal>(
        `/workspaces/${workspaceId}/agent-documentation/packs/generate`,
        { method: "POST", body: JSON.stringify(input), timeoutMs: 300000 },
      ),
    proposals: (workspaceId: string) =>
      this.request<DocumentationGenerationProposal[]>(
        `/workspaces/${workspaceId}/agent-documentation/proposals`,
        { method: "GET" },
      ),
    proposal: (workspaceId: string, id: string) =>
      this.request<DocumentationGenerationProposal>(
        `/workspaces/${workspaceId}/agent-documentation/proposals/${id}`,
        { method: "GET" },
      ),
    applyProposal: (workspaceId: string, id: string, fileIds: string[]) =>
      this.request<{
        proposalId: string;
        pack: ApplicationDocumentationPack;
        appliedFiles: string[];
      }>(
        `/workspaces/${workspaceId}/agent-documentation/proposals/${id}/apply`,
        { method: "POST", body: JSON.stringify({ fileIds }) },
      ),
    syncLibrary: (workspaceId: string, packId: string, targetFolder?: string) =>
      this.request<{
        pack: ApplicationDocumentationPack;
        syncedFiles: string[];
      }>(
        `/workspaces/${workspaceId}/agent-documentation/packs/${packId}/sync-library`,
        { method: "POST", body: JSON.stringify({ targetFolder }) },
      ),
    agentInstalls: (workspaceId: string) =>
      this.request<AgentDocumentationInstall[]>(
        `/workspaces/${workspaceId}/agent-documentation/agent-installs`,
        { method: "GET" },
      ),
    installAgentDocs: (
      workspaceId: string,
      input: { packId: string; agentId: string; role: MarketplaceInstallRole },
    ) =>
      this.request<{
        install: AgentDocumentationInstall;
        installedFiles: string[];
      }>(`/workspaces/${workspaceId}/agent-documentation/agent-installs`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    drift: (workspaceId: string) =>
      this.request<Record<string, unknown>>(
        `/workspaces/${workspaceId}/agent-documentation/drift`,
        { method: "GET" },
      ),
    exportState: (
      workspaceId: string,
      input: {
        packId?: string;
        agentId?: string;
        snapshotKind?: string;
        state?: Record<string, unknown>;
        exportToLibrary?: boolean;
      },
    ) =>
      this.request<Record<string, unknown>>(
        `/workspaces/${workspaceId}/agent-documentation/state/export`,
        { method: "POST", body: JSON.stringify(input) },
      ),
  };

  marketplace = {
    catalog: (workspaceId: string) =>
      this.request<MarketplaceCatalog>(
        `/workspaces/${workspaceId}/marketplace/catalog`,
        { method: "GET" },
      ),
    catalogPage: (
      workspaceId: string,
      query: import("@clawchat/contracts").MarketplaceCatalogPageQuery = {},
    ) =>
      this.request<import("@clawchat/contracts").MarketplaceCatalogPage>(
        withQuery(`/workspaces/${workspaceId}/marketplace/catalog`, {
          ...query,
        }),
        { method: "GET" },
      ),
    app: (workspaceId: string, slug: string) =>
      this.request<MarketplaceApp>(
        `/workspaces/${workspaceId}/marketplace/catalog/${encodeURIComponent(slug)}`,
        { method: "GET" },
      ),
    connections: (workspaceId: string, appSlug?: string) =>
      this.request<MarketplaceConnection[]>(
        withQuery(`/workspaces/${workspaceId}/marketplace/connections`, {
          appSlug,
        }),
        { method: "GET" },
      ),
    toolRequests: (
      workspaceId: string,
      filters?: {
        linkedAppId?: string;
        appSlug?: string;
        teamId?: string;
        threadId?: string;
        agentId?: string;
        status?: string;
        capability?: string;
      },
    ) =>
      this.request<import("@clawchat/contracts").ToolRequest[]>(
        withQuery(
          `/workspaces/${workspaceId}/marketplace/tool-requests`,
          filters ?? {},
        ),
        { method: "GET" },
      ),
    neededToolsSummary: (
      workspaceId: string,
      filters?: { appSlug?: string; teamId?: string },
    ) =>
      this.request<import("@clawchat/contracts").NeededToolsSummary>(
        withQuery(
          `/workspaces/${workspaceId}/marketplace/tool-requests/summary`,
          filters ?? {},
        ),
        { method: "GET" },
      ),
    updateToolRequestStatus: (
      workspaceId: string,
      id: string,
      input: {
        status: import("@clawchat/contracts").ToolRequestStatus;
        resolutionNotes?: string | null;
      },
    ) =>
      this.request<import("@clawchat/contracts").ToolRequest>(
        `/workspaces/${workspaceId}/marketplace/tool-requests/${id}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    xOAuthConfig: (workspaceId: string) =>
      this.request<XMarketplaceOAuthConfig>(
        `/workspaces/${workspaceId}/marketplace/x/oauth/config`,
        { method: "GET" },
      ),
    startXOAuth: (workspaceId: string, input: StartXMarketplaceOAuthInput) =>
      this.request<StartXMarketplaceOAuthResult>(
        `/workspaces/${workspaceId}/marketplace/x/oauth/start`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    reauthorizeXOAuth: (
      workspaceId: string,
      connectionId: string,
      input: StartXMarketplaceOAuthInput,
    ) =>
      this.request<StartXMarketplaceOAuthResult>(
        `/workspaces/${workspaceId}/marketplace/x/connections/${connectionId}/oauth/reauthorize`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    disconnectXOAuth: (workspaceId: string, connectionId: string) =>
      this.request<MarketplaceConnection>(
        `/workspaces/${workspaceId}/marketplace/x/connections/${connectionId}/disconnect`,
        { method: "POST" },
      ),
    connectorOAuthConfig: (workspaceId: string, slug: string) =>
      this.request<MarketplaceConnectorOAuthConfig>(
        `/workspaces/${workspaceId}/marketplace/connectors/${slug}/oauth/config`,
        { method: "GET" },
      ),
    startConnectorOAuth: (
      workspaceId: string,
      slug: string,
      input: StartMarketplaceConnectorOAuthInput,
    ) =>
      this.request<StartMarketplaceConnectorOAuthResult>(
        `/workspaces/${workspaceId}/marketplace/connectors/${slug}/oauth/start`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    reauthorizeConnectorOAuth: (
      workspaceId: string,
      slug: string,
      connectionId: string,
      input: StartMarketplaceConnectorOAuthInput,
    ) =>
      this.request<StartMarketplaceConnectorOAuthResult>(
        `/workspaces/${workspaceId}/marketplace/connectors/${slug}/connections/${connectionId}/oauth/reauthorize`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    disconnectConnectorOAuth: (
      workspaceId: string,
      slug: string,
      connectionId: string,
    ) =>
      this.request<MarketplaceConnection>(
        `/workspaces/${workspaceId}/marketplace/connectors/${slug}/connections/${connectionId}/disconnect`,
        { method: "POST" },
      ),
    connectorHealth: (
      workspaceId: string,
      slug: string,
      connectionId: string,
    ) =>
      this.request<MarketplaceConnectorHealth>(
        `/workspaces/${workspaceId}/marketplace/connectors/${slug}/connections/${connectionId}/health`,
        { method: "GET" },
      ),
    validateConnectorSenderIdentity: (
      workspaceId: string,
      slug: string,
      connectionId: string,
      input: import("@clawchat/contracts").ValidateConnectorSenderIdentityInput,
    ) =>
      this.request<{
        connection: MarketplaceConnection;
        identity: Record<string, unknown>;
        adminUrls: Record<string, string>;
      }>(
        `/workspaces/${workspaceId}/marketplace/connectors/${slug}/connections/${connectionId}/sender-identities/validate`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    createConnection: (
      workspaceId: string,
      input: {
        appSlug: string;
        displayName: string;
        environment?: string;
        authType?: string;
        credentials?: Record<string, string>;
        retainUnverifiedCredentials?: boolean;
        selectedCapabilities?: string[];
        metadata?: Record<string, unknown>;
      },
    ) =>
      this.request<MarketplaceConnection>(
        `/workspaces/${workspaceId}/marketplace/connections`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    createLocalApp: (
      workspaceId: string,
      input: CreateLocalMarketplaceAppInput,
    ) =>
      this.request<MarketplaceCatalog>(
        `/workspaces/${workspaceId}/marketplace/local-apps`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    localSourceHosts: (workspaceId: string) =>
      this.request<MarketplaceLocalRepoSourceHost[]>(
        `/workspaces/${workspaceId}/marketplace/local-source-hosts`,
        { method: "GET" },
      ),
    updateLocalApp: (
      workspaceId: string,
      appSlug: string,
      input: UpdateLocalMarketplaceAppInput,
    ) =>
      this.request<MarketplaceCatalog>(
        `/workspaces/${workspaceId}/marketplace/local-apps/${appSlug}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    updatePack: (workspaceId: string, appSlug: string) =>
      this.request<MarketplaceGeneratedPackDetail>(
        `/workspaces/${workspaceId}/marketplace/apps/${appSlug}/update-pack`,
        { method: "POST" },
      ),
    refreshAgentDocs: (workspaceId: string, appSlug: string) =>
      this.request<MarketplaceAgentDocsRefreshResult>(
        `/workspaces/${workspaceId}/marketplace/apps/${appSlug}/refresh-agent-docs`,
        { method: "POST" },
      ),
    syncLocalAppConnectorPolicy: (
      workspaceId: string,
      appSlug: string,
      input?: { campaignId?: string | null; campaignName?: string | null },
    ) =>
      this.request<import("@clawchat/contracts").LocalAppConnectorPolicySyncStatus>(
        `/workspaces/${workspaceId}/marketplace/apps/${appSlug}/localappconnector-policy/sync`,
        { method: "POST", body: JSON.stringify(input ?? {}) },
      ),
    configureLocalAppConnectorOpenClaw: (
      workspaceId: string,
      appSlug: string,
      input: import("@clawchat/contracts").ConfigureLocalAppConnectorOpenClawInput,
    ) =>
      this.request<MarketplaceCatalog>(
        `/workspaces/${workspaceId}/marketplace/apps/${appSlug}/localappconnector-agent-api/configure`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    autoConnectLocalApp: (
      workspaceId: string,
      appSlug: string,
      input: import("@clawchat/contracts").AutoConnectLocalAppInput,
    ) =>
      this.request<import("@clawchat/contracts").AutoConnectLocalAppResult>(
        `/workspaces/${workspaceId}/marketplace/apps/${appSlug}/auto-connect`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    documentationHistory: (workspaceId: string, appSlug: string) =>
      this.request<MarketplaceDocumentationHistory>(
        `/workspaces/${workspaceId}/marketplace/apps/${appSlug}/documentation-history`,
        { method: "GET" },
      ),
    localRepoDocsStatus: (workspaceId: string, appSlug: string) =>
      this.request<MarketplaceLocalRepoDocsStatus>(
        `/workspaces/${workspaceId}/marketplace/apps/${appSlug}/local-repo-docs/status`,
        { method: "GET" },
      ),
    analyzeLocalRepoDocs: (workspaceId: string, appSlug: string) =>
      this.request<DocumentationGenerationProposal>(
        `/workspaces/${workspaceId}/marketplace/apps/${appSlug}/local-repo-docs/analyze`,
        { method: "POST" },
      ),
    localRepoDocsProposal: (
      workspaceId: string,
      appSlug: string,
      proposalId: string,
    ) =>
      this.request<DocumentationGenerationProposal>(
        `/workspaces/${workspaceId}/marketplace/apps/${appSlug}/local-repo-docs/proposals/${proposalId}`,
        { method: "GET" },
      ),
    applyLocalRepoDocsProposal: (
      workspaceId: string,
      appSlug: string,
      proposalId: string,
      input: MarketplaceLocalRepoDocsProposalApplyInput,
    ) =>
      this.request<MarketplaceLocalRepoDocsProposalApplyResult>(
        `/workspaces/${workspaceId}/marketplace/apps/${appSlug}/local-repo-docs/proposals/${proposalId}/apply`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    updateConnection: (
      workspaceId: string,
      id: string,
      input: {
        displayName?: string;
        environment?: string;
        credentials?: Record<string, string>;
        retainUnverifiedCredentials?: boolean;
        selectedCapabilities?: string[];
        metadata?: Record<string, unknown>;
      },
    ) =>
      this.request<MarketplaceConnection>(
        `/workspaces/${workspaceId}/marketplace/connections/${id}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    installs: (workspaceId: string) =>
      this.request<MarketplaceInstall[]>(
        `/workspaces/${workspaceId}/marketplace/installs`,
        { method: "GET" },
      ),
    removeInstall: (workspaceId: string, installId: string) =>
      this.request<MarketplaceInstall>(
        `/workspaces/${workspaceId}/marketplace/installs/${installId}`,
        { method: "DELETE" },
      ),
    updateInstall: (
      workspaceId: string,
      installId: string,
      input: import("@clawchat/contracts").UpdateMarketplaceInstallInput,
    ) =>
      this.request<MarketplaceInstall>(
        `/workspaces/${workspaceId}/marketplace/installs/${installId}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    previewPack: (
      workspaceId: string,
      input: {
        appSlug: string;
        connectionId?: string;
        selectedCapabilities?: string[];
        approvalProfileId?: string;
        runtimeFormat?: MarketplaceRuntimeFormat;
      },
    ) =>
      this.request<MarketplacePackPreview>(
        `/workspaces/${workspaceId}/marketplace/packs/preview`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    generatedPacks: (workspaceId: string) =>
      this.request<MarketplaceGeneratedPackSummary[]>(
        `/workspaces/${workspaceId}/marketplace/packs/generated`,
        { method: "GET" },
      ),
    generatedPackCoverage: (workspaceId: string) =>
      this.request<MarketplacePackCoverageReport>(
        `/workspaces/${workspaceId}/marketplace/packs/generated/coverage`,
        { method: "GET" },
      ),
    generatedPackDetail: (workspaceId: string, appSlug: string) =>
      this.request<MarketplaceGeneratedPackDetail>(
        `/workspaces/${workspaceId}/marketplace/packs/generated/${appSlug}`,
        { method: "GET" },
      ),
    rerunGeneratedPack: (workspaceId: string, appSlug: string) =>
      this.request<MarketplaceGeneratedPackDetail>(
        `/workspaces/${workspaceId}/marketplace/packs/generated/${appSlug}/rerun`,
        { method: "POST" },
      ),
    updateGeneratedPackSources: (
      workspaceId: string,
      appSlug: string,
      input: Record<string, unknown>,
    ) =>
      this.request<MarketplaceGeneratedPackDetail>(
        `/workspaces/${workspaceId}/marketplace/packs/generated/${appSlug}/sources`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    previewGeneratedPackSourceImport: (
      workspaceId: string,
      appSlug: string,
      input: Record<string, unknown>,
    ) =>
      this.request<Record<string, unknown>>(
        `/workspaces/${workspaceId}/marketplace/packs/generated/${appSlug}/sources/preview`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    importGeneratedPackSources: (
      workspaceId: string,
      appSlug: string,
      input: Record<string, unknown>,
    ) =>
      this.request<MarketplaceGeneratedPackDetail>(
        `/workspaces/${workspaceId}/marketplace/packs/generated/${appSlug}/sources/import`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    recordGeneratedPackReview: (
      workspaceId: string,
      appSlug: string,
      input: { notes?: string },
    ) =>
      this.request<Record<string, unknown>>(
        `/workspaces/${workspaceId}/marketplace/packs/generated/${appSlug}/reviews`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    promoteGeneratedPack: (
      workspaceId: string,
      appSlug: string,
      input: { notes?: string } = {},
    ) =>
      this.request<MarketplaceGeneratedPackDetail>(
        `/workspaces/${workspaceId}/marketplace/packs/generated/${appSlug}/promote`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    publishGeneratedPack: (
      workspaceId: string,
      appSlug: string,
      input: { notes?: string } = {},
    ) =>
      this.request<MarketplaceGeneratedPackDetail>(
        `/workspaces/${workspaceId}/marketplace/packs/generated/${appSlug}/publish`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    rejectGeneratedPack: (
      workspaceId: string,
      appSlug: string,
      input: { notes?: string } = {},
    ) =>
      this.request<MarketplaceGeneratedPackDetail>(
        `/workspaces/${workspaceId}/marketplace/packs/generated/${appSlug}/reject`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    markGeneratedPackNeedsManualReview: (
      workspaceId: string,
      appSlug: string,
      input: { notes?: string } = {},
    ) =>
      this.request<MarketplaceGeneratedPackDetail>(
        `/workspaces/${workspaceId}/marketplace/packs/generated/${appSlug}/needs-manual-review`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    install: (
      workspaceId: string,
      input: {
        appSlug: string;
        connectionId?: string;
        selectedCapabilities?: string[];
        approvalProfileId?: string;
        runtimeFormat?: MarketplaceRuntimeFormat;
        agentIds?: string[];
        role: MarketplaceInstallRole;
        libraryTargetFolder?: string;
        targetMode?: "existing_agents" | "activate_new_agent";
        newAgentName?: string;
        newAgentRuntimeType?: "openclaw" | "hermes";
        newAgentRole?: string;
        acknowledgeGeneratedDraftRisk?: boolean;
        acknowledgeDangerouslySkipPermissions?: boolean;
        outlookSenderEmail?: string;
      },
    ) =>
      this.request<MarketplaceInstallResult>(
        `/workspaces/${workspaceId}/marketplace/install`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
  };

  auditLogs = {
    list: (workspaceId: string, page: number = 1, pageSize: number = 50) =>
      this.request<Paginated<Record<string, unknown>>>(
        withQuery("/audit-logs", { workspaceId, page, pageSize }),
        { method: "GET" },
      ),
    metrics: (workspaceId: string, hours: number = 24) =>
      this.request<SecurityMetrics>(
        withQuery("/audit-logs/metrics", { workspaceId, hours }),
        { method: "GET" },
      ),
  };

  cloud = {
    entitlements: (workspaceId: string) =>
      this.request<RelaySignedDocument<RelayEntitlements>>(
        `/workspaces/${workspaceId}/cloud/entitlements`,
        { method: "GET" },
      ),
    supportBundle: (workspaceId: string) =>
      this.request<Record<string, unknown>>(
        `/workspaces/${workspaceId}/cloud/support-bundle`,
        { method: "GET" },
      ),
    createCheckout: (
      workspaceId: string,
      plan:
        | "relay_connect_monthly"
        | "relay_managed_cloud_monthly" = "relay_connect_monthly",
    ) =>
      this.request<{
        provider: "stripe";
        checkoutUrl: string;
        sessionId: string;
      }>(`/workspaces/${workspaceId}/billing/checkout`, {
        method: "POST",
        body: JSON.stringify({ plan }),
      }),
    createBillingPortal: (workspaceId: string) =>
      this.request<{ provider: "stripe"; portalUrl: string }>(
        `/workspaces/${workspaceId}/billing/portal`,
        { method: "POST" },
      ),
  };

  private async browserCsrfHeaders(): Promise<Record<string, string>> {
    const { csrfToken } = await this.auth.csrf();
    if (!csrfToken) {
      throw new ClawChatApiError(
        "Could not establish browser CSRF protection.",
        403,
        "/auth/csrf",
      );
    }
    return { "x-csrf-token": csrfToken };
  }

  private async refreshBrowserSession(): Promise<WebSession> {
    if (this.browserRefreshPromise) return this.browserRefreshPromise;

    const refresh = (async () =>
      this.request<WebSession>("/auth/web/refresh", {
        method: "POST",
        headers: await this.browserCsrfHeaders(),
        skipRefresh: true,
      }))();
    this.browserRefreshPromise = refresh;
    try {
      return await refresh;
    } finally {
      if (this.browserRefreshPromise === refresh) {
        this.browserRefreshPromise = null;
      }
    }
  }

  private async request<T>(
    path: string,
    init: RequestInitWithRetry,
  ): Promise<T> {
    const headers = new Headers(init.headers ?? {});
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(
      (init.method || "GET").toUpperCase(),
    );
    const csrfToken = getCookie("clawchat_web_csrf");
    if (isMutating && csrfToken) {
      headers.set("x-csrf-token", csrfToken);
    }

    const controller = new AbortController();
    const timeoutMs =
      init.timeoutMs === null
        ? null
        : typeof init.timeoutMs === "number" && init.timeoutMs > 0
          ? init.timeoutMs
          : DEFAULT_REQUEST_TIMEOUT_MS;
    const timeoutId =
      timeoutMs !== null
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    let response: Response;
    try {
      response = await fetch(`${this.apiBaseUrl}${path}`, {
        ...init,
        headers,
        credentials: "include",
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        throw new ClawChatNetworkError(
          `Railway backend did not respond within ${timeoutMs}ms.`,
          path,
          "timeout",
          timeoutMs,
          { cause: error },
        );
      }
      throw new ClawChatNetworkError(
        "Could not reach the Railway backend. Check your connection and retry.",
        path,
        "network",
        timeoutMs,
        { cause: error },
      );
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }

    if (
      response.status === 401 &&
      !init.skipRefresh &&
      !path.startsWith("/auth/web/")
    ) {
      await this.auth.refresh();
      return this.request<T>(path, { ...init, skipRefresh: true });
    }

    if (!response.ok) {
      const errorBody = await safeJson(response);
      const message = [502, 503, 504].includes(response.status)
        ? "Relay service is temporarily unavailable. Please try again shortly."
        : errorBody?.message || `Request failed with status ${response.status}`;
      throw new ClawChatApiError(message, response.status, path, errorBody);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const responseText = await response.text();
    let json: ApiEnvelope<T> | T;
    try {
      json = JSON.parse(responseText) as ApiEnvelope<T> | T;
    } catch (error) {
      const contentLength = response.headers.get("content-length");
      const receivedBytes = new TextEncoder().encode(responseText).length;
      const sizeLabel = contentLength
        ? `${receivedBytes}/${contentLength} bytes`
        : `${receivedBytes} bytes`;
      const parserMessage =
        error instanceof Error ? error.message : "Invalid JSON";

      throw new Error(
        `The backend returned invalid JSON for ${path} (${response.status}, ${sizeLabel}). ${parserMessage}`,
      );
    }

    return "data" in (json as ApiEnvelope<T>)
      ? (json as ApiEnvelope<T>).data
      : (json as T);
  }
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export * from "@clawchat/contracts";
