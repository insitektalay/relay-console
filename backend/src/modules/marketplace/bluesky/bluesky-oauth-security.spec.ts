import { BadRequestException } from "@nestjs/common";
import { createPublicKey, verify } from "node:crypto";
import { isPublicIpAddress } from "../../../common/security/safe-outbound-http";
import { BlueskyOAuthSecurity } from "./bluesky-oauth-security";

describe("BlueskyOAuthSecurity", () => {
  it("creates an ES256 DPoP proof bound to method, URL, nonce, and token", () => {
    const security = new BlueskyOAuthSecurity();
    const keys = security.generateDpopKeyPair();
    const proof = security.createDpopProof({
      privateJwk: keys.privateJwk,
      publicJwk: keys.publicJwk,
      method: "post",
      url: "https://pds.example/xrpc/com.atproto.repo.createRecord?ignored=yes",
      nonce: "nonce-1",
      accessToken: "access-token",
      now: new Date("2026-07-12T18:00:00.000Z"),
      jti: "proof-id",
    });
    const [encodedHeader, encodedPayload, encodedSignature] = proof.split(".");
    const header = JSON.parse(
      Buffer.from(encodedHeader, "base64url").toString("utf8"),
    );
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
    expect(header).toMatchObject({ typ: "dpop+jwt", alg: "ES256" });
    expect(header.jwk.d).toBeUndefined();
    expect(payload).toMatchObject({
      htm: "POST",
      htu: "https://pds.example/xrpc/com.atproto.repo.createRecord",
      nonce: "nonce-1",
      jti: "proof-id",
      iat: 1783879200,
    });
    expect(payload.ath).toBe("Pxa-1wifRlPl7yG_0oJNfzqq7MelmOfonFgOFgapzFI");
    expect(
      verify(
        "sha256",
        Buffer.from(`${encodedHeader}.${encodedPayload}`),
        {
          key: createPublicKey({ key: keys.publicJwk, format: "jwk" }),
          dsaEncoding: "ieee-p1363",
        },
        Buffer.from(encodedSignature, "base64url"),
      ),
    ).toBe(true);
  });

  it("rejects credentials, ports, IP literals, and non-HTTPS URLs before DNS", async () => {
    const security = new BlueskyOAuthSecurity();
    for (const url of [
      "http://pds.example/xrpc",
      "https://user:pass@pds.example/xrpc",
      "https://pds.example:8443/xrpc",
      "https://127.0.0.1/xrpc",
      "https://[::1]/xrpc",
    ]) {
      await expect(security.assertSafeHttpsUrl(url)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });

  it("rejects private and reserved IPv4 and IPv6 answers", () => {
    for (const address of [
      "10.0.0.1",
      "100.64.0.1",
      "192.0.2.1",
      "198.51.100.1",
      "203.0.113.1",
      "::1",
      "fc00::1",
      "fe80::1",
      "2001:db8::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
    ]) {
      expect(isPublicIpAddress(address)).toBe(false);
    }
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("fails closed on malformed discovery JSON", async () => {
    const security = new BlueskyOAuthSecurity(
      async () =>
        new Response("not-json", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    jest
      .spyOn(security, "assertSafeHttpsUrl")
      .mockResolvedValue(
        "https://pds.example/.well-known/oauth-protected-resource",
      );
    await expect(
      security.fetchJson(
        "https://pds.example/.well-known/oauth-protected-resource",
      ),
    ).rejects.toThrow("not JSON");
  });

  it("aborts a provider request at the bounded timeout", async () => {
    jest.useFakeTimers();
    try {
      const security = new BlueskyOAuthSecurity(
        async (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          }),
      );
      jest
        .spyOn(security, "assertSafeHttpsUrl")
        .mockResolvedValue("https://pds.example/xrpc");
      const pending = security.request("https://pds.example/xrpc", {
        method: "GET",
        timeoutMs: 1_000,
      });
      const assertion = expect(pending).rejects.toThrow(
        "provider request failed",
      );
      await jest.advanceTimersByTimeAsync(1_000);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });
});
