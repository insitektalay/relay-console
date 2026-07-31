import { BadRequestException } from "@nestjs/common";
import type { MarketplaceAppDefinition } from "./catalog/marketplace-catalog.types";
import { normalizeMarketplaceCredentials } from "./marketplace-credential-policy";

describe("Marketplace credential input boundary", () => {
  const app = {
    name: "Example",
    connectionTypes: ["api_key"],
    credentialRequirements: [
      {
        name: "EXAMPLE_API_KEY",
        label: "API key",
        required: true,
        secret: true,
        helpText: "Create a dedicated key.",
      },
      {
        name: "EXAMPLE_ACCOUNT_ID",
        label: "Account ID",
        required: false,
        secret: false,
        helpText: "Optional account binding.",
      },
      {
        name: "EXAMPLE_BASE_URL",
        label: "Provider URL",
        required: false,
        secret: false,
        helpText: "Exact provider tenant URL.",
      },
    ],
  } satisfies Pick<
    MarketplaceAppDefinition,
    "name" | "connectionTypes" | "credentialRequirements"
  >;

  it("accepts only declared string fields and returns required field names", () => {
    const result = normalizeMarketplaceCredentials(app, "api_key", {
      EXAMPLE_API_KEY: "dedicated-secret",
      EXAMPLE_ACCOUNT_ID: "account-1",
    });
    expect(result.credentialNames).toEqual(["EXAMPLE_API_KEY"]);
    expect(result.credentials).toEqual({
      EXAMPLE_API_KEY: "dedicated-secret",
      EXAMPLE_ACCOUNT_ID: "account-1",
    });
  });

  it.each([
    ["unsupported auth type", "password", { EXAMPLE_API_KEY: "secret" }],
    [
      "undeclared field",
      "api_key",
      { EXAMPLE_API_KEY: "secret", password: "no" },
    ],
    ["non-string field", "api_key", { EXAMPLE_API_KEY: 123 }],
    ["missing required field", "api_key", {}],
    [
      "oversized secret",
      "api_key",
      { EXAMPLE_API_KEY: "x".repeat(64 * 1024 + 1) },
    ],
  ])("rejects %s", (_label, authType, credentials) => {
    expect(() =>
      normalizeMarketplaceCredentials(app, authType as string, credentials),
    ).toThrow(BadRequestException);
  });

  it("rejects objects with a non-plain prototype", () => {
    const credentials = Object.create({ EXAMPLE_API_KEY: "inherited" });
    credentials.EXAMPLE_API_KEY = "secret";
    expect(() =>
      normalizeMarketplaceCredentials(app, "api_key", credentials),
    ).toThrow("Credentials must be a plain object");
  });

  it.each([
    "http://provider.example",
    "https://localhost/admin",
    "https://127.0.0.1/",
    "https://169.254.169.254/latest/meta-data",
    "https://user:password@provider.example/",
    "service.internal",
  ])("rejects unsafe customer-supplied provider locations: %s", (value) => {
    expect(() =>
      normalizeMarketplaceCredentials(app, "api_key", {
        EXAMPLE_API_KEY: "secret",
        EXAMPLE_BASE_URL: value,
      }),
    ).toThrow(/public HTTPS provider hostname/);
  });

  it("accepts a public HTTPS tenant location", () => {
    expect(
      normalizeMarketplaceCredentials(app, "api_key", {
        EXAMPLE_API_KEY: "secret",
        EXAMPLE_BASE_URL: "https://tenant.provider.example/api",
      }).credentials.EXAMPLE_BASE_URL,
    ).toBe("https://tenant.provider.example/api");
  });

  it("applies and validates a manifest-defined select default", () => {
    const regionalApp = {
      ...app,
      credentialRequirements: [
        ...app.credentialRequirements,
        {
          name: "EXAMPLE_REGION",
          label: "Account region",
          required: true,
          secret: false,
          helpText: "Choose the account region.",
          inputType: "select" as const,
          options: [
            { value: "standard", label: "Standard" },
            { value: "eu", label: "EU" },
          ],
          defaultValue: "standard",
        },
      ],
    };

    expect(
      normalizeMarketplaceCredentials(regionalApp, "api_key", {
        EXAMPLE_API_KEY: "secret",
      }).credentials.EXAMPLE_REGION,
    ).toBe("standard");
    expect(
      normalizeMarketplaceCredentials(regionalApp, "api_key", {
        EXAMPLE_API_KEY: "secret",
        EXAMPLE_REGION: "Standard",
      }).credentials.EXAMPLE_REGION,
    ).toBe("standard");
    expect(() =>
      normalizeMarketplaceCredentials(regionalApp, "api_key", {
        EXAMPLE_API_KEY: "secret",
        EXAMPLE_REGION: "unsupported",
      }),
    ).toThrow("must be one of the supported options");
  });
});
