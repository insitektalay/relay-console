import { execFileSync } from "node:child_process"
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const webRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const certDir = join(webRoot, "certificates")
const certPath = join(certDir, "localhost.pem")
const keyPath = join(certDir, "localhost-key.pem")
const mkcertPath = join(
  process.env.HOME ?? "",
  "Library/Caches/mkcert/mkcert-v1.4.4-darwin-arm64"
)

function hasMkcertIssuedCertificate() {
  if (!existsSync(certPath) || !existsSync(keyPath)) {
    return false
  }

  try {
    const issuer = execFileSync("openssl", [
      "x509",
      "-in",
      certPath,
      "-noout",
      "-issuer",
    ]).toString()

    return issuer.includes("mkcert development CA")
  } catch {
    return false
  }
}

if (hasMkcertIssuedCertificate()) {
  process.exit(0)
}

mkdirSync(certDir, { recursive: true })

if (existsSync(mkcertPath)) {
  execFileSync(
    mkcertPath,
    [
      "-key-file",
      keyPath,
      "-cert-file",
      certPath,
      "localhost",
      "127.0.0.1",
      "::1",
    ],
    { cwd: webRoot, stdio: "inherit" }
  )

  chmodSync(keyPath, 0o600)
  process.exit(0)
}

const tempDir = mkdtempSync(join(tmpdir(), "clawchat-local-cert-"))
const configPath = join(tempDir, "openssl.cnf")

writeFileSync(
  configPath,
  [
    "[req]",
    "distinguished_name = req_distinguished_name",
    "x509_extensions = v3_req",
    "prompt = no",
    "",
    "[req_distinguished_name]",
    "CN = localhost",
    "",
    "[v3_req]",
    "basicConstraints = CA:FALSE",
    "keyUsage = digitalSignature, keyEncipherment",
    "extendedKeyUsage = serverAuth",
    "subjectAltName = @alt_names",
    "",
    "[alt_names]",
    "DNS.1 = localhost",
    "IP.1 = 127.0.0.1",
    "IP.2 = ::1",
    "",
  ].join("\n")
)

execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-sha256",
    "-days",
    "3650",
    "-nodes",
    "-keyout",
    keyPath,
    "-out",
    certPath,
    "-config",
    configPath,
    "-extensions",
    "v3_req",
  ],
  { stdio: "inherit" }
)

chmodSync(keyPath, 0o600)
