import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { MarketplaceApp } from "@clawchat/contracts"
import {
  DANGEROUS_MARKETPLACE_POLICY_WARNING,
  MARKETPLACE_BETA_SAFETY_NOTICE,
  getMarketplaceAppStatus,
  isMarketplaceBetaUnavailable,
  marketplaceBetaUnavailableMessage,
  marketplacePolicyActions,
  ordinaryMarketplaceApprovalProfiles,
  outlookMissingScopeRequirements,
  outlookProviderCapabilitiesFromScopes,
  outlookRuntimeToolsForCapabilities,
} from "./marketplace-screen"

describe("Marketplace availability notice", () => {
  it("explains catalog visibility and separate Connect readiness", () => {
    assert.match(
      MARKETPLACE_BETA_SAFETY_NOTICE.body,
      /all marketplace apps are shown/i
    )
    assert.match(MARKETPLACE_BETA_SAFETY_NOTICE.body, /connect is offered/i)
    assert.match(
      MARKETPLACE_BETA_SAFETY_NOTICE.body,
      /live-provider verification is tracked separately/i
    )
  })

  it("marks beta-unavailable app metadata as unavailable in UI helpers", () => {
    const app = {
      slug: "x",
      name: "X",
      sourceType: "external_provider",
      availability: "available",
      sourceMetadata: {
        marketplaceBetaGate: {
          betaMode: true,
          available: false,
          reason: "blocked_for_beta",
          hiddenFromCatalog: true,
          message:
            "This app is not included in the current Relay Console beta.",
        },
      },
    } as unknown as MarketplaceApp

    assert.equal(isMarketplaceBetaUnavailable(app), true)
    assert.equal(
      getMarketplaceAppStatus({ app, installedCount: 0 }),
      "Not in beta"
    )
    assert.equal(
      marketplaceBetaUnavailableMessage(app),
      "This app is not included in the current Relay Console beta."
    )
  })
})

describe("Marketplace approval profiles", () => {
  it("honors explicit empty dangerous-mode lists instead of falling back to safe restrictions", () => {
    const app = {
      allowedActions: [{ id: "read", label: "Read", description: "Read" }],
      approvalRequiredActions: [
        { id: "write", label: "Write", description: "Approve writes" },
      ],
      blockedActions: [
        { id: "delete", label: "Delete", description: "Block deletes" },
      ],
    } as Pick<
      MarketplaceApp,
      "allowedActions" | "approvalRequiredActions" | "blockedActions"
    >

    const policy = marketplacePolicyActions(app, {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: "Use every selected provider-supported action.",
      defaultSelected: false,
      allowedActions: [],
      approvalRequiredActions: [],
      blockedActions: [],
    })

    assert.deepEqual(policy, {
      allowedActions: [],
      approvalRequiredActions: [],
      blockedActions: [],
    })
  })

  it("keeps the dangerous policy out of ordinary selectors and states preserved invariants", () => {
    const profiles = [
      {
        id: "safe",
        label: "Safe",
        description: "Safe profile",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: [],
        blockedActions: [],
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description: "Dangerous profile",
        defaultSelected: false,
        allowedActions: [],
        approvalRequiredActions: [],
        blockedActions: [],
      },
    ]

    assert.deepEqual(
      ordinaryMarketplaceApprovalProfiles(profiles).map(
        (profile) => profile.id
      ),
      ["safe"]
    )
    assert.match(DANGEROUS_MARKETPLACE_POLICY_WARNING, /connection ownership/i)
    assert.match(DANGEROUS_MARKETPLACE_POLICY_WARNING, /selected capabilities/i)
    assert.match(DANGEROUS_MARKETPLACE_POLICY_WARNING, /blocked actions/i)
    assert.match(DANGEROUS_MARKETPLACE_POLICY_WARNING, /rate limits/i)
    assert.match(DANGEROUS_MARKETPLACE_POLICY_WARNING, /secret non-exposure/i)
  })
})

describe("Outlook marketplace diagnostics", () => {
  it("maps Microsoft scopes to provider-granted Outlook capabilities", () => {
    const capabilities = outlookProviderCapabilitiesFromScopes([
      "User.Read",
      "Mail.Read",
      "Mail.ReadWrite",
      "Mail.Send",
      "MailboxSettings.Read",
      "MailboxSettings.ReadWrite",
    ])

    assert.deepEqual(
      new Set(capabilities),
      new Set([
        "mail_folders_list",
        "inbox_messages_list",
        "unread_messages_list",
        "message_get",
      ])
    )
  })

  it("shows reconnect requirements for selected capabilities with missing scopes", () => {
    const missing = outlookMissingScopeRequirements(
      [
        "mail_folders_list",
        "inbox_messages_list",
        "unread_messages_list",
        "message_get",
      ],
      ["User.Read"]
    )

    assert.deepEqual(
      missing.map((item) => item.scope),
      ["Mail.Read"]
    )
  })

  it("keeps every bounded Outlook read approval-free in dangerous mode", () => {
    const tools = outlookRuntimeToolsForCapabilities(
      [
        "mail_folders_list",
        "inbox_messages_list",
        "unread_messages_list",
        "message_get",
      ],
      [
        "mail_folders_list",
        "inbox_messages_list",
        "unread_messages_list",
        "message_get",
      ],
      true
    )
    const byName = new Map(tools.map((tool) => [tool.name, tool]))

    assert.deepEqual(
      new Set(byName.keys()),
      new Set([
        "outlook.listMailFolders",
        "outlook.listInboxMessages",
        "outlook.listUnreadMessages",
        "outlook.getMessage",
      ])
    )
    for (const tool of byName.values()) {
      assert.equal(tool.approvalRequired, false)
    }
  })
})
