"use client"

import {
  getPackQuality,
  type MarketplaceView,
} from "@/components/marketplace/marketplace-domain"
import {
  MARKETPLACE_CATEGORY_LABELS,
  MARKETPLACE_CATEGORY_ORDER,
} from "@/lib/marketplace-taxonomy"
import { sdk } from "@/lib/sdk"
import type {
  MarketplaceApp,
  MarketplaceCategory,
  MarketplaceConnection,
  MarketplaceInstall,
  MarketplaceRiskLevel,
  MarketplaceRuntimeFormat,
} from "@clawchat/contracts"
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

export function useMarketplaceViewData({
  approvalProfileId,
  apps,
  canManageMarketplace,
  category,
  connectionId,
  connections,
  effectiveCapabilities,
  effectiveMarketplaceView,
  externalApps,
  installs,
  localApps,
  riskFilter,
  runtimeFormat,
  search,
  selectedApp,
  selectedAppBetaUnavailable,
  selectedPackQuality,
  workspaceId,
}: {
  approvalProfileId: string
  apps: MarketplaceApp[]
  canManageMarketplace: boolean
  category: MarketplaceCategory | "all"
  connectionId: string
  connections: MarketplaceConnection[]
  effectiveCapabilities: string[]
  effectiveMarketplaceView: MarketplaceView
  externalApps: MarketplaceApp[]
  installs: MarketplaceInstall[]
  localApps: MarketplaceApp[]
  riskFilter: MarketplaceRiskLevel | "all"
  runtimeFormat: MarketplaceRuntimeFormat
  search: string
  selectedApp: MarketplaceApp | null
  selectedAppBetaUnavailable: boolean
  selectedPackQuality: MarketplaceApp["packQuality"] | null | undefined
  workspaceId: string
}) {
  const previewQuery = useQuery({
    queryKey: [
      "marketplace",
      workspaceId,
      "preview",
      selectedApp?.slug,
      connectionId,
      effectiveCapabilities.join(","),
      runtimeFormat,
      approvalProfileId,
    ],
    queryFn: () =>
      sdk.marketplace.previewPack(workspaceId, {
        appSlug: selectedApp!.slug,
        connectionId: connectionId || undefined,
        selectedCapabilities: effectiveCapabilities,
        runtimeFormat,
        approvalProfileId: approvalProfileId || undefined,
      }),
    enabled: Boolean(
      canManageMarketplace &&
      selectedApp &&
      selectedApp.availability !== "unsupported" &&
      !selectedAppBetaUnavailable
    ),
  })
  const generatedPackDetailQuery = useQuery({
    queryKey: ["marketplace", workspaceId, "generated-pack", selectedApp?.slug],
    queryFn: () =>
      sdk.marketplace.generatedPackDetail(workspaceId, selectedApp!.slug),
    enabled: Boolean(
      selectedApp &&
      canManageMarketplace &&
      selectedPackQuality?.level !== "curated" &&
      !selectedAppBetaUnavailable
    ),
  })
  const documentationHistoryQuery = useQuery({
    queryKey: [
      "marketplace",
      workspaceId,
      "documentation-history",
      selectedApp?.slug,
    ],
    queryFn: () =>
      sdk.marketplace.documentationHistory(workspaceId, selectedApp!.slug),
    enabled: Boolean(
      canManageMarketplace && selectedApp?.sourceType === "local_repo"
    ),
  })
  const localRepoDocsStatusQuery = useQuery({
    queryKey: [
      "marketplace",
      workspaceId,
      "local-repo-docs-status",
      selectedApp?.slug,
    ],
    queryFn: () =>
      sdk.marketplace.localRepoDocsStatus(workspaceId, selectedApp!.slug),
    enabled: Boolean(
      canManageMarketplace && selectedApp?.sourceType === "local_repo"
    ),
  })
  const packCoverageQuery = useQuery({
    queryKey: ["marketplace", workspaceId, "generated-pack-coverage"],
    queryFn: () => sdk.marketplace.generatedPackCoverage(workspaceId),
    enabled: canManageMarketplace,
  })

  const connectedAppSlugs = useMemo(
    () => new Set(connections.map((connection) => connection.appSlug)),
    [connections]
  )
  const installedAppSlugs = useMemo(
    () => new Set(installs.map((install) => install.appSlug)),
    [installs]
  )
  const reviewApps = useMemo(
    () =>
      apps.filter((app) => {
        const quality = getPackQuality(app)
        const metadata = (app.sourceMetadata ?? {}) as Record<string, unknown>
        return (
          app.sourceType === "local_repo" ||
          quality.publicationStatus === "review_needed" ||
          metadata.sourceChanged === true
        )
      }),
    [apps]
  )
  const baseViewApps = useMemo(() => {
    switch (effectiveMarketplaceView) {
      case "external":
        return externalApps
      case "local":
        return localApps
      case "connections":
        return apps
      case "installed":
        return apps.filter((app) => installedAppSlugs.has(app.slug))
      case "review":
        return reviewApps
      case "all":
      default:
        return apps
    }
  }, [
    apps,
    externalApps,
    installedAppSlugs,
    localApps,
    effectiveMarketplaceView,
    reviewApps,
  ])
  const filteredApps = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return baseViewApps.filter((app) => {
      const matchesCategory = category === "all" || app.category === category
      const matchesRisk = riskFilter === "all" || app.riskLevel === riskFilter
      const matchesSearch =
        !needle ||
        app.name.toLowerCase().includes(needle) ||
        app.description.toLowerCase().includes(needle) ||
        app.agentUseSummary.toLowerCase().includes(needle)
      return matchesCategory && matchesRisk && matchesSearch
    })
  }, [baseViewApps, category, riskFilter, search])
  const connectedFilteredApps = filteredApps.filter((app) =>
    connectedAppSlugs.has(app.slug)
  )
  const unconnectedFilteredApps = filteredApps.filter(
    (app) => !connectedAppSlugs.has(app.slug)
  )
  const localFilteredApps = filteredApps.filter(
    (app) => app.sourceType === "local_repo"
  )
  const groupedApps = useMemo(
    () =>
      MARKETPLACE_CATEGORY_ORDER.map((categoryId) => ({
        id: categoryId,
        label: MARKETPLACE_CATEGORY_LABELS[categoryId],
        apps: filteredApps.filter((app) => app.category === categoryId),
      })).filter((group) => group.apps.length),
    [filteredApps]
  )

  return {
    connectedAppSlugs,
    connectedFilteredApps,
    documentationHistoryQuery,
    filteredApps,
    generatedPackDetailQuery,
    groupedApps,
    installedAppSlugs,
    localFilteredApps,
    localRepoDocsStatusQuery,
    packCoverageQuery,
    previewQuery,
    reviewApps,
    unconnectedFilteredApps,
  }
}
