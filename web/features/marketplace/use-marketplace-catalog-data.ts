"use client"

import {
  EMPTY_MARKETPLACE_CATALOG,
  EMPTY_MARKETPLACE_CONNECTIONS,
  EMPTY_MARKETPLACE_INSTALLS,
  isMarketplaceBetaUnavailable,
  marketplaceBetaUnavailableMessage,
  type MarketplaceView,
} from "@/components/marketplace/marketplace-domain"
import { sdk } from "@/lib/sdk"
import type {
  MarketplaceCatalog,
  MarketplaceCatalogPage,
  MarketplaceCategory,
} from "@clawchat/contracts"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

export function useMarketplaceCatalogData({
  canManageMarketplace,
  category,
  marketplaceView,
  search,
  selectedSlug,
  workspaceId,
}: {
  canManageMarketplace: boolean
  category: MarketplaceCategory | "all"
  marketplaceView: MarketplaceView
  search: string
  selectedSlug: string | null
  workspaceId: string
}) {
  const catalogQuery = useInfiniteQuery<MarketplaceCatalogPage, Error>({
    queryKey: [
      "marketplace",
      workspaceId,
      "catalog-page",
      search,
      category,
      marketplaceView,
    ],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      sdk.marketplace.catalogPage(workspaceId, {
        query: search || undefined,
        category: category === "all" ? undefined : category,
        sourceType:
          marketplaceView === "local"
            ? "local_repo"
            : marketplaceView === "external"
              ? "external_provider"
              : undefined,
        cursor: (pageParam as string | null) ?? undefined,
        limit: 50,
      }),
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor ?? undefined,
  })
  const connectionsQuery = useQuery({
    queryKey: ["marketplace", workspaceId, "connections"],
    queryFn: () => sdk.marketplace.connections(workspaceId),
  })
  const installsQuery = useQuery({
    queryKey: ["marketplace", workspaceId, "installs"],
    queryFn: () => sdk.marketplace.installs(workspaceId),
  })
  const auditQuery = useQuery({
    queryKey: ["marketplace", workspaceId, "audit"],
    queryFn: () => sdk.auditLogs.list(workspaceId, 1, 50),
    enabled: canManageMarketplace,
  })
  const bridgeDevicesQuery = useQuery({
    queryKey: ["marketplace", workspaceId, "bridge-devices"],
    queryFn: () => sdk.bridge.devices(workspaceId),
    enabled: canManageMarketplace,
  })
  const localSourceHostsQuery = useQuery({
    queryKey: ["marketplace", workspaceId, "local-source-hosts"],
    queryFn: () => sdk.marketplace.localSourceHosts(workspaceId),
    enabled: canManageMarketplace,
  })

  const pagedCatalog = useMemo<MarketplaceCatalog | undefined>(() => {
    const pages = catalogQuery.data?.pages
    if (!pages?.length) return undefined
    return {
      releaseManifest: pages[0].releaseManifest,
      categories: pages[0].categories,
      apps: pages.flatMap((page) => page.apps),
    }
  }, [catalogQuery.data?.pages])
  const catalog = pagedCatalog ?? EMPTY_MARKETPLACE_CATALOG
  const catalogUnavailable =
    !pagedCatalog &&
    (catalogQuery.isLoading || catalogQuery.isError)
  const catalogApps = useMemo(() => catalog.apps, [catalog.apps])
  const catalogTotalCount =
    catalogQuery.data?.pages[0]?.pageInfo.totalCount ?? catalogApps.length
  const apps = useMemo(
    () =>
      canManageMarketplace
        ? catalogApps
        : catalogApps.filter((app) => app.sourceType !== "local_repo"),
    [canManageMarketplace, catalogApps]
  )
  // Release metadata on each app is the authority. The retired global beta
  // allowlist must not obscure or contradict the canonical catalog.
  const marketplaceBetaMode = false
  const effectiveMarketplaceView =
    canManageMarketplace ||
    (marketplaceView !== "local" && marketplaceView !== "review")
      ? marketplaceView
      : "all"
  const connections = connectionsQuery.data ?? EMPTY_MARKETPLACE_CONNECTIONS
  const installs = installsQuery.data ?? EMPTY_MARKETPLACE_INSTALLS
  const localApps = useMemo(
    () => apps.filter((app) => app.sourceType === "local_repo"),
    [apps]
  )
  const externalApps = useMemo(
    () => apps.filter((app) => app.sourceType !== "local_repo"),
    [apps]
  )
  const selectedAppSummary = selectedSlug
    ? (apps.find((app) => app.slug === selectedSlug) ?? null)
    : null
  const selectedAppQuery = useQuery({
    queryKey: ["marketplace", workspaceId, "catalog-detail", selectedSlug],
    queryFn: () => sdk.marketplace.app(workspaceId, selectedSlug!),
    enabled: Boolean(selectedSlug),
    staleTime: 5 * 60_000,
  })
  const selectedApp = selectedAppQuery.data ?? selectedAppSummary
  const selectedAppBetaUnavailable = isMarketplaceBetaUnavailable(selectedApp)
  const selectedAppBetaUnavailableMessage =
    marketplaceBetaUnavailableMessage(selectedApp)
  const selectedAppUnavailableMessage =
    selectedApp && selectedApp.availability !== "available"
      ? selectedApp.availability === "unsupported"
        ? `${selectedApp.name} cannot be connected because the provider does not publish a supported direct account API or remote MCP service.`
        : `${selectedApp.name} is coming soon. Connection and agent actions will be enabled after the provider approves Relay's production integration.`
      : null

  return {
    apps,
    auditQuery,
    bridgeDevicesQuery,
    catalogApps,
    catalogQuery,
    catalogTotalCount,
    catalogUnavailable,
    connections,
    connectionsQuery,
    effectiveMarketplaceView,
    externalApps,
    installs,
    installsQuery,
    localApps,
    localSourceHostsQuery,
    marketplaceBetaMode,
    selectedApp,
    selectedAppBetaUnavailable,
    selectedAppBetaUnavailableMessage,
    selectedAppQuery,
    selectedAppUnavailableMessage,
  }
}
