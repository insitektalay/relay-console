import { BOUNDED_REST_CONNECTOR_BY_SLUG } from "../bounded-rest/bounded-rest-registry";
import { EHR_FHIR_CONNECTOR_SLUGS } from "../ehr-fhir/ehr-fhir.connector";
import type { MarketplaceConnectorManifest } from "../types";
import type {
  MarketplaceConnectorExecutionContext,
  MarketplaceConnectorHandler,
} from "./connector-handler";
import type { NativeExecutorRegistration } from "./native-executor-registration";
import { NATIVE_EXECUTOR_REGISTRATION_BY_SLUG } from "./provider-handlers/native-executor-registry.index";

const PARTNER_FINANCE_SLUGS = [
  "yodlee-fastlink",
  "mx",
  "finicity",
  "plaid-link",
  "etoro",
] as const;

type Executor = MarketplaceConnectorHandler["execute"];

type FactoryInput = {
  manifests: readonly MarketplaceConnectorManifest[];
  executeNative(
    registration: NativeExecutorRegistration,
    context: MarketplaceConnectorExecutionContext,
  ): ReturnType<Executor>;
  executeBoundedRest: Executor;
  executeEhrFhir: Executor;
  executePartnerFinance: Executor;
};

function createHandler(
  id: string,
  manifests: readonly MarketplaceConnectorManifest[],
  providerSlugs: readonly string[],
  healthStrategy: string,
  execute: Executor,
): MarketplaceConnectorHandler {
  const manifestBySlug = new Map(
    manifests.map((manifest) => [manifest.slug, manifest]),
  );
  return {
    id,
    providerSlugs,
    supportedTools: Object.fromEntries(
      providerSlugs.map((slug) => {
        const manifest = manifestBySlug.get(slug);
        if (!manifest) {
          throw new Error(
            `Connector handler ${id} references unknown manifest ${slug}`,
          );
        }
        return [slug, manifest.tools.map((tool) => tool.functionName)];
      }),
    ),
    healthStrategy,
    credentialSchemaIdentity: "connector-manifest-v1",
    errorMapperIdentity: "connector-safe-error-v1",
    execute,
  };
}

export function createMarketplaceConnectorHandlers(
  input: FactoryInput,
): MarketplaceConnectorHandler[] {
  const handlers = [...NATIVE_EXECUTOR_REGISTRATION_BY_SLUG].map(
    ([slug, registration]) =>
      createHandler(
        `native:${slug}`,
        input.manifests,
        [slug],
        "legacy-provider-health-v1",
        (context) => input.executeNative(registration, context),
      ),
  );

  handlers.push(
    createHandler(
      "family:bounded-rest",
      input.manifests,
      [...BOUNDED_REST_CONNECTOR_BY_SLUG.keys()],
      "bounded-rest-health-v1",
      input.executeBoundedRest,
    ),
    createHandler(
      "family:ehr-fhir",
      input.manifests,
      [...EHR_FHIR_CONNECTOR_SLUGS],
      "ehr-fhir-capability-statement-v1",
      input.executeEhrFhir,
    ),
    createHandler(
      "family:partner-finance",
      input.manifests,
      PARTNER_FINANCE_SLUGS,
      "partner-finance-health-v1",
      input.executePartnerFinance,
    ),
  );

  return handlers;
}
