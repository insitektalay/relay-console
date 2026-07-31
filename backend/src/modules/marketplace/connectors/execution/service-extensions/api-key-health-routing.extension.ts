import type { MarketplaceConnectionEntity } from "../../../../../entities";
import type { MarketplaceConnectorExecutionService } from "../../connector-execution.service";
import { BOUNDED_REST_CONNECTOR_BY_SLUG } from "../../bounded-rest/bounded-rest-registry";
import { EHR_FHIR_CONNECTOR_SLUGS } from "../../ehr-fhir/ehr-fhir.connector";
import type { MarketplaceConnectorManifest } from "../../types";
import { API_KEY_HEALTH_HANDLER_BY_SLUG } from "../provider-health/api-key-health-registry.index";

export const ApiKeyHealthRoutingExtension = {
  async validateApiKeyConnectorHealth(
    this: MarketplaceConnectorExecutionService,
    manifest: MarketplaceConnectorManifest,
    connection: MarketplaceConnectionEntity,
  ): Promise<void> {
    const stored = this.credentials.decrypt(connection);
    const boundedRest = BOUNDED_REST_CONNECTOR_BY_SLUG.get(manifest.slug);
    if (boundedRest) {
      await this.boundedRestApi.health(boundedRest, stored);
      return;
    }
    if (EHR_FHIR_CONNECTOR_SLUGS.has(manifest.slug)) {
      await this.ehrFhirApi.capabilityStatement(
        this.ehrFhirCredentials(stored),
      );
      return;
    }
    const handler = API_KEY_HEALTH_HANDLER_BY_SLUG[manifest.slug];
    if (handler) {
      await handler.call(this, manifest, connection, stored);
    }
  },
};
