import { BadRequestException } from "@nestjs/common";
import { isIP } from "node:net";
import type { MarketplaceAppDefinition } from "./catalog/marketplace-catalog.types";

const MAX_CREDENTIAL_FIELDS = 64;
const MAX_CREDENTIAL_VALUE_BYTES = 64 * 1024;
const MAX_CREDENTIAL_PAYLOAD_BYTES = 256 * 1024;
const FORBIDDEN_CREDENTIAL_NAMES = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);
const NETWORK_BOUND_CREDENTIAL_NAME =
  /(?:^|_)(?:url|uri|origin|base_url|host|hostname|domain)$/i;

export type NormalizedMarketplaceCredentials = {
  credentialNames: string[];
  credentials: Record<string, string>;
};

export function normalizeMarketplaceCredentials(
  app: Pick<
    MarketplaceAppDefinition,
    "name" | "connectionTypes" | "credentialRequirements"
  >,
  authType: string,
  input: unknown,
): NormalizedMarketplaceCredentials {
  if (!app.connectionTypes.includes(authType)) {
    throw new BadRequestException(
      `${app.name} does not support authentication type ${authType}.`,
    );
  }
  if (
    input == null ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    throw new BadRequestException("Credentials must be a plain object.");
  }

  const requirements = app.credentialRequirements.filter(
    (item) =>
      !item.requiredForAuthTypes?.length ||
      item.requiredForAuthTypes.includes(authType),
  );
  const allowedNames = new Set(requirements.map((item) => item.name));
  const normalizedInput = {
    ...(input as Record<string, unknown>),
  };
  for (const requirement of requirements) {
    const current = normalizedInput[requirement.name];
    if (
      requirement.defaultValue !== undefined &&
      (current === undefined ||
        (typeof current === "string" && !current.trim()))
    ) {
      normalizedInput[requirement.name] = requirement.defaultValue;
    }
  }
  const entries = Object.entries(normalizedInput);
  if (entries.length > MAX_CREDENTIAL_FIELDS) {
    throw new BadRequestException("Too many credential fields were supplied.");
  }

  let totalBytes = 0;
  const credentials = Object.create(null) as Record<string, string>;
  for (const [name, value] of entries) {
    if (FORBIDDEN_CREDENTIAL_NAMES.has(name) || !allowedNames.has(name)) {
      throw new BadRequestException(
        `${app.name} does not accept credential field ${name}.`,
      );
    }
    if (typeof value !== "string") {
      throw new BadRequestException(`Credential ${name} must be a string.`);
    }
    const requirement = requirements.find((item) => item.name === name);
    let normalizedValue = value;
    if (requirement?.inputType === "select") {
      const selectedOption = requirement.options?.find(
        (option) =>
          option.value === value ||
          option.value.toLowerCase() === value.toLowerCase(),
      );
      if (!selectedOption) {
        throw new BadRequestException(
          `Credential ${name} must be one of the supported options.`,
        );
      }
      normalizedValue = selectedOption.value;
    }
    if (normalizedValue.includes("\0")) {
      throw new BadRequestException(
        `Credential ${name} contains invalid data.`,
      );
    }
    if (NETWORK_BOUND_CREDENTIAL_NAME.test(name) && normalizedValue.trim()) {
      assertPublicProviderLocation(name, normalizedValue.trim());
    }
    const valueBytes = Buffer.byteLength(normalizedValue, "utf8");
    if (valueBytes > MAX_CREDENTIAL_VALUE_BYTES) {
      throw new BadRequestException(`Credential ${name} is too large.`);
    }
    totalBytes += Buffer.byteLength(name, "utf8") + valueBytes;
    if (totalBytes > MAX_CREDENTIAL_PAYLOAD_BYTES) {
      throw new BadRequestException("The credential payload is too large.");
    }
    credentials[name] = normalizedValue;
  }

  const requiredNames = requirements
    .filter((item) => item.required)
    .map((item) => item.name);
  const missing = requiredNames.filter((name) => !credentials[name]?.trim());
  if (missing.length) {
    throw new BadRequestException(
      `Missing required credentials: ${missing.join(", ")}`,
    );
  }

  return { credentialNames: requiredNames, credentials };
}

function assertPublicProviderLocation(name: string, value: string) {
  const candidate = value.includes("://") ? value : `https://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new BadRequestException(
      `Credential ${name} must identify a valid provider hostname.`,
    );
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    !host ||
    isIP(host) !== 0 ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new BadRequestException(
      `Credential ${name} must use a public HTTPS provider hostname.`,
    );
  }
  if (!value.includes("://") && (parsed.pathname !== "/" || parsed.search)) {
    throw new BadRequestException(
      `Credential ${name} must contain only a provider hostname.`,
    );
  }
}
