import { X509Certificate } from "node:crypto"
import { isIP } from "node:net"
import { checkServerIdentity } from "node:tls"
import { domainToASCII } from "node:url"

const MAX_CA_BUNDLE_BYTES = 64 * 1024
const MAX_CA_CERTIFICATES = 10
const MIN_CA_VALIDITY_MS = 24 * 60 * 60 * 1000
const CERTIFICATE_PATTERN =
  /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g

function invalidConfiguration(detail) {
  throw new Error(`Production database TLS configuration is invalid: ${detail}`)
}

function decodeAndValidateCa(encoded, now = new Date()) {
  const compact = String(encoded || "").replace(/\s/g, "")
  if (
    !compact ||
    compact.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)
  ) {
    invalidConfiguration(
      "DATABASE_CA_CERT_BASE64 must be canonical base64 containing a PEM CA bundle.",
    )
  }

  const decoded = Buffer.from(compact, "base64")
  if (
    !decoded.length ||
    decoded
      .toString("base64")
      .replace(/=+$/, "") !== compact.replace(/=+$/, "") ||
    decoded.length > MAX_CA_BUNDLE_BYTES
  ) {
    invalidConfiguration(
      "DATABASE_CA_CERT_BASE64 is not canonical base64 or exceeds the 64 KiB limit.",
    )
  }
  const pem = decoded.toString("utf8")
  if (!Buffer.from(pem, "utf8").equals(decoded)) {
    invalidConfiguration("the decoded CA bundle must be UTF-8 PEM.")
  }

  const certificates = pem.match(CERTIFICATE_PATTERN) || []
  if (
    !certificates.length ||
    certificates.length > MAX_CA_CERTIFICATES ||
    pem.replace(CERTIFICATE_PATTERN, "").trim()
  ) {
    invalidConfiguration(
      `the CA bundle must contain between 1 and ${MAX_CA_CERTIFICATES} PEM certificates and no other content.`,
    )
  }
  const minimumExpiry = now.getTime() + MIN_CA_VALIDITY_MS
  for (const certificatePem of certificates) {
    let certificate
    try {
      certificate = new X509Certificate(certificatePem)
    } catch {
      invalidConfiguration("the CA bundle contains an invalid certificate.")
    }
    if (!certificate.ca) {
      invalidConfiguration(
        "DATABASE_CA_CERT_BASE64 must contain CA certificates, not a leaf certificate.",
      )
    }
    const validFrom = Date.parse(certificate.validFrom)
    const validTo = Date.parse(certificate.validTo)
    if (
      !Number.isFinite(validFrom) ||
      !Number.isFinite(validTo) ||
      validFrom > now.getTime() ||
      validTo < minimumExpiry
    ) {
      invalidConfiguration(
        "the CA bundle contains a certificate that is not currently valid for at least 24 hours.",
      )
    }
  }
  return pem
}

function validateExpectedIdentity(value) {
  const identity = String(value || "").trim()
  if (!identity || identity.length > 253 || identity.includes("*")) {
    invalidConfiguration(
      "DATABASE_TLS_SERVER_NAME must be an exact DNS name or IP address with no wildcard.",
    )
  }
  if (isIP(identity)) return identity
  const ascii = domainToASCII(identity)
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
    invalidConfiguration(
      "DATABASE_TLS_SERVER_NAME must be an exact DNS name or IP address with no wildcard.",
    )
  }
  return ascii.toLowerCase()
}

function validateConnectionString(connectionString) {
  let parsed
  try {
    parsed = new URL(connectionString)
  } catch {
    invalidConfiguration("the database connection string must be a valid URL.")
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    invalidConfiguration(
      "the database connection string must use postgres: or postgresql:.",
    )
  }
  if (
    [...parsed.searchParams.keys()].some((key) => {
      const normalized = key.toLowerCase()
      return normalized.startsWith("ssl") || normalized === "uselibpqcompat"
    })
  ) {
    invalidConfiguration(
      "database URLs must not contain SSL query parameters; the pinned TLS policy is authoritative.",
    )
  }
}

export function buildVerifiedPostgresClientConfig(
  env = process.env,
  connectionString = String(env.DATABASE_URL || "").trim(),
) {
  if (connectionString) validateConnectionString(connectionString)
  const ca = decodeAndValidateCa(env.DATABASE_CA_CERT_BASE64)
  const expectedIdentity = validateExpectedIdentity(
    env.DATABASE_TLS_SERVER_NAME,
  )
  const ssl = Object.freeze({
    ca,
    checkServerIdentity: (_connectionHostname, certificate) =>
      checkServerIdentity(expectedIdentity, certificate),
    minVersion: "TLSv1.2",
    rejectUnauthorized: true,
  })

  if (connectionString) return { connectionString, ssl }
  return {
    host: String(env.DATABASE_HOST || "").trim(),
    port: Number(env.DATABASE_PORT || 5432),
    database: String(env.DATABASE_NAME || "").trim(),
    user: String(env.DATABASE_USER || "").trim(),
    password: String(env.DATABASE_PASSWORD || ""),
    ssl,
  }
}
