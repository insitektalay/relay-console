import { MARKETPLACE_CATALOG } from "../../catalog/marketplace-catalog";
import { AMPLITUDE_CONNECTOR_MANIFEST } from "./amplitude.connector";

describe("Amplitude connector setup metadata", () => {
  const expectedRegionSelector = {
    label: "Amplitude data region",
    inputType: "select",
    options: [
      { value: "https://amplitude.com", label: "Standard" },
      { value: "https://analytics.eu.amplitude.com", label: "EU" },
    ],
    defaultValue: "https://amplitude.com",
  };

  it("publishes the Dashboard REST origin as a Standard/EU selector", () => {
    const connectorRegion =
      AMPLITUDE_CONNECTOR_MANIFEST.auth.credentialSchema.find(
        ({ name }) => name === "AMPLITUDE_DASHBOARD_REST_ORIGIN",
      );
    const catalogRegion = MARKETPLACE_CATALOG.find(
      ({ slug }) => slug === "amplitude",
    )?.credentialRequirements.find(
      ({ name }) => name === "AMPLITUDE_DASHBOARD_REST_ORIGIN",
    );

    expect(connectorRegion).toMatchObject(expectedRegionSelector);
    expect(catalogRegion).toMatchObject(expectedRegionSelector);
  });

  it("explains that Amplitude's onboarding API key is the project API key", () => {
    const projectApiKey = MARKETPLACE_CATALOG.find(
      ({ slug }) => slug === "amplitude",
    )?.credentialRequirements.find(
      ({ name }) => name === "AMPLITUDE_PROJECT_API_KEY",
    );

    expect(projectApiKey?.helpText).toContain("shown during onboarding");
    expect(projectApiKey?.helpText).not.toContain("Do not use an ingestion");
  });
});
