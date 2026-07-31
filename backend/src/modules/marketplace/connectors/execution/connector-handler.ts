import type { MarketplaceConnectionEntity } from "../../../../entities";
import type {
  MarketplaceConnectorExecutorRequest,
  MarketplaceConnectorExecutorResult,
  MarketplaceConnectorManifest,
  MarketplaceConnectorRuntimeTool,
} from "../types";

export type MarketplaceConnectorExecutionContext = {
  request: MarketplaceConnectorExecutorRequest;
  manifest: MarketplaceConnectorManifest;
  tool: MarketplaceConnectorRuntimeTool;
  connection: MarketplaceConnectionEntity;
};

export type MarketplaceConnectorHandler = {
  id: string;
  providerSlugs: readonly string[];
  supportedTools: Readonly<Record<string, readonly string[]>>;
  healthStrategy: string | null;
  credentialSchemaIdentity: string;
  errorMapperIdentity: string;
  execute(
    context: MarketplaceConnectorExecutionContext,
  ): Promise<MarketplaceConnectorExecutorResult>;
};

export type MarketplaceConnectorReleaseProvider = {
  slug: string;
  connectEligible: boolean;
};
