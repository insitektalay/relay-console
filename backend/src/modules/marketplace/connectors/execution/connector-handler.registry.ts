import type {
  MarketplaceConnectorHandler,
  MarketplaceConnectorReleaseProvider,
} from "./connector-handler";
import type {
  MarketplaceConnectorManifest,
  MarketplaceConnectorRuntimeTool,
} from "../types";

type ToolOwner = {
  handler: MarketplaceConnectorHandler;
  tool: MarketplaceConnectorRuntimeTool;
};

function normalize(value: string) {
  return String(value ?? "").trim();
}

function toolNames(tool: MarketplaceConnectorRuntimeTool) {
  return [tool.name, tool.functionName, ...(tool.aliases ?? [])].map(normalize);
}

export class MarketplaceConnectorHandlerRegistry {
  private readonly handlersBySlug = new Map<
    string,
    MarketplaceConnectorHandler
  >();
  private readonly toolsBySlug = new Map<string, Map<string, ToolOwner>>();

  constructor(
    manifests: readonly MarketplaceConnectorManifest[],
    handlers: readonly MarketplaceConnectorHandler[],
    releaseProviders: readonly MarketplaceConnectorReleaseProvider[] = [],
  ) {
    const manifestBySlug = new Map(
      manifests.map((manifest) => [manifest.slug, manifest]),
    );

    for (const handler of handlers) {
      this.validateHandlerMetadata(handler);
      for (const slug of handler.providerSlugs) {
        const manifest = manifestBySlug.get(slug);
        if (!manifest) {
          throw new Error(
            `Connector handler ${handler.id} references unknown manifest ${slug}`,
          );
        }
        const existing = this.handlersBySlug.get(slug);
        if (existing) {
          throw new Error(
            `Connector handlers ${existing.id} and ${handler.id} both own ${slug}`,
          );
        }
        this.handlersBySlug.set(slug, handler);
        this.toolsBySlug.set(slug, this.indexTools(slug, manifest, handler));
      }
    }

    for (const provider of releaseProviders) {
      if (!provider.connectEligible) continue;
      const manifest = manifestBySlug.get(provider.slug);
      if (!manifest) {
        throw new Error(
          `Connect-eligible provider ${provider.slug} has no connector manifest`,
        );
      }
      const handler = this.handlersBySlug.get(provider.slug);
      if (!handler) {
        throw new Error(
          `Connect-eligible provider ${provider.slug} has no connector handler`,
        );
      }
      if (!handler.healthStrategy) {
        throw new Error(
          `Connect-eligible provider ${provider.slug} has no health strategy`,
        );
      }
    }
  }

  resolve(providerSlug: string, toolName: string) {
    const normalizedSlug = normalize(providerSlug);
    const owner = this.toolsBySlug
      .get(normalizedSlug)
      ?.get(normalize(toolName));
    if (!owner) return null;
    return {
      handler: owner.handler,
      tool: owner.tool,
    };
  }

  getHandler(providerSlug: string) {
    return this.handlersBySlug.get(normalize(providerSlug)) ?? null;
  }

  coverage() {
    return [...this.handlersBySlug.entries()]
      .map(([providerSlug, handler]) => ({
        providerSlug,
        handlerId: handler.id,
        healthStrategy: handler.healthStrategy,
        supportedTools: [
          ...new Set(
            [...(this.toolsBySlug.get(providerSlug)?.values() ?? [])].map(
              ({ tool }) => tool.functionName,
            ),
          ),
        ].sort(),
      }))
      .sort((left, right) =>
        left.providerSlug.localeCompare(right.providerSlug),
      );
  }

  private validateHandlerMetadata(handler: MarketplaceConnectorHandler) {
    if (!handler.id.trim()) {
      throw new Error("Connector handler id cannot be empty");
    }
    if (
      !handler.credentialSchemaIdentity.trim() ||
      !handler.errorMapperIdentity.trim()
    ) {
      throw new Error(
        `Connector handler ${handler.id} must declare credential and error mapper identities`,
      );
    }
    if (handler.providerSlugs.length === 0) {
      throw new Error(
        `Connector handler ${handler.id} must own at least one provider`,
      );
    }
  }

  private indexTools(
    slug: string,
    manifest: MarketplaceConnectorManifest,
    handler: MarketplaceConnectorHandler,
  ) {
    const declared = new Set(
      (handler.supportedTools[slug] ?? []).map(normalize),
    );
    const owners = new Map<string, ToolOwner>();

    for (const tool of manifest.tools) {
      if (!declared.has(tool.functionName)) {
        throw new Error(
          `Connector handler ${handler.id} does not own advertised tool ${slug}/${tool.functionName}`,
        );
      }
      for (const name of toolNames(tool)) {
        const existing = owners.get(name);
        if (existing && existing.tool.functionName !== tool.functionName) {
          throw new Error(
            `Connector tools ${existing.tool.functionName} and ${tool.functionName} both own ${slug}/${name}`,
          );
        }
        owners.set(name, { handler, tool });
      }
    }

    for (const functionName of declared) {
      if (!manifest.tools.some((tool) => tool.functionName === functionName)) {
        throw new Error(
          `Connector handler ${handler.id} declares unknown tool ${slug}/${functionName}`,
        );
      }
    }
    return owners;
  }
}
