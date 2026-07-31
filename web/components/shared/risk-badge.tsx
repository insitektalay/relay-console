import { Badge } from "@/components/ui/badge"

export function RiskBadge({ risk }: { risk: string }) {
  const color
    = risk === "critical"
      ? "border-red-500/18 bg-red-500/10 text-red-200"
      : risk === "high"
        ? "border-orange-500/18 bg-orange-500/10 text-orange-200"
        : "border-amber-500/18 bg-amber-500/10 text-amber-200"

  return <Badge className={`capitalize ${color}`}>{risk}</Badge>
}
