"use client"

import type { MarketplaceApp } from "@clawchat/contracts"
import { useCallback, useState } from "react"

export function useMarketplaceConnectionFormState(
  initialSelectedAppSlug?: string | null
) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    initialSelectedAppSlug ?? null
  )
  const [connectionId, setConnectionId] = useState("")
  const [connectionName, setConnectionName] = useState("")
  const [environment, setEnvironment] = useState("default")
  const [connectionAuthType, setConnectionAuthType] = useState("")
  const [credentialDrafts, setCredentialDrafts] = useState<
    Record<string, string>
  >({})
  const [
    isReplacingConnectionCredentials,
    setIsReplacingConnectionCredentials,
  ] = useState(false)
  const [retainUnverifiedCredentials, setRetainUnverifiedCredentials] =
    useState(false)
  const [revealedCredentialDrafts, setRevealedCredentialDrafts] = useState<
    Record<string, boolean>
  >({})
  const [selectedCapabilities, setSelectedCapabilities] = useState<Set<string>>(
    new Set()
  )
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(
    new Set()
  )
  const [selectedAuditorAgentId, setSelectedAuditorAgentId] = useState("")
  const [selectedManagerAgentId, setSelectedManagerAgentId] = useState("")
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [xOptionalScopes, setXOptionalScopes] = useState<Set<string>>(new Set())
  const [connectorOptionalScopes, setConnectorOptionalScopes] = useState<
    Set<string>
  >(new Set())
  const [microsoftAuthorityMode, setMicrosoftAuthorityMode] = useState<
    "single_tenant" | "multi_tenant_org" | "multi_tenant_common"
  >("single_tenant")
  const [microsoftTenantId, setMicrosoftTenantId] = useState("")
  const [outlookSenderEmail, setOutlookSenderEmail] = useState("")
  const [outlookInstallSenderDrafts, setOutlookInstallSenderDrafts] = useState<
    Record<string, string>
  >({})
  const [linkcrestOpenClawBaseUrlDraft, setLinkcrestOpenClawBaseUrlDraft] =
    useState("")
  const [linkcrestBearerKeyDraft, setLinkcrestBearerKeyDraft] = useState("")
  const [revealedLinkcrestBearerKeySlug, setRevealedLinkcrestBearerKeySlug] =
    useState<string | null>(null)

  const selectMarketplaceApp = useCallback((app: MarketplaceApp) => {
    setSelectedSlug(app.slug)
    setConnectionId("")
    setConnectionName(`${app.name} connection`)
    setEnvironment("default")
    setConnectionAuthType("")
    setCredentialDrafts({})
    setIsReplacingConnectionCredentials(false)
    setRetainUnverifiedCredentials(false)
    setRevealedCredentialDrafts({})
    setSelectedCapabilities(new Set())
    setSelectedAgentIds(new Set())
    setSelectedAuditorAgentId("")
    setSelectedManagerAgentId("")
    setSelectedFilePath(null)
    setXOptionalScopes(new Set())
    setConnectorOptionalScopes(new Set())
    setMicrosoftAuthorityMode("single_tenant")
    setMicrosoftTenantId("")
    setOutlookSenderEmail("")
    setOutlookInstallSenderDrafts({})
    setLinkcrestOpenClawBaseUrlDraft("")
    setLinkcrestBearerKeyDraft("")
    setRevealedLinkcrestBearerKeySlug(null)
  }, [])

  return {
    connectionAuthType,
    connectionId,
    connectionName,
    connectorOptionalScopes,
    credentialDrafts,
    environment,
    isReplacingConnectionCredentials,
    linkcrestBearerKeyDraft,
    linkcrestOpenClawBaseUrlDraft,
    microsoftAuthorityMode,
    microsoftTenantId,
    outlookInstallSenderDrafts,
    outlookSenderEmail,
    retainUnverifiedCredentials,
    revealedCredentialDrafts,
    revealedLinkcrestBearerKeySlug,
    selectedAgentIds,
    selectedAuditorAgentId,
    selectedCapabilities,
    selectedFilePath,
    selectedManagerAgentId,
    selectedSlug,
    selectMarketplaceApp,
    setConnectionAuthType,
    setConnectionId,
    setConnectionName,
    setConnectorOptionalScopes,
    setCredentialDrafts,
    setEnvironment,
    setIsReplacingConnectionCredentials,
    setLinkcrestBearerKeyDraft,
    setLinkcrestOpenClawBaseUrlDraft,
    setMicrosoftAuthorityMode,
    setMicrosoftTenantId,
    setOutlookInstallSenderDrafts,
    setOutlookSenderEmail,
    setRetainUnverifiedCredentials,
    setRevealedCredentialDrafts,
    setRevealedLinkcrestBearerKeySlug,
    setSelectedAgentIds,
    setSelectedAuditorAgentId,
    setSelectedCapabilities,
    setSelectedFilePath,
    setSelectedManagerAgentId,
    setSelectedSlug,
    setXOptionalScopes,
    xOptionalScopes,
  }
}
