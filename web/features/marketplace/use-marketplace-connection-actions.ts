"use client"

import { RELAY_OWNED_CONNECTOR_OAUTH_TYPES } from "@/components/marketplace/marketplace-domain"
import { showError } from "@/components/marketplace/marketplace-preview-ui"
import { sdk } from "@/lib/sdk"
import type {
  Agent,
  MarketplaceApp,
  MarketplaceConnection,
  MarketplaceInstall,
} from "@clawchat/contracts"
import type { QueryClient } from "@tanstack/react-query"
import { useMutation } from "@tanstack/react-query"
import type { Dispatch, SetStateAction } from "react"
import { toast } from "sonner"

type MicrosoftAuthorityMode =
  | "single_tenant"
  | "multi_tenant_org"
  | "multi_tenant_common"

type RemoveInstallTarget = {
  install: MarketplaceInstall
  agentName: string
  appName: string
} | null

export function useMarketplaceConnectionActions({
  agents,
  assertCanManageMarketplace,
  connectionId,
  connectionName,
  connectorOAuthReturnTo,
  connectorOptionalScopes,
  credentialDrafts,
  effectiveCapabilities,
  environment,
  microsoftAuthorityMode,
  microsoftTenantId,
  outlookSenderEmail,
  queryClient,
  selectedApp,
  selectedConnectorConnection,
  setConnectionId,
  setRemoveInstallTarget,
  workspaceId,
  xOptionalScopes,
}: {
  agents: Agent[]
  assertCanManageMarketplace: () => void
  connectionId: string
  connectionName: string
  connectorOAuthReturnTo: (appSlug: string) => string
  connectorOptionalScopes: Set<string>
  credentialDrafts: Record<string, string>
  effectiveCapabilities: string[]
  environment: string
  microsoftAuthorityMode: MicrosoftAuthorityMode
  microsoftTenantId: string
  outlookSenderEmail: string
  queryClient: QueryClient
  selectedApp: MarketplaceApp | null
  selectedConnectorConnection: MarketplaceConnection | null | undefined
  setConnectionId: Dispatch<SetStateAction<string>>
  setRemoveInstallTarget: Dispatch<SetStateAction<RemoveInstallTarget>>
  workspaceId: string
  xOptionalScopes: Set<string>
}) {
  const startXOAuthMutation = useMutation({
    mutationFn: async () => {
      assertCanManageMarketplace()
      const clientId = credentialDrafts.X_CLIENT_ID?.trim()
      if (!clientId) throw new Error("Enter the X Client ID.")
      const result = await sdk.marketplace.startXOAuth(workspaceId, {
        clientId,
        clientSecret: credentialDrafts.X_CLIENT_SECRET?.trim() || undefined,
        optionalScopes: Array.from(xOptionalScopes),
        selectedCapabilities: effectiveCapabilities,
        displayName: connectionName.trim() || "X account",
        environment,
        returnTo: window.location.href,
      })
      window.location.assign(result.authorizationUrl)
      return result
    },
    onError: showError,
  })

  const reauthorizeXOAuthMutation = useMutation({
    mutationFn: async () => {
      assertCanManageMarketplace()
      if (!connectionId)
        throw new Error("Select the X connection to re-authorize.")
      const result = await sdk.marketplace.reauthorizeXOAuth(
        workspaceId,
        connectionId,
        {
          clientId: credentialDrafts.X_CLIENT_ID?.trim() || undefined,
          clientSecret: credentialDrafts.X_CLIENT_SECRET?.trim() || undefined,
          optionalScopes: Array.from(xOptionalScopes),
          selectedCapabilities: effectiveCapabilities,
          returnTo: window.location.href,
        }
      )
      window.location.assign(result.authorizationUrl)
      return result
    },
    onError: showError,
  })

  const disconnectXOAuthMutation = useMutation({
    mutationFn: async () => {
      assertCanManageMarketplace()
      if (!connectionId)
        throw new Error("Select the X connection to disconnect.")
      return sdk.marketplace.disconnectXOAuth(workspaceId, connectionId)
    },
    onSuccess: async (connection) => {
      setConnectionId(connection.id)
      await queryClient.invalidateQueries({
        queryKey: ["marketplace", workspaceId, "connections"],
      })
      toast.success("X account disconnected")
    },
    onError: showError,
  })

  const startConnectorOAuthMutation = useMutation({
    mutationFn: async () => {
      assertCanManageMarketplace()
      if (!selectedApp) throw new Error("Select a marketplace app.")
      const clientId =
        credentialDrafts.MICROSOFT_CLIENT_ID?.trim() ||
        credentialDrafts[
          `${selectedApp.slug.toUpperCase().replaceAll("-", "_")}_CLIENT_ID`
        ]?.trim()
      if (
        !clientId &&
        selectedApp.slug !== "slack" &&
        selectedApp.slug !== "shopify" &&
        !selectedApp.connectionTypes.some((type) =>
          RELAY_OWNED_CONNECTOR_OAUTH_TYPES.has(type)
        ) &&
        (!selectedApp.connectionTypes.includes("oauth_connector") ||
          ["bynder", "canto", "frontify", "asset-bank"].includes(
            selectedApp.slug
          )) &&
        !selectedApp.connectionTypes.includes("oauth1_xauth")
      )
        throw new Error("Enter the OAuth client ID.")
      const clientSecret =
        credentialDrafts[
          `${selectedApp.slug.toUpperCase().replaceAll("-", "_")}_CLIENT_SECRET`
        ]?.trim() || credentialDrafts.MICROSOFT_CLIENT_SECRET?.trim()
      const selectedClientSecret =
        selectedApp.slug === "linkedin"
          ? credentialDrafts.LINKEDIN_CLIENT_SECRET?.trim()
          : clientSecret
      const tenantId =
        microsoftTenantId.trim() || credentialDrafts.MICROSOFT_TENANT_ID?.trim()
      if (selectedApp.slug === "outlook") {
        if (microsoftAuthorityMode === "single_tenant" && !tenantId) {
          throw new Error("Enter the Microsoft tenant ID.")
        }
        if (!clientSecret) throw new Error("Enter the Microsoft client secret.")
      }
      const result = await sdk.marketplace.startConnectorOAuth(
        workspaceId,
        selectedApp.slug,
        {
          clientId: clientId || undefined,
          clientSecret: selectedClientSecret || undefined,
          microsoftAuthorityMode,
          microsoftTenantId:
            microsoftAuthorityMode === "single_tenant"
              ? tenantId || undefined
              : undefined,
          optionalScopes: Array.from(connectorOptionalScopes),
          selectedCapabilities: effectiveCapabilities,
          displayName: connectionName.trim() || `${selectedApp.name} account`,
          environment,
          returnTo: connectorOAuthReturnTo(selectedApp.slug),
          username: credentialDrafts.INSTAPAPER_USERNAME?.trim() || undefined,
          password: credentialDrafts.INSTAPAPER_PASSWORD ?? undefined,
          instaparserApiKey:
            credentialDrafts.INSTAPARSER_API_KEY?.trim() || undefined,
          providerDomain:
            selectedApp.slug === "egnyte"
              ? credentialDrafts.domain?.trim() || undefined
              : selectedApp.slug === "bynder"
                ? credentialDrafts.BYNDER_PORTAL_DOMAIN?.trim() || undefined
                : selectedApp.slug === "canto"
                  ? credentialDrafts.CANTO_ACCOUNT_DOMAIN?.trim() || undefined
                  : selectedApp.slug === "frontify"
                    ? credentialDrafts.FRONTIFY_DOMAIN?.trim() || undefined
                    : selectedApp.slug === "asset-bank"
                      ? credentialDrafts.ASSET_BANK_BASE_URL?.trim() ||
                        undefined
                      : selectedApp.slug === "sage-accounting"
                        ? credentialDrafts.SAGE_ACCOUNTING_SUBSCRIPTION_KEY?.trim() ||
                          undefined
                        : selectedApp.slug === "myob"
                          ? credentialDrafts.MYOB_COMPANY_FILE_TOKEN?.trim() ||
                            undefined
                          : selectedApp.slug === "zoho-books"
                            ? credentialDrafts.ZOHO_BOOKS_ORGANIZATION_ID?.trim() ||
                              undefined
                            : selectedApp.slug === "zoho-invoice"
                              ? credentialDrafts.ZOHO_INVOICE_ORGANIZATION_ID?.trim() ||
                                undefined
                              : selectedApp.slug === "shopify"
                                ? credentialDrafts.SHOPIFY_SHOP_DOMAIN?.trim() ||
                                  undefined
                                : selectedApp.slug === "zoho-expense"
                                  ? credentialDrafts.ZOHO_EXPENSE_ORGANIZATION_ID?.trim() ||
                                    undefined
                                  : selectedApp.slug === "zoho-projects"
                                    ? credentialDrafts.ZOHO_PROJECTS_PORTAL_ID?.trim() ||
                                      undefined
                                    : selectedApp.slug === "zendesk"
                                      ? credentialDrafts.zendeskSubdomain?.trim() ||
                                        undefined
                                      : undefined,
        }
      )
      window.location.assign(result.authorizationUrl)
      return result
    },
    onError: showError,
  })

  const reauthorizeConnectorOAuthMutation = useMutation({
    mutationFn: async () => {
      assertCanManageMarketplace()
      if (!selectedApp) throw new Error("Select a marketplace app.")
      if (!connectionId)
        throw new Error(
          `Select the ${selectedApp.name} connection to re-authorize.`
        )
      const tenantId =
        microsoftTenantId.trim() || credentialDrafts.MICROSOFT_TENANT_ID?.trim()
      if (
        selectedApp.slug === "outlook" &&
        microsoftAuthorityMode === "single_tenant" &&
        !tenantId
      ) {
        throw new Error("Enter the Microsoft tenant ID.")
      }
      const result = await sdk.marketplace.reauthorizeConnectorOAuth(
        workspaceId,
        selectedApp.slug,
        connectionId,
        {
          clientId:
            credentialDrafts[
              `${selectedApp.slug.toUpperCase().replaceAll("-", "_")}_CLIENT_ID`
            ]?.trim() ||
            credentialDrafts.MICROSOFT_CLIENT_ID?.trim() ||
            undefined,
          clientSecret:
            credentialDrafts[
              `${selectedApp.slug.toUpperCase().replaceAll("-", "_")}_CLIENT_SECRET`
            ]?.trim() ||
            credentialDrafts.MICROSOFT_CLIENT_SECRET?.trim() ||
            undefined,
          microsoftAuthorityMode,
          microsoftTenantId:
            microsoftAuthorityMode === "single_tenant"
              ? tenantId || undefined
              : undefined,
          optionalScopes: Array.from(connectorOptionalScopes),
          selectedCapabilities: effectiveCapabilities,
          returnTo: connectorOAuthReturnTo(selectedApp.slug),
          username: credentialDrafts.INSTAPAPER_USERNAME?.trim() || undefined,
          password: credentialDrafts.INSTAPAPER_PASSWORD ?? undefined,
          instaparserApiKey:
            credentialDrafts.INSTAPARSER_API_KEY?.trim() || undefined,
          providerDomain:
            selectedApp.slug === "egnyte"
              ? credentialDrafts.domain?.trim() || undefined
              : selectedApp.slug === "bynder"
                ? credentialDrafts.BYNDER_PORTAL_DOMAIN?.trim() || undefined
                : selectedApp.slug === "canto"
                  ? credentialDrafts.CANTO_ACCOUNT_DOMAIN?.trim() || undefined
                  : selectedApp.slug === "frontify"
                    ? credentialDrafts.FRONTIFY_DOMAIN?.trim() || undefined
                    : selectedApp.slug === "asset-bank"
                      ? credentialDrafts.ASSET_BANK_BASE_URL?.trim() ||
                        undefined
                      : selectedApp.slug === "sage-accounting"
                        ? credentialDrafts.SAGE_ACCOUNTING_SUBSCRIPTION_KEY?.trim() ||
                          undefined
                        : selectedApp.slug === "myob"
                          ? credentialDrafts.MYOB_COMPANY_FILE_TOKEN?.trim() ||
                            undefined
                          : selectedApp.slug === "zoho-books"
                            ? credentialDrafts.ZOHO_BOOKS_ORGANIZATION_ID?.trim() ||
                              undefined
                            : selectedApp.slug === "zoho-invoice"
                              ? credentialDrafts.ZOHO_INVOICE_ORGANIZATION_ID?.trim() ||
                                undefined
                              : selectedApp.slug === "shopify"
                                ? credentialDrafts.SHOPIFY_SHOP_DOMAIN?.trim() ||
                                  undefined
                                : selectedApp.slug === "zoho-expense"
                                  ? credentialDrafts.ZOHO_EXPENSE_ORGANIZATION_ID?.trim() ||
                                    undefined
                                  : selectedApp.slug === "zoho-projects"
                                    ? credentialDrafts.ZOHO_PROJECTS_PORTAL_ID?.trim() ||
                                      undefined
                                    : selectedApp.slug === "zendesk"
                                      ? credentialDrafts.zendeskSubdomain?.trim() ||
                                        undefined
                                      : undefined,
        }
      )
      window.location.assign(result.authorizationUrl)
      return result
    },
    onError: showError,
  })

  const validateOutlookSenderMutation = useMutation({
    mutationFn: async (input?: {
      email?: string
      installId?: string
      agentId?: string
    }) => {
      assertCanManageMarketplace()
      if (!selectedConnectorConnection)
        throw new Error("Authorize Microsoft 365 before checking aliases.")
      const email = (input?.email ?? outlookSenderEmail).trim()
      if (!email) throw new Error("Enter an Outlook sender alias to check.")
      return sdk.marketplace.validateConnectorSenderIdentity(
        workspaceId,
        "outlook",
        selectedConnectorConnection.id,
        {
          email,
          agentId: input?.agentId,
          installId: input?.installId,
        }
      )
    },
    onSuccess: async (result) => {
      setConnectionId(result.connection.id)
      await queryClient.invalidateQueries({
        queryKey: ["marketplace", workspaceId, "connections"],
      })
      const status = String(result.identity.validationStatus ?? "unknown")
      if (status === "verified") toast.success("Outlook alias verified")
      else toast.warning("Alias not found in Microsoft 365")
    },
    onError: showError,
  })

  const updateOutlookInstallSenderMutation = useMutation({
    mutationFn: async (input: {
      install: MarketplaceInstall
      email: string
    }) => {
      assertCanManageMarketplace()
      const email = input.email.trim()
      if (!email) throw new Error("Enter an Outlook sender alias.")
      if (input.install.connectionId) {
        await sdk.marketplace.validateConnectorSenderIdentity(
          workspaceId,
          "outlook",
          input.install.connectionId,
          {
            email,
            agentId: input.install.agentId,
            installId: input.install.id,
          }
        )
      }
      return sdk.marketplace.updateInstall(workspaceId, input.install.id, {
        outlookSenderEmail: email,
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId, "connections"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId, "installs"],
        }),
      ])
      toast.success("Agent sender alias updated")
    },
    onError: showError,
  })

  const updateInstallPolicyMutation = useMutation({
    mutationFn: async (input: {
      install: MarketplaceInstall
      approvalProfileId: string
      acknowledgeDangerouslySkipPermissions?: boolean
    }) => {
      assertCanManageMarketplace()
      return sdk.marketplace.updateInstall(workspaceId, input.install.id, {
        approvalProfileId: input.approvalProfileId,
        acknowledgeDangerouslySkipPermissions:
          input.acknowledgeDangerouslySkipPermissions,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["marketplace", workspaceId, "installs"],
      })
      toast.success("Marketplace policy updated")
    },
    onError: showError,
  })
  const removeInstallMutation = useMutation({
    mutationFn: (install: MarketplaceInstall) => {
      assertCanManageMarketplace()
      return sdk.marketplace.removeInstall(workspaceId, install.id)
    },
    onSuccess: async (_removed, install) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["marketplace", workspaceId, "installs"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["agent-documentation", workspaceId],
        }),
      ])
      setRemoveInstallTarget(null)
      const agent = agents.find((item) => item.id === install.agentId)
      toast.success(
        `${selectedApp?.name ?? install.appSlug} removed from ${agent?.name ?? "agent"}`
      )
    },
    onError: showError,
  })

  const disconnectConnectorOAuthMutation = useMutation({
    mutationFn: async () => {
      assertCanManageMarketplace()
      if (!selectedApp) throw new Error("Select a marketplace app.")
      if (!connectionId)
        throw new Error(
          `Select the ${selectedApp.name} connection to disconnect.`
        )
      return sdk.marketplace.disconnectConnectorOAuth(
        workspaceId,
        selectedApp.slug,
        connectionId
      )
    },
    onSuccess: async (connection) => {
      setConnectionId(connection.id)
      await queryClient.invalidateQueries({
        queryKey: ["marketplace", workspaceId, "connections"],
      })
      toast.success(`${selectedApp?.name ?? "Connector"} disconnected`)
    },
    onError: showError,
  })

  return {
    disconnectConnectorOAuthMutation,
    disconnectXOAuthMutation,
    reauthorizeConnectorOAuthMutation,
    reauthorizeXOAuthMutation,
    removeInstallMutation,
    startConnectorOAuthMutation,
    startXOAuthMutation,
    updateInstallPolicyMutation,
    updateOutlookInstallSenderMutation,
    validateOutlookSenderMutation,
  }
}
