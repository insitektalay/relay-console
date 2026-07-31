import {
  hasExactRelayJwtAudience,
  RELAY_JWT_ALGORITHM,
  RELAY_JWT_AUDIENCES,
  RELAY_JWT_ISSUER,
  resolveRelayJwtIssuer,
} from "./auth-token-policy";

describe("auth token policy", () => {
  it("uses a non-maintainer example issuer, HS256, and a distinct audience for every JWT family", () => {
    expect(RELAY_JWT_ISSUER).toBe("https://your-backend.up.railway.app/api/v1");
    expect(RELAY_JWT_ALGORITHM).toBe("HS256");
    expect(new Set(Object.values(RELAY_JWT_AUDIENCES)).size).toBe(7);
  });

  it("accepts canonical self-hosted issuers and supplies the example outside production when omitted", () => {
    expect(resolveRelayJwtIssuer()).toBe(RELAY_JWT_ISSUER);
    expect(resolveRelayJwtIssuer(` ${RELAY_JWT_ISSUER} `)).toBe(
      RELAY_JWT_ISSUER,
    );
    expect(
      resolveRelayJwtIssuer("https://relay-owner.up.railway.app/api/v1"),
    ).toBe("https://relay-owner.up.railway.app/api/v1");
  });

  it("rejects unsafe and non-canonical issuers", () => {
    for (const issuer of [
      "http://relay-owner.up.railway.app/api/v1",
      "https://localhost/api/v1",
      "https://127.0.0.1/api/v1",
      "https://user:secret@relay-owner.up.railway.app/api/v1",
      "https://relay-owner.up.railway.app:444/api/v1",
      "https://relay-owner.up.railway.app/api/v1/",
      "https://relay-owner.up.railway.app/api/v1?token=secret",
      "https://relay-owner.up.railway.app/api/v1#fragment",
    ]) {
      expect(() => resolveRelayJwtIssuer(issuer)).toThrow(/JWT_ISSUER/);
    }
  });

  it("requires one exact string audience rather than arrays or aliases", () => {
    const expected = RELAY_JWT_AUDIENCES.mobileAccess;
    expect(hasExactRelayJwtAudience({ aud: expected }, expected)).toBe(true);
    expect(hasExactRelayJwtAudience({}, expected)).toBe(false);
    expect(hasExactRelayJwtAudience({ aud: [expected] }, expected)).toBe(false);
    expect(
      hasExactRelayJwtAudience(
        { aud: RELAY_JWT_AUDIENCES.webAccess },
        expected,
      ),
    ).toBe(false);
  });
});
