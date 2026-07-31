"use client"

import type { MarketplaceApp } from "@clawchat/contracts"
import { useState } from "react"
import marketplaceIconAtlas from "@/lib/marketplace-icon-atlas-index.json"
import { cn } from "@/lib/utils"

const MARKETPLACE_ICON_ATLAS_URL = "/marketplace/marketplace-icon-atlas.png"

export function AppLogo({
  app,
  size = "md",
}: {
  app: Pick<MarketplaceApp, "slug" | "name">
  size?: "xs" | "sm" | "md" | "lg"
}) {
  const [atlasFailed, setAtlasFailed] = useState(false)
  const atlasEntry = marketplaceIconAtlas.apps[
    app.slug as keyof typeof marketplaceIconAtlas.apps
  ]
  const boxClass =
    size === "lg"
      ? "size-14 rounded-[8px]"
      : size === "xs"
        ? "size-5 rounded-[4px]"
      : size === "sm"
        ? "size-10 rounded-[6px]"
        : "size-11 rounded-[6px]"

  if (!atlasEntry || atlasFailed) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] text-xs font-semibold text-[var(--claw-text-muted)]",
          boxClass
        )}
      >
        {app.name.slice(0, 2).toUpperCase()}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border border-[color-mix(in_srgb,var(--claw-border)_24%,transparent)] bg-white shadow-sm",
        boxClass
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- The local atlas is cropped with CSS as a sprite sheet, which next/image cannot preserve. */}
      <img
        src={MARKETPLACE_ICON_ATLAS_URL}
        alt={`${app.name} logo`}
        className="absolute max-w-none"
        loading="lazy"
        onError={() => setAtlasFailed(true)}
        style={{
          height: `${marketplaceIconAtlas.rows * 100}%`,
          left: `${atlasEntry.column * -100}%`,
          top: `${atlasEntry.row * -100}%`,
          width: `${marketplaceIconAtlas.columns * 100}%`,
        }}
      />
    </div>
  )
}
