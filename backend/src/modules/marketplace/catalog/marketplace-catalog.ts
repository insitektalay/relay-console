import { GENERATED_MARKETPLACE_CATALOG } from "./generated-marketplace-catalog";
import { type MarketplaceCategory } from "./marketplace-catalog.types";

export const MARKETPLACE_CATEGORY_LABELS: Record<MarketplaceCategory, string> =
  {
    communication: "Communication apps",
    calendar: "Calendar and scheduling apps",
    work_management: "Work-management apps",
    knowledge_documents: "Knowledge/document apps",
    developer: "Developer apps",
    commerce_payments: "Commerce/payment apps",
    crm_support: "CRM/support apps",
    content_creative: "Content/creative apps",
  };

/**
 * The canonical provider manifests are the sole source of Marketplace catalog
 * membership and provider metadata.
 *
 * Keep this compatibility export while callers migrate to the generated name.
 */
export const MARKETPLACE_CATALOG = GENERATED_MARKETPLACE_CATALOG;
