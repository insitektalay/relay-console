import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { MarketplaceApp } from "@clawchat/contracts"
import {
  marketplaceAppUsesConnectorOAuth,
  marketplaceAppUsesNativeConnector,
} from "./marketplace-screen"
import { marketplaceSource } from "./marketplace-source.test"

function app(slug: string, connectionTypes: string[]) {
  return { slug, connectionTypes } as Pick<
    MarketplaceApp,
    "slug" | "connectionTypes"
  >
}

describe("GitHub Marketplace OAuth routing", () => {
  it("routes the Relay-owned GitHub App through connector OAuth", () => {
    const github = app("github", [
      "oauth",
      "relay_owned_github_app",
      "github_app_user_authorization",
    ])

    assert.equal(marketplaceAppUsesConnectorOAuth(github), true)
    assert.equal(marketplaceAppUsesNativeConnector(github), true)
  })

  it("does not route an ordinary API-key app through connector OAuth", () => {
    const genericApi = app("generic-api", ["api_key"])

    assert.equal(marketplaceAppUsesConnectorOAuth(genericApi), false)
    assert.equal(marketplaceAppUsesNativeConnector(genericApi), false)
  })

  it("blocks generic connection creation until connector OAuth succeeds", () => {
    const oauthGuard = marketplaceSource.indexOf(
      "if (selectedAppUsesConnectorOAuth && !connectionId)"
    )
    const genericConnectionCreation = marketplaceSource.indexOf(
      "const connection = await sdk.marketplace.createConnection",
      oauthGuard
    )

    assert.notEqual(oauthGuard, -1)
    assert.ok(genericConnectionCreation > oauthGuard)
  })
})
