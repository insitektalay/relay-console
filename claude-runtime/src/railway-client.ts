type DeviceAuthResponse = {
  device: { id: string; workspaceId: string; label: string };
  credentials: { devicePublicId: string; deviceToken: string };
  tokens: {
    accessToken: string;
    wsToken: string;
    accessExpiresIn: number;
    wsExpiresIn: number;
  };
};

type EnrollResponse = {
  credentials: { devicePublicId: string; deviceToken: string };
  tokens: DeviceAuthResponse["tokens"];
};

export type BridgeArtifactCatalogueInput = {
  machineId?: string;
  machineLabel?: string;
  platform?: "macos" | "windows" | "linux" | "unknown";
  artifacts: Array<{
    id: string;
    title: string;
    kind:
      | "document"
      | "image"
      | "video"
      | "audio"
      | "data"
      | "folder"
      | "unknown";
    sourceKind: string;
    relativePath: string;
    fileExtension?: string;
    byteCount?: number;
    updatedAt?: string;
    agentId?: string;
    agentName?: string;
    isReadableText: boolean;
    harnessId?: string;
    harnessType?: string;
    harnessLabel?: string;
    contentHash?: string;
    externalUrl?: string;
    externalProvider?: string;
    presentationState?:
      | "available"
      | "unavailable"
      | "moved"
      | "expired"
      | "deleted"
      | "permission_denied";
    presentationReason?: string;
  }>;
};

const CLAWCHAT_BRIDGE_CAPABILITIES = [
  "clawchat.bridge.rotating_credentials.v1",
  "claude-runtime",
  "claude.cli.structured_prompt",
  "artifact.metadata.publish",
];
const CLAUDE_RUNTIME_COMPATIBILITY = {
  runtimeType: "claude_code",
  hostType: "macos-launchd",
  pluginVersion: "1.0.0",
  openCoreVersion: "1.0.0",
  apiContractVersion: "v2",
  websocketContractVersion: "bridge.v1",
} as const;
const TOKEN_REFRESH_SKEW_MS = 30_000;

type PersistDeviceToken = (
  devicePublicId: string,
  deviceToken: string,
) => Promise<void>;

export class RailwayClient {
  private accessToken: string | null = null;
  private websocketToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private websocketTokenExpiresAt = 0;
  private authenticationInFlight: Promise<DeviceAuthResponse> | null = null;
  private pendingCredentialPersistence: DeviceAuthResponse | null = null;

  constructor(
    private readonly apiBaseUrl: string,
    private readonly workspaceId: string,
    private readonly device?: { devicePublicId: string; deviceToken: string },
    private readonly persistDeviceToken?: PersistDeviceToken,
  ) {}

  async authenticateDevice() {
    if (!this.authenticationInFlight) {
      this.authenticationInFlight = this.performDeviceAuthentication().finally(
        () => {
          this.authenticationInFlight = null;
        },
      );
    }
    return this.authenticationInFlight;
  }

  private async performDeviceAuthentication() {
    if (!this.device?.devicePublicId || !this.device.deviceToken) {
      throw new Error("Bridge device credentials are not available");
    }
    if (!this.persistDeviceToken) {
      throw new Error(
        "A durable device credential persistence callback is required",
      );
    }
    if (this.pendingCredentialPersistence) {
      const pending = this.pendingCredentialPersistence;
      await this.persistRotatedCredential(pending);
      return pending;
    }

    const result = await this.request<DeviceAuthResponse>(
      "/bridge/device/auth",
      {
        method: "POST",
        unauthenticated: true,
        body: {
          devicePublicId: this.device.devicePublicId,
          deviceToken: this.device.deviceToken,
          ...CLAUDE_RUNTIME_COMPATIBILITY,
          capabilities: CLAWCHAT_BRIDGE_CAPABILITIES,
        },
      },
    );
    if (
      result.credentials.devicePublicId !== this.device.devicePublicId ||
      !result.credentials.deviceToken
    ) {
      throw new Error("Bridge authentication returned invalid credentials");
    }
    this.acceptTokens(result.tokens);
    this.pendingCredentialPersistence = result;
    this.device.deviceToken = result.credentials.deviceToken;
    await this.persistRotatedCredential(result);
    return result;
  }

  private async persistRotatedCredential(result: DeviceAuthResponse) {
    if (
      result.credentials.devicePublicId !== this.device?.devicePublicId ||
      !result.credentials.deviceToken
    ) {
      throw new Error("Bridge authentication returned invalid credentials");
    }
    await this.persistDeviceToken?.(
      result.credentials.devicePublicId,
      result.credentials.deviceToken,
    );
    this.pendingCredentialPersistence = null;
  }

  async enroll(code: string, deviceLabel: string) {
    const result = await this.request<EnrollResponse>("/bridge/enroll", {
      method: "POST",
      unauthenticated: true,
      body: {
        code,
        deviceLabel,
        ...CLAUDE_RUNTIME_COMPATIBILITY,
        capabilities: CLAWCHAT_BRIDGE_CAPABILITIES,
      },
    });
    this.acceptTokens(result.tokens);
    return result;
  }

  getAccessToken() {
    if (!this.accessToken) {
      throw new Error("Bridge access token is not available");
    }
    return this.accessToken;
  }

  async ensureAccessToken() {
    if (
      !this.accessToken ||
      Date.now() + TOKEN_REFRESH_SKEW_MS >= this.accessTokenExpiresAt
    ) {
      await this.authenticateDevice();
    }
    return this.getAccessToken();
  }

  async ensureWebSocketToken() {
    if (
      !this.websocketToken ||
      Date.now() + TOKEN_REFRESH_SKEW_MS >= this.websocketTokenExpiresAt
    ) {
      await this.authenticateDevice();
    }
    if (!this.websocketToken) {
      throw new Error("Bridge websocket token is not available");
    }
    return this.websocketToken;
  }

  async postDispatchStarted(dispatchId: string) {
    return this.request(`/bridge/claude-dispatches/start`, {
      method: "POST",
      body: { dispatchId },
    });
  }

  async postDispatchCompleted(
    dispatchId: string,
    input: {
      resultSummary?: string | null;
      resultMetadata?: Record<string, unknown>;
    },
  ) {
    return this.request(`/bridge/claude-dispatches/${dispatchId}/complete`, {
      method: "POST",
      body: input,
    });
  }

  async postDispatchFailed(
    dispatchId: string,
    input: { errorCode: string; errorMessage: string; notifyThread?: boolean },
  ) {
    return this.request(`/bridge/claude-dispatches/${dispatchId}/fail`, {
      method: "POST",
      body: input,
    });
  }

  async postFinalMessage(input: {
    threadId: string;
    threadSessionId: string;
    dispatchId: string;
    senderId: string;
    senderName: string;
    content: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.request<{ id: string }>(`/bridge/messages`, {
      method: "POST",
      body: input,
    });
  }

  async executeRuntimeTool(
    dispatchId: string,
    appSlug: string,
    toolName: string,
    input: Record<string, unknown>,
  ) {
    return this.request(
      `/bridge/runtime-dispatches/${encodeURIComponent(dispatchId)}/marketplace-tools/${encodeURIComponent(appSlug)}/${encodeURIComponent(toolName)}`,
      { method: "POST", body: input },
    );
  }

  async heartbeat(payload: {
    deviceLabel: string;
    activeDispatchCount: number;
    registeredExternalAgentIds: string[];
  }) {
    return this.request(`/bridge/heartbeat`, {
      method: "POST",
      body: payload,
    });
  }

  async synchronizeArtifactCatalogue(input: BridgeArtifactCatalogueInput) {
    return this.request<{
      synchronized: number;
      sourceMachineId: string;
      sourceIdentityId: string;
      refreshedAt: string;
    }>("/bridge/artifacts/sync", {
      method: "POST",
      body: input,
    });
  }

  private async request<T = unknown>(
    pathname: string,
    options: {
      method: string;
      body?: unknown;
      unauthenticated?: boolean;
    },
    allowRetry: boolean = true,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (!options.unauthenticated) {
      headers.Authorization = `Bearer ${await this.ensureAccessToken()}`;
    }

    const response = await fetch(`${this.apiBaseUrl}${pathname}`, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      if (!options.unauthenticated && response.status === 401 && allowRetry) {
        this.clearTokens();
        await this.authenticateDevice();
        return this.request<T>(pathname, options, false);
      }

      const text = await response.text();
      const error = new Error(
        `HTTP ${response.status} ${response.statusText}: ${text}`,
      ) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private acceptTokens(tokens: DeviceAuthResponse["tokens"]) {
    if (
      !tokens.accessToken ||
      !tokens.wsToken ||
      !Number.isSafeInteger(tokens.accessExpiresIn) ||
      tokens.accessExpiresIn < 1 ||
      !Number.isSafeInteger(tokens.wsExpiresIn) ||
      tokens.wsExpiresIn < 1
    ) {
      throw new Error("Bridge authentication returned invalid token metadata");
    }
    const issuedAt = Date.now();
    this.accessToken = tokens.accessToken;
    this.websocketToken = tokens.wsToken;
    this.accessTokenExpiresAt = issuedAt + tokens.accessExpiresIn * 1000;
    this.websocketTokenExpiresAt = issuedAt + tokens.wsExpiresIn * 1000;
  }

  private clearTokens() {
    this.accessToken = null;
    this.websocketToken = null;
    this.accessTokenExpiresAt = 0;
    this.websocketTokenExpiresAt = 0;
  }
}
