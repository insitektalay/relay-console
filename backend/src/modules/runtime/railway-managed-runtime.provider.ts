import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "crypto";
import { ManagedRuntimeEntity } from "../../entities";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

@Injectable()
export class RailwayManagedRuntimeProvider {
  private readonly endpoint = "https://backboard.railway.com/graphql/v2";

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    const credentialMasterKey = this.config
      .get<string>("MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY")
      ?.trim();
    return Boolean(
      this.config.get<string>("RELAY_MANAGED_RAILWAY_TOKEN")?.trim() &&
      this.config.get<string>("RELAY_MANAGED_RAILWAY_PROJECT_ID")?.trim() &&
      this.config.get<string>("RELAY_MANAGED_RAILWAY_ENVIRONMENT_ID")?.trim() &&
      this.config.get<string>("RELAY_MANAGED_HERMES_IMAGE")?.trim() &&
      credentialMasterKey &&
      Buffer.byteLength(credentialMasterKey, "utf8") >= 32,
    );
  }

  async provision(runtime: ManagedRuntimeEntity) {
    this.requireConfigured();
    const managedHermesImage = this.managedHermesImage();
    const projectId = this.required("RELAY_MANAGED_RAILWAY_PROJECT_ID");
    const environmentId = this.required("RELAY_MANAGED_RAILWAY_ENVIRONMENT_ID");
    const serviceName = this.serviceName(runtime.id);
    let serviceId = runtime.providerRuntimeReference;
    if (!serviceId) {
      serviceId = await this.findServiceId(projectId, serviceName);
    }
    if (!serviceId) {
      const created = await this.graphql<{
        serviceCreate: { id: string };
      }>(
        `mutation serviceCreate($input: ServiceCreateInput!) {
          serviceCreate(input: $input) { id }
        }`,
        {
          input: {
            projectId,
            name: serviceName,
            source: { image: managedHermesImage },
          },
        },
      );
      serviceId = created.serviceCreate.id;
    }

    let volumeId = runtime.providerVolumeReference;
    if (!volumeId) {
      volumeId = await this.findVolumeId(
        projectId,
        `relay-hermes-data-${runtime.id}`,
      );
    }
    if (!volumeId) {
      const created = await this.graphql<{ volumeCreate: { id: string } }>(
        `mutation volumeCreate($input: VolumeCreateInput!) {
          volumeCreate(input: $input) { id }
        }`,
        {
          input: {
            projectId,
            serviceId,
            mountPath: "/data",
            name: `relay-hermes-data-${runtime.id}`,
          },
        },
      );
      volumeId = created.volumeCreate.id;
    }

    await this.setVariables({
      projectId,
      environmentId,
      serviceId,
      variables: {
        HERMES_HOME: "/data/hermes",
        HERMES_WORKSPACE_ROOT: "/data/workspace",
        HERMES_WORKSPACE_KEY: runtime.id,
        HERMES_WORKER_ENV: "production",
        HERMES_WORKER_HOST: "0.0.0.0",
        HERMES_WORKER_PORT: "8765",
        HERMES_WORKER_SHARED_SECRET: this.workerSecret(runtime.id),
        HERMES_WORKER_DISABLED_TOOLSETS: "session_search,terminal",
        HERMES_WORKER_FORBIDDEN_TOOLSETS: "session_search,terminal",
        HERMES_WORKER_MAX_ACTIVE_RUNS: "8",
        RELAY_MANAGED_RUNTIME_ID: runtime.id,
        RELAY_MANAGED_WORKSPACE_ID: runtime.workspaceId,
      },
    });

    const deployment = await this.graphql<{
      serviceInstanceDeploy: string;
    }>(
      `mutation serviceInstanceDeploy($serviceId: String!, $environmentId: String!) {
        serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId)
      }`,
      { serviceId, environmentId },
    );
    return {
      serviceId,
      volumeId,
      serviceName,
      deploymentId: deployment.serviceInstanceDeploy,
      workerBaseUrl: this.privateWorkerBaseUrl(runtime.id),
    };
  }

  async decommission(runtime: ManagedRuntimeEntity) {
    this.requireConfigured();
    // Cancellation has already passed Relay's retention window before this is
    // called. Railway volume deletion has its own provider recovery window.
    if (runtime.providerVolumeReference) {
      await this.graphql<{ volumeDelete: boolean }>(
        `mutation volumeDelete($volumeId: String!) {
          volumeDelete(volumeId: $volumeId)
        }`,
        { volumeId: runtime.providerVolumeReference },
      );
    }
    if (runtime.providerRuntimeReference) {
      await this.graphql<{ serviceDelete: boolean }>(
        `mutation serviceDelete($serviceId: String!) {
          serviceDelete(id: $serviceId)
        }`,
        { serviceId: runtime.providerRuntimeReference },
      );
    }
    return {
      serviceDeleted: Boolean(runtime.providerRuntimeReference),
      volumeDeletionRequested: Boolean(runtime.providerVolumeReference),
    };
  }

  async authorizeModel(
    runtime: ManagedRuntimeEntity,
    input: { provider: string; credential: string },
  ) {
    this.requireConfigured();
    if (!runtime.providerRuntimeReference) {
      throw new ConflictException("MANAGED_RUNTIME_NOT_PROVISIONED");
    }
    const variableName = this.modelCredentialVariable(input.provider);
    if (
      input.credential.trim().length < 12 ||
      input.credential.length > 8_192
    ) {
      throw new ConflictException("MANAGED_RUNTIME_MODEL_CREDENTIAL_INVALID");
    }
    await this.setVariables({
      projectId: this.required("RELAY_MANAGED_RAILWAY_PROJECT_ID"),
      environmentId: this.required("RELAY_MANAGED_RAILWAY_ENVIRONMENT_ID"),
      serviceId: runtime.providerRuntimeReference,
      variables: {
        [variableName]: input.credential,
        HERMES_DEFAULT_MODEL:
          this.config
            .get<string>(
              `RELAY_MANAGED_${input.provider.toUpperCase()}_DEFAULT_MODEL`,
            )
            ?.trim() ||
          (input.provider === "anthropic"
            ? "anthropic/claude-sonnet-4.5"
            : "openai/gpt-5"),
      },
    });
    await this.deploy(runtime.providerRuntimeReference);
    return { variableName, credentialPersistedInRelayDatabase: false };
  }

  async health(runtime: ManagedRuntimeEntity) {
    if (!runtime.providerRuntimeReference) {
      return {
        status: "pending",
        deploymentId: null,
        createdAt: null,
        storageUsedBytes: null,
      };
    }
    const data = await this.graphql<{
      deployments: {
        edges: Array<{
          node: { id: string; status: string; createdAt: string };
        }>;
      };
    }>(
      `query deployments($input: DeploymentListInput!) {
        deployments(input: $input, first: 1) {
          edges { node { id status createdAt } }
        }
      }`,
      {
        input: {
          projectId: this.required("RELAY_MANAGED_RAILWAY_PROJECT_ID"),
          serviceId: runtime.providerRuntimeReference,
          environmentId: this.required("RELAY_MANAGED_RAILWAY_ENVIRONMENT_ID"),
        },
      },
    );
    const deployment = data.deployments.edges[0]?.node ?? null;
    const status = deployment?.status?.toLowerCase() ?? "missing";
    const storageUsedBytes =
      status === "success" ? await this.workerStorageUsedBytes(runtime) : null;
    return {
      status,
      deploymentId: deployment?.id ?? null,
      createdAt: deployment?.createdAt ?? null,
      storageUsedBytes,
    };
  }

  async suspend(runtime: ManagedRuntimeEntity) {
    const health = await this.health(runtime);
    if (!health.deploymentId) return health;
    await this.graphql<{ deploymentStop: boolean }>(
      `mutation deploymentStop($id: String!) { deploymentStop(id: $id) }`,
      { id: health.deploymentId },
    );
    return { ...health, status: "stopped" };
  }

  async resume(runtime: ManagedRuntimeEntity) {
    if (!runtime.providerRuntimeReference) {
      throw new ConflictException("MANAGED_RUNTIME_NOT_PROVISIONED");
    }
    return {
      deploymentId: await this.deploy(runtime.providerRuntimeReference),
    };
  }

  workerTarget(runtime: ManagedRuntimeEntity) {
    return {
      baseUrl: this.privateWorkerBaseUrl(runtime.id),
      sharedSecret: this.workerSecret(runtime.id),
      workspaceKey: runtime.id,
    };
  }

  private async workerStorageUsedBytes(runtime: ManagedRuntimeEntity) {
    const target = this.workerTarget(runtime);
    if (!target) return null;
    try {
      const response = await fetch(`${target.baseUrl}/health`, {
        headers: { Authorization: `Bearer ${target.sharedSecret}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as {
        storageUsedBytes?: unknown;
      };
      const value = Number(body.storageUsedBytes);
      return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
    } catch {
      return null;
    }
  }

  private async deploy(serviceId: string) {
    const result = await this.graphql<{ serviceInstanceDeploy: string }>(
      `mutation serviceInstanceDeploy($serviceId: String!, $environmentId: String!) {
        serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId)
      }`,
      {
        serviceId,
        environmentId: this.required("RELAY_MANAGED_RAILWAY_ENVIRONMENT_ID"),
      },
    );
    return result.serviceInstanceDeploy;
  }

  private async findServiceId(projectId: string, name: string) {
    const data = await this.graphql<{
      project: {
        services: { edges: Array<{ node: { id: string; name: string } }> };
      };
    }>(
      `query project($id: String!) {
        project(id: $id) { services { edges { node { id name } } } }
      }`,
      { id: projectId },
    );
    return (
      data.project.services.edges.find((edge) => edge.node.name === name)?.node
        .id ?? null
    );
  }

  private async findVolumeId(projectId: string, name: string) {
    const data = await this.graphql<{
      project: {
        volumes: { edges: Array<{ node: { id: string; name: string } }> };
      };
    }>(
      `query projectVolumes($projectId: String!) {
        project(id: $projectId) {
          volumes { edges { node { id name } } }
        }
      }`,
      { projectId },
    );
    return (
      data.project.volumes.edges.find((edge) => edge.node.name === name)?.node
        .id ?? null
    );
  }

  private async setVariables(input: {
    projectId: string;
    environmentId: string;
    serviceId: string;
    variables: Record<string, string>;
  }) {
    await this.graphql<{ variableCollectionUpsert: boolean }>(
      `mutation variableCollectionUpsert($input: VariableCollectionUpsertInput!) {
        variableCollectionUpsert(input: $input)
      }`,
      { input: { ...input, skipDeploys: true } },
    );
  }

  private modelCredentialVariable(provider: string) {
    switch (provider.trim().toLowerCase()) {
      case "anthropic":
        return "ANTHROPIC_API_KEY";
      case "openai":
        return "OPENAI_API_KEY";
      default:
        throw new ConflictException(
          "MANAGED_RUNTIME_MODEL_PROVIDER_UNSUPPORTED",
        );
    }
  }

  private managedHermesImage() {
    const image = this.required("RELAY_MANAGED_HERMES_IMAGE");
    if (!/@sha256:[a-f0-9]{64}$/i.test(image)) {
      throw new ServiceUnavailableException(
        "RELAY_MANAGED_HERMES_IMAGE_MUST_BE_DIGEST_PINNED",
      );
    }
    return image;
  }

  private workerSecret(runtimeId: string) {
    const masterKey = this.required("MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY");
    if (Buffer.byteLength(masterKey, "utf8") < 32) {
      throw new ServiceUnavailableException(
        "MANAGED_RUNTIME_CREDENTIAL_MASTER_KEY_TOO_SHORT",
      );
    }
    return createHmac(
      "sha256",
      masterKey,
    )
      .update(`hermes-worker:${runtimeId}`)
      .digest("base64url");
  }

  private serviceName(runtimeId: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,47}$/.test(runtimeId)) {
      throw new ServiceUnavailableException("MANAGED_RUNTIME_ID_INVALID");
    }
    return `relay-hermes-${runtimeId.toLowerCase()}`;
  }

  private privateWorkerBaseUrl(runtimeId: string) {
    return `http://${this.serviceName(runtimeId)}.railway.internal:8765`;
  }

  private async graphql<T>(query: string, variables: Record<string, unknown>) {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.required("RELAY_MANAGED_RAILWAY_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `MANAGED_RAILWAY_HTTP_${response.status}`,
      );
    }
    const result = (await response.json()) as GraphQLResponse<T>;
    if (result.errors?.length || !result.data) {
      throw new ServiceUnavailableException({
        code: "MANAGED_RAILWAY_GRAPHQL_ERROR",
        errors: result.errors?.map((error) => error.message ?? "unknown") ?? [],
      });
    }
    return result.data;
  }

  private requireConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "MANAGED_RUNTIME_PROVIDER_NOT_CONFIGURED",
      );
    }
  }

  private required(name: string) {
    const value = this.config.get<string>(name)?.trim();
    if (!value) throw new ServiceUnavailableException(`${name}_REQUIRED`);
    return value;
  }
}
