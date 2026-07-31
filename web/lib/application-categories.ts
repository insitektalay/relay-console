export type ApplicationCategory = "all" | "business" | "family" | "personal"
export type AssignableApplicationCategory = Exclude<ApplicationCategory, "all">

export type ApplicationClassification = {
  category: AssignableApplicationCategory
  subgroup: string
}

export type ApplicationClassifications = Record<string, ApplicationClassification>

export type ApplicationFilter = {
  category: ApplicationCategory
  subgroup?: string
}

export const APPLICATION_CATEGORY_LABELS: Record<ApplicationCategory, string> = {
  all: "All",
  business: "Business",
  family: "Family",
  personal: "Personal",
}

export const ASSIGNABLE_APPLICATION_CATEGORIES: AssignableApplicationCategory[] = [
  "business",
  "family",
  "personal",
]

export const APPLICATION_FILTER_OPTIONS: ApplicationCategory[] = [
  "all",
  "business",
  "family",
  "personal",
]

export const DEFAULT_APPLICATION_CLASSIFICATIONS: ApplicationClassifications = {
  gapminer: { category: "business", subgroup: "" },
  visualforge: { category: "business", subgroup: "" },
  pagejourney: { category: "business", subgroup: "" },
  rankscope: { category: "business", subgroup: "" },
  insightledger: { category: "business", subgroup: "" },
  "cleaning-ops-guide": { category: "business", subgroup: "Affiliate Website" },
  "campaign-switchboard": { category: "business", subgroup: "Affiliate Website" },
  saasgrowth: { category: "business", subgroup: "" },
  linkcrest: { category: "business", subgroup: "" },
  agentmint: { category: "business", subgroup: "" },
  clawchat: { category: "business", subgroup: "" },
  alexkerssweb: { category: "business", subgroup: "" },
  youtube: { category: "business", subgroup: "" },
  videogrowthlab: { category: "business", subgroup: "" },
  theoremscope: { category: "personal", subgroup: "" },
  archidraft: { category: "personal", subgroup: "" },
  hermitagelodge: { category: "personal", subgroup: "" },
  whitehouse: { category: "personal", subgroup: "" },
}

export function sanitizeApplicationClassifications(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_APPLICATION_CLASSIFICATIONS
  }

  const next: ApplicationClassifications = { ...DEFAULT_APPLICATION_CLASSIFICATIONS }

  for (const [appId, classification] of Object.entries(value)) {
    if (!classification || typeof classification !== "object" || Array.isArray(classification)) {
      continue
    }

    const raw = classification as Partial<ApplicationClassification>
    if (
      raw.category !== "business" &&
      raw.category !== "family" &&
      raw.category !== "personal"
    ) {
      continue
    }

    next[appId] = {
      category: raw.category,
      subgroup: typeof raw.subgroup === "string" ? raw.subgroup.trim() : "",
    }
  }

  return next
}

export function getApplicationClassification(
  classifications: ApplicationClassifications,
  appId: string
) {
  return classifications[appId] ?? DEFAULT_APPLICATION_CLASSIFICATIONS[appId] ?? null
}

export function isVisibleApplication(
  appId: string,
  filter: ApplicationFilter,
  classifications: ApplicationClassifications
) {
  if (appId === "missioncontrol") return false

  const classification = getApplicationClassification(classifications, appId)
  if (!classification) return false
  if (filter.category === "all") return true
  if (classification.category !== filter.category) return false
  return filter.subgroup ? classification.subgroup === filter.subgroup : true
}

export function getApplicationCategoryCounts(classifications: ApplicationClassifications) {
  const counts: Record<ApplicationCategory, number> = {
    all: 0,
    business: 0,
    family: 0,
    personal: 0,
  }

  for (const appId of Object.keys(classifications)) {
    if (appId === "missioncontrol") continue
    if (appId.startsWith("__subgroup__")) continue
    const classification = getApplicationClassification(classifications, appId)
    if (!classification) continue
    counts.all += 1
    counts[classification.category] += 1
  }

  return counts
}

export function getApplicationSubgroups(classifications: ApplicationClassifications) {
  const groups: Record<AssignableApplicationCategory, string[]> = {
    business: [],
    family: [],
    personal: [],
  }

  for (const classification of Object.values(classifications)) {
    if (!classification.subgroup) continue
    if (!groups[classification.category].includes(classification.subgroup)) {
      groups[classification.category].push(classification.subgroup)
    }
  }

  return {
    business: groups.business.sort((a, b) => a.localeCompare(b)),
    family: groups.family.sort((a, b) => a.localeCompare(b)),
    personal: groups.personal.sort((a, b) => a.localeCompare(b)),
  }
}
