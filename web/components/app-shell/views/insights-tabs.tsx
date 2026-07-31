"use client"
import { Button } from "@/components/ui/button"
import type {
  InsightsTab,
  RelayConsoleController,
} from "@/components/clawchat-web-app"

export function RelayConsoleInsightsTabs({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const { insightsTab, setInsightsTab } = controller

  const tabs: Array<[InsightsTab, string]> = [
    ["report", "Report"],
    ["analytics", "Analytics"],
  ]

  return (
    <div className="flex flex-wrap gap-2 border-b border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] pb-3">
      {tabs.map(([value, label]) => (
        <Button
          key={value}
          size="sm"
          type="button"
          variant={insightsTab === value ? "secondary" : "ghost"}
          onClick={() => setInsightsTab(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}
