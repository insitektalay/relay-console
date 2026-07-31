"use client"

import {
  MarketplaceScreen,
  type MarketplaceAgentRecoveryRequest,
} from "@/components/marketplace/marketplace-screen"
import { OrganizationPipelinePage } from "@/components/mission-control/organization-pipeline-page"
import type {
  ApplicationClassifications,
  ApplicationFilter,
} from "@/lib/application-categories"
import type {
  Agent,
  Company,
  Department,
  MarketplaceCategory,
  MarketplaceRiskLevel,
  Team,
} from "@clawchat/contracts"

type MissionControlView = "dashboard" | "marketplace" | "pipeline" | "classify"

interface MissionControlSectionProps {
  view: MissionControlView
  filter: ApplicationFilter
  classifications: ApplicationClassifications
  onClassificationsChange: (classifications: ApplicationClassifications) => void
  onViewChange: (view: MissionControlView) => void
  workspaceId?: string | null
  agents?: Agent[]
  companies?: Company[]
  departments?: Department[]
  teams?: Team[]
  marketplaceSearch: string
  marketplaceCategory: MarketplaceCategory | "all"
  marketplaceRiskFilter: MarketplaceRiskLevel | "all"
  initialMarketplaceAppSlug?: string | null
  onMarketplaceSearchChange?: (search: string) => void
  onMarketplaceCategoryChange?: (category: MarketplaceCategory | "all") => void
  onMarketplaceAppSlugChange?: (slug: string | null) => void
  onMarketplaceConnectionComplete?: (input: {
    appName: string
    operatorAgentId: string
    message: string
  }) => Promise<void> | void
  onCreateMarketplaceCompatibleAgent?: (
    input: MarketplaceAgentRecoveryRequest
  ) => void
  onOpenMarketplaceRuntimePairing?: (
    input: MarketplaceAgentRecoveryRequest
  ) => void
  canAccessMissionControl: boolean
  canManageMarketplace?: boolean
}

export function MissionControlSection({
  view,
  onViewChange,
  workspaceId,
  agents,
  companies,
  departments,
  teams,
  marketplaceSearch,
  marketplaceCategory,
  marketplaceRiskFilter,
  initialMarketplaceAppSlug,
  onMarketplaceSearchChange,
  onMarketplaceCategoryChange,
  onMarketplaceAppSlugChange,
  onMarketplaceConnectionComplete,
  onCreateMarketplaceCompatibleAgent,
  onOpenMarketplaceRuntimePairing,
  canManageMarketplace,
}: MissionControlSectionProps) {
  const selectedMarketplaceAppSlug = initialMarketplaceAppSlug ?? null

  if (view === "marketplace") {
    return workspaceId ? (
      <MarketplaceScreen
        key={selectedMarketplaceAppSlug ?? "marketplace"}
        workspaceId={workspaceId}
        agents={agents ?? []}
        canManageMarketplace={canManageMarketplace === true}
        search={marketplaceSearch}
        category={marketplaceCategory}
        riskFilter={marketplaceRiskFilter}
        initialSelectedAppSlug={selectedMarketplaceAppSlug}
        onSearchChange={onMarketplaceSearchChange}
        onCategoryChange={onMarketplaceCategoryChange}
        onSelectedAppSlugChange={onMarketplaceAppSlugChange}
        onConnectionComplete={onMarketplaceConnectionComplete}
        onCreateCompatibleAgent={onCreateMarketplaceCompatibleAgent}
        onOpenRuntimePairing={onOpenMarketplaceRuntimePairing}
      />
    ) : (
      <div className="flex h-full items-center justify-center text-sm text-[var(--claw-text-muted)]">
        Create a workspace before installing marketplace apps.
      </div>
    )
  }

  if (view === "pipeline") {
    return (
      <OrganizationPipelinePage
        companies={companies ?? []}
        departments={departments ?? []}
        teams={teams ?? []}
        agents={agents ?? []}
        onBack={() => onViewChange("marketplace")}
      />
    )
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-sidebar)] p-4 text-sm text-[var(--claw-text-muted)]">
        <div className="text-base font-semibold text-[var(--claw-text-primary)]">
          Local controls retired
        </div>
        <div className="mt-2">
          Host process and repository controls are not part of the web
          application. Use Marketplace for Railway-backed integrations.
        </div>
        <button
          type="button"
          className="mt-4 h-8 rounded-[4px] border border-[color-mix(in_srgb,var(--claw-accent-blue)_36%,transparent)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_12%,var(--claw-bg-surface))] px-3 text-xs font-medium text-[#b9d6f8]"
          onClick={() => onViewChange("marketplace")}
        >
          Open Marketplace
        </button>
      </div>
    </div>
  )
}
