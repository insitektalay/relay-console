import { X509Certificate } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildVerifiedLibpqConnection,
  buildVerifiedDatabaseTlsOptions,
  databaseTlsForEnvironment,
} from "./production-database-tls";

const ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIC6DCCAdCgAwIBAgIJAIR6j0OOLwLXMA0GCSqGSIb3DQEBCwUAMCExHzAdBgNV
BAMMFkNsYXdDaGF0IE0wNiBUZXN0IFJvb3QwHhcNMjYwNzI3MjAxNTIzWhcNMzYw
NzI0MjAxNTIzWjAhMR8wHQYDVQQDDBZDbGF3Q2hhdCBNMDYgVGVzdCBSb290MIIB
IjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwY1fi6fueWsO6IzQMYCvJolY
6c2d3ygzP1WuniJP/kCCGXZMITfNKZbgcDh5xYMSukDEl3OMI6RzlZxgEkMBvc3k
Rz3ROs1i7s7y3q1HF70U2wzd2sEvk+vTEuH/y+5uteNRDyYI0H9+cWXc7vgRLXuY
PGEes939nY+13gSYjxy9o5kRlGS39r2ok2Kqp0eiGYQD8OsRBxxHl89prb/o/a1a
ENDiqXtLXzc3TfTMeMos+gQc9HtRvQSYpxewzIDixzKv07LhpFybtR6lH+EOavun
5UpvnxGQKydkMuF76fGF59AdhwlsLp7ffHlLlRjV3n8txQdixMVWIaEHE/z7UQID
AQABoyMwITAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG
9w0BAQsFAAOCAQEATxUWewVBDugTM5+rocWGllvMDcunz/KPy5K2OPufp+1b53N5
G1DOb8/zy1Z9elzF3I7AvO+7NfCVYnFOZFSX/d52CV6JBl1MQp2x6M7zV5GRErow
F98AULVw7n5T11BJZDjzD/Ouj1x256U12dU38likS2BB8VQMECm2JqViORQLfiC3
FXvsjWpzV+DP1JbSk24hhbLGwytQxA/jruxrND/JIK0YJCQ2GbN7WupZUYx2Ac9S
GSEkAN3x4/I7CYLarDfc8O5d2M7mtM4HlNDP7VJazy9OcoqJVyPNPOt0su6q3EX5
jz3bUL4XpbWAvQ+PpxGgT7tZnOyFOTV5GyDliA==
-----END CERTIFICATE-----`;

const LOCALHOST_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDAzCCAeugAwIBAgIJAIsfZVfW5JYxMA0GCSqGSIb3DQEBCwUAMCExHzAdBgNV
BAMMFkNsYXdDaGF0IE0wNiBUZXN0IFJvb3QwHhcNMjYwNzI3MjAxNTI0WhcNMzYw
NzI0MjAxNTI0WjAUMRIwEAYDVQQDDAlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQC0r94g6pN2gvUVSuc2Kn1l6oOuoC6fHvZAmBA6M7Q+
q1X51Fr+TtaVxmuX0U7EUT7U8zIFDyQ6hG+grirbnDX8a5//ZBcjoKfuLwtiOlaf
Km3ERmvG2+cWuXV7Er/L169LEUaUog2N/8wFCFQfhYp9uMkZyuZDk5E/OrQYATkV
QSm39nk66oaPjvh5CESzd7PpRl1MUgxMI+PylxHPhwyiAwvR9bVfnB+/dmjc/7Gz
TaGFX5KRQm7KsYbtnozKIbCRp5mmyO0RsfKIABop15VweVpUJnePTYhgXbDk4Wom
lyalcd/njD+io+3UD5wSHihLTqWt3Lb9HZMEO0eKK6ufAgMBAAGjSzBJMAwGA1Ud
EwEB/wQCMAAwDgYDVR0PAQH/BAQDAgWgMBMGA1UdJQQMMAoGCCsGAQUFBwMBMBQG
A1UdEQQNMAuCCWxvY2FsaG9zdDANBgkqhkiG9w0BAQsFAAOCAQEAX7yZgKRYfRq5
cT8e31eYpxPBVKhXBsx1PCBUQuHEMmxcN79gABFYioyAbokU3+UCUjTvVcwHdmvT
bA5oVcEdkNl53ZhYSPqchOu8TYfcgYF6mO/CM5xlPzDLLbhPauFBa+dY0JZ1YD92
PXU0LDrcf+Bwfbecc6CKiznym4wKDuVW8byNAZS0B1cOPBwZgShzxOUpIas4/nG8
nAWLi2lnegoW3RNh4T8immTPcnmNI4K6wj1Z/IC14VmYf5fYa19SQ+QAPTCLium2
NvBPmsTXQmx+fPx4kR8trN0t8D/3Z5/KVh92lC/SEKqpGdEVWPyiRWZWhfJ/jLF5
mdr54S8LIA==
-----END CERTIFICATE-----`;

const WRONG_HOST_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDCzCCAfOgAwIBAgIJAIsfZVfW5JYyMA0GCSqGSIb3DQEBCwUAMCExHzAdBgNV
BAMMFkNsYXdDaGF0IE0wNiBUZXN0IFJvb3QwHhcNMjYwNzI3MjAxNTI0WhcNMzYw
NzI0MjAxNTI0WjAYMRYwFAYDVQQDDA13cm9uZy5leGFtcGxlMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuxntvMrN7JQyuSfkSq1LPLh39gxcBmvyIq3x
pHFeYja9Cqhqzfdkm+ssJePTzkYSICBSq0ogU6sNtNz1NwK6dIfXUHqjlxtMYY2+
bO+D/FvBf3aFP9neyh292BSMgCox+I9sp41Yw9sd32NxIrmF4pkoluOuJz20SIsI
WGxGY6CxbwVvU/Qi9Zb+wYZrJ5RbVfLTt1E02zulbn+rFijXzdOyms3Ks0+dkNGV
ahHYvVP/7X6PJmJpFtk7fjXWfO1hNxcZioJIRv2Qx9GE0GTuC0jEfjnNNCknnNak
wsRSQxlFCCjG8C9wahaIgQttduLUV96UGgoNJPLzWNWdPX3KEwIDAQABo08wTTAM
BgNVHRMBAf8EAjAAMA4GA1UdDwEB/wQEAwIFoDATBgNVHSUEDDAKBggrBgEFBQcD
ATAYBgNVHREEETAPgg13cm9uZy5leGFtcGxlMA0GCSqGSIb3DQEBCwUAA4IBAQAS
r+kgELy1qAerS33Dv264OHRzZNcuR+ivmLPiuvvDDruu3NIo6xwg/04lIifvVWeD
EHx16uMSt6dH8nFdblT21XazaAz7pqsE509yOxKgipWQMNiYzM5kDpQUYZZJ9hRB
h8JwNrSnGb717IxLn8SuRBnCoWUeQDiQuHlk62wfTaq2whignO6LZgtjMT9jZu6F
m8/vOcIXqww55ucqlK2CAmPBdggR+/I9J6NF3/dcRPWhifJlKUu0AHgDe54lPfhJ
G60UW/ZjFIAygkmvtrBE0fN0sfCnOc7nkpQhgEDaJPcMwssgh+FH7IAwfOsLOQQd
y+7teW8DiqtA8jzWUbD0
-----END CERTIFICATE-----`;

const UNTRUSTED_LOCALHOST_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIC9jCCAd6gAwIBAgIJAKPnnXF9PwoTMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNV
BAMMCWxvY2FsaG9zdDAeFw0yNjA3MjcyMDIxMTdaFw0zNjA3MjQyMDIxMTdaMBQx
EjAQBgNVBAMMCWxvY2FsaG9zdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC
ggEBALFeBH1jwxMPUTMXVl8l/zyUgt06tCg1O/SDWxERw49mLx1psj8YIIZm/Xm9
mGygD5M06fYmjrQ8Pv+HVU1FdPk66D3XkbJJ6Def+aJmVQuhZNay3NHnzlxtLSSy
xYGfiofSJAamjkuO/5yP4UpNR1c5ZoSG2c03rcAR8P13VeaD+Cg73h0sxF5BWOW8
miLCWLZsEkaYOzw1lwV9rINtMhxUKFWy0iAoDKrwSdBPy6+ObgmAyGl3KwWeyK4t
TZFPWrU3m6jF0xhso5xDLEN9Lsiy9d2tk2hu4cQe8nnk58CGnZUhLRh/LbaaVwx1
v8DjoVOjklvyKy3WKdQZfD6fj18CAwEAAaNLMEkwDAYDVR0TAQH/BAIwADAOBgNV
HQ8BAf8EBAMCBaAwEwYDVR0lBAwwCgYIKwYBBQUHAwEwFAYDVR0RBA0wC4IJbG9j
YWxob3N0MA0GCSqGSIb3DQEBCwUAA4IBAQAZNV2qbIX3LUBz+BWaJCeYLPHiIRX7
wiHfwvlZNfq3D7Y2RxreibKQ3LgVdf4J3v0SNGhMDihGFWPU6AOIQ1jQaS8GuVpp
gXyX/TY79iKRvPGoOWDyv3Bsi/g18M6swTyIgNHPy592sdrb7MfR8ea+cTJEhGUY
GgP0SGz/Ui6N8tPwNOndO9yNVtsLMyjsXHAlfg2d82RVnWrZpWr4yAdsOZhv8on0
Ta6CUCajPsUNLNFSmelpdoklt1/ZFdnDmonezbIr/jmgn5LHt71kY2Y8h5c55nkf
uTiwsW6gBVuAmNTUkzFHHJr4xivGrf2iaSi9LITNBhlg4XuNsfQ06E6D
-----END CERTIFICATE-----`;

function productionEnv(
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://user:secret@database.internal:5432/clawchat",
    DATABASE_CA_CERT_BASE64: Buffer.from(ROOT_CA).toString("base64"),
    DATABASE_TLS_SERVER_NAME: "localhost",
    ...overrides,
  };
}

describe("production database TLS", () => {
  it("is disabled outside production", () => {
    expect(databaseTlsForEnvironment({ NODE_ENV: "test" })).toBe(false);
  });

  it("requires a pinned CA and exact server identity", () => {
    expect(() =>
      buildVerifiedDatabaseTlsOptions(
        productionEnv({ DATABASE_CA_CERT_BASE64: undefined }),
      ),
    ).toThrow(/DATABASE_CA_CERT_BASE64/);
    expect(() =>
      buildVerifiedDatabaseTlsOptions(
        productionEnv({ DATABASE_TLS_SERVER_NAME: "*.internal" }),
      ),
    ).toThrow(/DATABASE_TLS_SERVER_NAME/);
  });

  it("rejects leaf certificates, malformed bundles, and URL TLS overrides", () => {
    expect(() =>
      buildVerifiedDatabaseTlsOptions(
        productionEnv({
          DATABASE_CA_CERT_BASE64: Buffer.from(LOCALHOST_CERTIFICATE).toString(
            "base64",
          ),
        }),
      ),
    ).toThrow(/CA certificates/);
    expect(() =>
      buildVerifiedDatabaseTlsOptions(
        productionEnv({ DATABASE_CA_CERT_BASE64: "not base64" }),
      ),
    ).toThrow(/canonical base64/);
    expect(() =>
      buildVerifiedDatabaseTlsOptions(
        productionEnv({
          DATABASE_URL:
            "postgres://user:secret@database.internal/clawchat?sslmode=no-verify",
        }),
      ),
    ).toThrow(/must not contain SSL query parameters/);
    expect(() =>
      buildVerifiedDatabaseTlsOptions(
        productionEnv(),
        new Date("2040-01-01T00:00:00.000Z"),
      ),
    ).toThrow(/not currently valid/);
  });

  it("enforces CA verification, TLS 1.2+, and the configured certificate identity", () => {
    const options = buildVerifiedDatabaseTlsOptions(productionEnv());
    expect(options.rejectUnauthorized).toBe(true);
    expect(options.minVersion).toBe("TLSv1.2");
    expect(options.ca).toBe(ROOT_CA);

    const matching = new X509Certificate(LOCALHOST_CERTIFICATE);
    expect(
      options.checkServerIdentity(
        "database.internal",
        matching.toLegacyObject(),
      ),
    ).toBeUndefined();

    const mismatched = new X509Certificate(WRONG_HOST_CERTIFICATE);
    expect(
      options.checkServerIdentity(
        "database.internal",
        mismatched.toLegacyObject(),
      ),
    ).toEqual(expect.objectContaining({ code: "ERR_TLS_CERT_ALTNAME_INVALID" }));

    const untrusted = new X509Certificate(UNTRUSTED_LOCALHOST_CERTIFICATE);
    expect(
      options.checkServerIdentity(
        "database.internal",
        untrusted.toLegacyObject(),
      ),
    ).toBeUndefined();
    expect(
      untrusted.verify(new X509Certificate(options.ca).publicKey),
    ).toBe(false);
  });

  it("builds verify-full libpq state without exposing credentials in arguments", async () => {
    const result = await buildVerifiedLibpqConnection(
      productionEnv(),
      "postgres://user:secret@database.internal:5432/clawchat",
      "/tmp/database-root-ca.pem",
      async (hostname) => {
        expect(hostname).toBe("database.internal");
        return { address: "10.0.0.42" };
      },
    );

    expect(result.environment).toEqual(
      expect.objectContaining({
        PGDATABASE: "clawchat",
        PGHOST: "localhost",
        PGHOSTADDR: "10.0.0.42",
        PGPASSWORD: "secret",
        PGPORT: "5432",
        PGSSLMODE: "verify-full",
        PGSSLROOTCERT: "/tmp/database-root-ca.pem",
        PGSSLSNI: "1",
        PGUSER: "user",
      }),
    );
    expect(result.ca).toBe(ROOT_CA);

    await expect(
      buildVerifiedLibpqConnection(
        productionEnv(),
        "postgres://user:secret@database.internal:5432/clawchat",
        "/tmp/database-root-ca.pem",
        async () => {
          throw new Error("dns unavailable");
        },
      ),
    ).rejects.toThrow(/could not be resolved/);
  });

  it("keeps every production database rehearsal on the verified shared policy", () => {
    const repositoryRoot = join(__dirname, "../../../..");
    const scriptPaths = [
      "scripts/provision-smoke-account.mjs",
      "scripts/prune-conflicting-invite-codes.mjs",
      "scripts/rehearse-production-relay-sync.mjs",
      "scripts/rehearse-production-tenant-isolation.mjs",
      "scripts/rehearse-stripe-duplicate-webhook.mjs",
    ];
    for (const relativePath of scriptPaths) {
      const source = readFileSync(join(repositoryRoot, relativePath), "utf8");
      expect(source).toContain("buildVerifiedPostgresClientConfig");
      expect(source).not.toContain("rejectUnauthorized: false");
    }

    const helper = readFileSync(
      join(repositoryRoot, "scripts/lib/production-database-tls.mjs"),
      "utf8",
    );
    expect(helper).toContain("rejectUnauthorized: true");
    expect(helper).toContain("checkServerIdentity(expectedIdentity");
    expect(helper).toContain('minVersion: "TLSv1.2"');
  });
});
