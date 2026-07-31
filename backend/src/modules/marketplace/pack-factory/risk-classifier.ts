import {
  type MarketplaceCategory,
  type MarketplaceRiskLevel,
} from "../catalog/marketplace-catalog.types";
import { type MarketplacePackFactoryConfig } from "./types";

export const HIGH_RISK_CATEGORIES = new Set<MarketplaceCategory>([
  "communication",
  "commerce_payments",
  "crm_support",
  "developer",
  "knowledge_documents",
  "content_creative",
]);

const HIGH_RISK_TERMS = [
  "payment",
  "money",
  "refund",
  "invoice",
  "email",
  "message",
  "send",
  "customer",
  "deploy",
  "repository",
  "source",
  "admin",
  "security",
  "delete",
  "export",
  "publish",
  "permission",
  "bulk",
  "healthcare",
  "legal",
  "financial",
];

export function classifyGeneratedPackRisk(config: MarketplacePackFactoryConfig) {
  const text = [
    config.category,
    config.riskLevel,
    ...(config.highRiskActions ?? []),
    ...(config.commonWorkflows ?? []),
    ...(config.knownObjects ?? []),
    ...(config.manuallySuppliedNotes ?? []),
  ]
    .join(" ")
    .toLowerCase();
  const detectedTerms = HIGH_RISK_TERMS.filter((term) => text.includes(term));
  const highRisk =
    config.riskLevel === "high" ||
    config.riskLevel === "critical" ||
    detectedTerms.length > 0 ||
    HIGH_RISK_CATEGORIES.has(config.category);
  return {
    highRisk,
    detectedTerms,
    recommendedRiskLevel: highRisk ? config.riskLevel : ("low" as MarketplaceRiskLevel),
  };
}
