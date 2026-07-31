import { MastodonApiAdapter } from "./mastodon-api.adapter";
import { isPublicIpAddress } from "../../../../common/security/safe-outbound-http";
import {
  MASTODON_CONNECTOR_MANIFEST,
  MASTODON_SCOPES,
} from "./mastodon.connector";

describe("Mastodon connector", () => {
  it("registers exact scopes, four tools and safe/dangerous policies", () => {
    expect(MASTODON_SCOPES).toEqual([
      "read:accounts",
      "read:statuses",
      "write:statuses",
    ]);
    expect(MASTODON_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      MASTODON_CONNECTOR_MANIFEST.approvalProfiles.map((item) => item.id),
    ).toEqual(["mastodon_safe", "dangerously_skip_permissions"]);
  });

  it("rejects non-public, non-origin and custom-port instances", () => {
    const adapter = new MastodonApiAdapter();
    for (const origin of [
      "http://social.example",
      "https://127.0.0.1",
      "https://social.example:8443",
      "https://social.example/path",
      "https://localhost",
    ]) {
      expect(() => adapter.normalizeInstanceOrigin(origin)).toThrow(
        expect.objectContaining({ code: "provider_validation_error" }),
      );
    }
  });

  it("classifies private, documentation, multicast and mapped addresses as non-public", () => {
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    for (const address of [
      "10.0.0.1",
      "192.168.1.1",
      "203.0.113.8",
      "::1",
      "fd00::1",
      "ff02::1",
      "2001:db8::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isPublicIpAddress(address)).toBe(false);
    }
  });

  it("bounds drafts to instance limits and public or unlisted visibility", () => {
    const adapter = new MastodonApiAdapter();
    expect(adapter.draftText("hello", "unlisted", "en", 400)).toMatchObject({
      text: "hello",
      visibility: "unlisted",
      language: "en",
      characterCount: 5,
    });
    expect(() =>
      adapter.draftText("x".repeat(401), "public", null, 400),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));
    expect(() => adapter.draftText("hello", "private", null, 500)).toThrow(
      expect.objectContaining({ code: "provider_validation_error" }),
    );
  });
});
