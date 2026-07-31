export const MARKETPLACE_INSTALL_ROLES = ["worker", "auditor", "manager"] as const;

export type MarketplaceInstallRole = string;

export function marketplaceRoleLabel(role: MarketplaceInstallRole) {
  if (role === "auditor") return "Auditor";
  if (role === "manager") return "Manager";
  if (role === "worker") return "Worker / Operator";
  return role
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
