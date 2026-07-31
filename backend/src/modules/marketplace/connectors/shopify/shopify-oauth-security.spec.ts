import { createHmac } from "node:crypto";
import { MarketplaceConnectorOAuthService } from "../connector-oauth.service";

describe("Shopify OAuth security boundary", () => {
  const service = Object.create(MarketplaceConnectorOAuthService.prototype) as any;

  it("builds authorization and token endpoints only from an exact lowercase myshopify.com host", () => {
    expect(service.shopifyAuthority("relay-demo.myshopify.com")).toEqual({
      mode: "relay-demo.myshopify.com",
      tenantId: null,
      authorizationUrl: "https://relay-demo.myshopify.com/admin/oauth/authorize",
      tokenUrl: "https://relay-demo.myshopify.com/admin/oauth/access_token",
    });
    for (const value of ["Relay-Demo.myshopify.com", "https://relay-demo.myshopify.com", "relay-demo.myshopify.com.evil.example", "127.0.0.1"]) {
      expect(() => service.shopifyAuthority(value)).toThrow();
    }
  });

  it("accepts Shopify's canonical callback HMAC and rejects tampering", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const params = new URLSearchParams({ code: "authorization-code", shop: "relay-demo.myshopify.com", state: "state-value", timestamp });
    const message = [...params.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join("&");
    const hmac = createHmac("sha256", "shopify-secret").update(message).digest("hex");
    const input = {
      shopifyHmac: hmac,
      shopifyShop: "relay-demo.myshopify.com",
      shopifyTimestamp: timestamp,
      rawCallbackPathAndQuery: `/api/v1/marketplace/oauth/shopify/callback?${params}&hmac=${hmac}`,
    };
    expect(() => service.validateShopifyCallback(input, "shopify-secret")).not.toThrow();
    expect(() => service.validateShopifyCallback({ ...input, rawCallbackPathAndQuery: input.rawCallbackPathAndQuery.replace("authorization-code", "tampered") }, "shopify-secret")).toThrow("Shopify callback signature validation failed");
  });

  it("rejects stale signed callbacks before token exchange", () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 601);
    const params = new URLSearchParams({ code: "authorization-code", shop: "relay-demo.myshopify.com", state: "state-value", timestamp });
    const message = [...params.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join("&");
    const hmac = createHmac("sha256", "shopify-secret").update(message).digest("hex");
    expect(() => service.validateShopifyCallback({ shopifyHmac: hmac, shopifyShop: "relay-demo.myshopify.com", shopifyTimestamp: timestamp, rawCallbackPathAndQuery: `/callback?${params}&hmac=${hmac}` }, "shopify-secret")).toThrow("outside the allowed window");
  });
});
