import type { MarketplaceCategory } from "@clawchat/contracts"

export const MARKETPLACE_CATEGORY_LABELS: Record<MarketplaceCategory, string> =
  {
    communication: "Communication",
    work_management: "Work Management",
    knowledge_documents: "Knowledge & Documents",
    developer: "Developer",
    commerce_payments: "Commerce & Payments",
    crm_support: "CRM & Support",
    calendar: "Calendar",
    content_creative: "Content & Creative",
  }

export const MARKETPLACE_CATEGORY_ORDER: MarketplaceCategory[] = [
  "communication",
  "work_management",
  "knowledge_documents",
  "developer",
  "commerce_payments",
  "crm_support",
  "calendar",
  "content_creative",
]
