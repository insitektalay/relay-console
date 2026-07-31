import { getRateLimitTracker, getTrustedClientIp } from "./client-ip";

describe("trusted client IP resolution", () => {
  it("prefers the Railway normalized client IP over spoofable forwarding headers", () => {
    expect(
      getRateLimitTracker({
        headers: {
          "x-real-ip": "203.0.113.10",
          "x-forwarded-for": "198.51.100.250",
          "cf-connecting-ip": "198.51.100.251",
        },
        ip: "10.0.0.10",
        socket: { remoteAddress: "10.0.0.11" },
      }),
    ).toBe("203.0.113.10");
  });

  it("does not trust x-forwarded-for when Railway x-real-ip is absent", () => {
    expect(
      getRateLimitTracker({
        headers: {
          "x-forwarded-for": "198.51.100.250",
        },
        ip: "10.0.0.10",
      }),
    ).toBe("10.0.0.10");
  });

  it("does not trust cf-connecting-ip when Railway x-real-ip is absent", () => {
    expect(
      getTrustedClientIp({
        headers: {
          "cf-connecting-ip": "198.51.100.251",
        },
        socket: { remoteAddress: "10.0.0.11" },
      }),
    ).toBe("10.0.0.11");
  });

  it("rejects malformed or chain-shaped x-real-ip values", () => {
    expect(
      getRateLimitTracker({
        headers: {
          "x-real-ip": "203.0.113.10, 198.51.100.20",
          "x-forwarded-for": "198.51.100.250",
        },
        ip: "10.0.0.10",
      }),
    ).toBe("10.0.0.10");
  });

  it("ignores x-real-ip on a direct connection from an untrusted peer", () => {
    expect(
      getRateLimitTracker({
        headers: {
          "x-real-ip": "198.51.100.99",
        },
        socket: { remoteAddress: "203.0.113.44" },
      }),
    ).toBe("203.0.113.44");
  });

  it("falls back to unknown when no trusted IP source exists", () => {
    expect(getRateLimitTracker({ headers: {} })).toBe("unknown");
  });
});
