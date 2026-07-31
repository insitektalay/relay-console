import { BadRequestException } from "@nestjs/common";
import {
  BRIDGE_RUNTIME_TYPES,
  BridgeRuntimeType,
} from "../bridge/bridge-compatibility-policy";

const CLAUDE_RUNTIME_TYPE = "claude_code";
const OPENCLAW_RUNTIME_TYPE = "openclaw";
const HERMES_RUNTIME_TYPE = "hermes";
const HERMES_ADAPTER_KIND = "hermes_bridge";
const HERMES_BRIDGE_ADAPTER_KINDS = new Set(["bridge", HERMES_ADAPTER_KIND]);

interface GenericRuntimeBindingInput {
  runtimeBinding?: {
    runtimeType: string;
    adapterKind?: string;
    routingMode?: string;
    repoKey?: string | null;
    isEnabled?: boolean;
    capabilities?: Record<string, unknown>;
    configMetadata?: Record<string, unknown>;
  } | null;
}

export function requireBridgeRuntimeType(
  value: string | null | undefined,
): BridgeRuntimeType {
  const runtimeType = BRIDGE_RUNTIME_TYPES.find(
    (candidate) => candidate === value,
  );
  if (!runtimeType) {
    throw new BadRequestException(
      "The runtime binding is not supported by a paired bridge device",
    );
  }
  return runtimeType;
}

export function defaultAdapterKindForRuntime(runtimeType: string): string {
  return runtimeType === HERMES_RUNTIME_TYPE
    ? HERMES_ADAPTER_KIND
    : "runtime_adapter";
}

export function resolveGenericRuntimeBindingInput(
  input: GenericRuntimeBindingInput,
) {
  const runtimeType = input.runtimeBinding?.runtimeType?.trim().toLowerCase();
  if (
    !runtimeType ||
    runtimeType === CLAUDE_RUNTIME_TYPE ||
    runtimeType === OPENCLAW_RUNTIME_TYPE
  ) {
    return null;
  }
  const rawRuntimeBinding = input.runtimeBinding as unknown as Record<
    string,
    unknown
  >;
  const configMetadata = {
    ...(input.runtimeBinding?.configMetadata ?? {}),
  };
  if (
    runtimeType === HERMES_RUNTIME_TYPE &&
    ("workspaceRoot" in rawRuntimeBinding ||
      "workspaceRoot" in configMetadata ||
      "repoPath" in configMetadata ||
      "cwd" in configMetadata)
  ) {
    throw new BadRequestException(
      "Hermes runtime bindings accept only an opaque repoKey, not a host path",
    );
  }
  const repoKey = input.runtimeBinding?.repoKey?.trim() || null;
  if (
    runtimeType === HERMES_RUNTIME_TYPE &&
    repoKey &&
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(repoKey)
  ) {
    throw new BadRequestException("Hermes repoKey is invalid");
  }
  const adapterKind =
    input.runtimeBinding?.adapterKind?.trim() ||
    defaultAdapterKindForRuntime(runtimeType);
  const defaultCapabilities =
    runtimeType === HERMES_RUNTIME_TYPE
      ? {
          streamText: true,
          cancelRun: true,
          resumeSession: true,
          toolActivity: "coarse",
          workspaceExecution: true,
          bridgeBacked: HERMES_BRIDGE_ADAPTER_KINDS.has(
            adapterKind.toLowerCase(),
          ),
          requiresExternalRuntimePresence: true,
        }
      : {};
  return {
    runtimeType,
    adapterKind,
    routingMode: input.runtimeBinding?.routingMode?.trim() || "explicit_only",
    repoKey,
    isEnabled: input.runtimeBinding?.isEnabled ?? true,
    capabilities: {
      ...defaultCapabilities,
      ...(input.runtimeBinding?.capabilities ?? {}),
    },
    configMetadata,
  };
}
