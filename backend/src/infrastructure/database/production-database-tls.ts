import { X509Certificate } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { isAbsolute } from "path";
import { checkServerIdentity, PeerCertificate } from "tls";
import { domainToASCII } from "url";

const MAX_CA_BUNDLE_BYTES = 64 * 1024;
const MAX_CA_CERTIFICATES = 10;
const MIN_CA_VALIDITY_MS = 24 * 60 * 60 * 1000;
const CERTIFICATE_PATTERN =
  /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;

export type VerifiedDatabaseTlsOptions = {
  ca: string;
  checkServerIdentity: (
    hostname: string,
    certificate: PeerCertificate,
  ) => Error | undefined;
  minVersion: "TLSv1.2";
  rejectUnauthorized: true;
};

export type VerifiedLibpqConnection = {
  ca: string;
  environment: NodeJS.ProcessEnv;
};

function invalidConfiguration(detail: string): never {
  throw new Error(`Production database TLS configuration is invalid: ${detail}`);
}

function decodeBase64CertificateBundle(encoded: string | undefined): string {
  const compact = encoded?.replace(/\s/g, "") ?? "";
  if (
    !compact ||
    compact.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)
  ) {
    return invalidConfiguration(
      "DATABASE_CA_CERT_BASE64 must be canonical base64 containing a PEM CA bundle.",
    );
  }

  const decoded = Buffer.from(compact, "base64");
  const canonical = decoded.toString("base64");
  if (
    !decoded.length ||
    canonical.replace(/=+$/, "") !== compact.replace(/=+$/, "")
  ) {
    return invalidConfiguration(
      "DATABASE_CA_CERT_BASE64 must be canonical base64 containing a PEM CA bundle.",
    );
  }
  if (decoded.length > MAX_CA_BUNDLE_BYTES) {
    return invalidConfiguration(
      `the decoded CA bundle exceeds ${MAX_CA_BUNDLE_BYTES} bytes.`,
    );
  }

  const pem = decoded.toString("utf8");
  if (!Buffer.from(pem, "utf8").equals(decoded)) {
    return invalidConfiguration("the decoded CA bundle must be UTF-8 PEM.");
  }
  return pem;
}

function validateCertificateBundle(pem: string, now: Date): void {
  const certificates = pem.match(CERTIFICATE_PATTERN) ?? [];
  const remainder = pem.replace(CERTIFICATE_PATTERN, "").trim();
  if (
    !certificates.length ||
    certificates.length > MAX_CA_CERTIFICATES ||
    remainder
  ) {
    invalidConfiguration(
      `the CA bundle must contain between 1 and ${MAX_CA_CERTIFICATES} PEM certificates and no other content.`,
    );
  }

  const minimumExpiry = now.getTime() + MIN_CA_VALIDITY_MS;
  for (const certificatePem of certificates) {
    let certificate: X509Certificate;
    try {
      certificate = new X509Certificate(certificatePem);
    } catch {
      invalidConfiguration("the CA bundle contains an invalid certificate.");
    }
    if (!certificate.ca) {
      invalidConfiguration(
        "DATABASE_CA_CERT_BASE64 must contain CA certificates, not a leaf certificate.",
      );
    }

    const validFrom = Date.parse(certificate.validFrom);
    const validTo = Date.parse(certificate.validTo);
    if (
      !Number.isFinite(validFrom) ||
      !Number.isFinite(validTo) ||
      validFrom > now.getTime() ||
      validTo < minimumExpiry
    ) {
      invalidConfiguration(
        "the CA bundle contains a certificate that is not currently valid for at least 24 hours.",
      );
    }
  }
}

function validateExpectedIdentity(value: string | undefined): string {
  const identity = value?.trim() ?? "";
  if (!identity || identity.length > 253 || identity.includes("*")) {
    return invalidConfiguration(
      "DATABASE_TLS_SERVER_NAME must be an exact DNS name or IP address with no wildcard.",
    );
  }
  if (isIP(identity)) return identity;

  const ascii = domainToASCII(identity);
  if (
    !ascii ||
    ascii.length > 253 ||
    ascii.startsWith(".") ||
    ascii.endsWith(".") ||
    !ascii.split(".").every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label),
    )
  ) {
    return invalidConfiguration(
      "DATABASE_TLS_SERVER_NAME must be an exact DNS name or IP address with no wildcard.",
    );
  }
  return ascii.toLowerCase();
}

function parseAndValidateDatabaseUrl(
  databaseUrl: string | undefined,
): URL | undefined {
  if (!databaseUrl?.trim()) return;

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    invalidConfiguration("DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    invalidConfiguration("DATABASE_URL must use postgres: or postgresql:.");
  }

  const unsafeParameter = [...parsed.searchParams.keys()].find((key) => {
    const normalized = key.toLowerCase();
    return normalized.startsWith("ssl") || normalized === "uselibpqcompat";
  });
  if (unsafeParameter) {
    invalidConfiguration(
      "DATABASE_URL must not contain SSL query parameters; the pinned application TLS policy is authoritative.",
    );
  }
  return parsed;
}

export function buildVerifiedDatabaseTlsOptions(
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
): VerifiedDatabaseTlsOptions {
  parseAndValidateDatabaseUrl(env.DATABASE_URL);
  const ca = decodeBase64CertificateBundle(env.DATABASE_CA_CERT_BASE64);
  validateCertificateBundle(ca, now);
  const expectedIdentity = validateExpectedIdentity(
    env.DATABASE_TLS_SERVER_NAME,
  );

  return Object.freeze({
    ca,
    checkServerIdentity: (
      _connectionHostname: string,
      certificate: PeerCertificate,
    ) => checkServerIdentity(expectedIdentity, certificate),
    minVersion: "TLSv1.2" as const,
    rejectUnauthorized: true as const,
  });
}

export async function buildVerifiedLibpqConnection(
  env: NodeJS.ProcessEnv,
  connectionString: string,
  caFilePath: string,
  resolveHostname: (
    hostname: string,
  ) => Promise<{ address: string }> = (hostname) => lookup(hostname),
): Promise<VerifiedLibpqConnection> {
  if (!isAbsolute(caFilePath)) {
    invalidConfiguration("the libpq CA file path must be absolute.");
  }
  const parsed = parseAndValidateDatabaseUrl(connectionString);
  if (!parsed?.hostname) {
    return invalidConfiguration(
      "a PostgreSQL URL with a hostname is required for verified libpq TLS.",
    );
  }

  const tls = buildVerifiedDatabaseTlsOptions({
    ...env,
    DATABASE_URL: connectionString,
  });
  let resolved: { address: string };
  try {
    resolved = await resolveHostname(parsed.hostname);
  } catch {
    return invalidConfiguration(
      "the database hostname could not be resolved for verified libpq TLS.",
    );
  }
  if (!isIP(resolved.address)) {
    return invalidConfiguration(
      "database DNS resolution did not return a valid IP address.",
    );
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!databaseName || databaseName.includes("/")) {
    return invalidConfiguration(
      "the PostgreSQL URL must contain exactly one database name.",
    );
  }

  return {
    ca: tls.ca,
    environment: {
      ...process.env,
      ...env,
      PGDATABASE: databaseName,
      PGHOST: validateExpectedIdentity(env.DATABASE_TLS_SERVER_NAME),
      PGHOSTADDR: resolved.address,
      PGPASSWORD: decodeURIComponent(parsed.password),
      PGPORT: parsed.port || "5432",
      PGSSLMODE: "verify-full",
      PGSSLROOTCERT: caFilePath,
      PGSSLSNI: "1",
      PGUSER: decodeURIComponent(parsed.username),
    },
  };
}

export function databaseTlsForEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): false | VerifiedDatabaseTlsOptions {
  return env.NODE_ENV === "production"
    ? buildVerifiedDatabaseTlsOptions(env)
    : false;
}
