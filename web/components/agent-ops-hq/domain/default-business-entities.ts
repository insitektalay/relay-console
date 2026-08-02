import type {
  AgentOpsApplication,
  AgentOpsBusinessUnit,
  AgentOpsOutputType,
  AgentOpsWebsite,
  AgentOpsWorkflow,
} from "./estate-types"

export const DEFAULT_AGENTOPS_BUSINESS_UNITS: AgentOpsBusinessUnit[] = [
  { id: "executive", label: "Executive", defaultDepartmentId: "executive", visualTheme: "executive", status: "active" },
  { id: "infrastructure", label: "Mission Control / Infrastructure", defaultDepartmentId: "mission_control_infrastructure", visualTheme: "infrastructure", status: "active" },
  { id: "youtube", label: "YouTube Growth", defaultDepartmentId: "youtube_department", visualTheme: "youtube", status: "active" },
  { id: "seo_growth", label: "SEO Growth", defaultDepartmentId: "seo_department", visualTheme: "research", status: "active" },
  { id: "affiliate_factory", label: "Affiliate Website Factory", defaultDepartmentId: "affiliate_website_factory", visualTheme: "affiliate", status: "active" },
  { id: "creative", label: "Creative Production", defaultDepartmentId: "visual_design_department", visualTheme: "creative", status: "active" },
  { id: "saas_growth", label: "SaaS Marketing", defaultDepartmentId: "growthos_department", visualTheme: "growth", status: "active" },
  { id: "operations", label: "Business Operations", defaultDepartmentId: "admin", visualTheme: "operations", status: "active" },
  { id: "civic_mode", label: "White House Mode", defaultDepartmentId: "white_house_president_office", visualTheme: "civic", status: "planned" },
]

export const DEFAULT_AGENTOPS_OUTPUT_TYPES: AgentOpsOutputType[] = [
  { id: "opportunity", label: "Opportunities", businessUnitId: "seo_growth", departmentId: "gapminer_office", visualTheme: "research" },
  { id: "affiliate_research", label: "Affiliate Research", businessUnitId: "affiliate_factory", departmentId: "affiliate_website_factory", visualTheme: "affiliate" },
  { id: "serp_gap", label: "SERP Gaps", businessUnitId: "seo_growth", departmentId: "gapminer_office", visualTheme: "research" },
  { id: "seo_report", label: "SEO Reports", businessUnitId: "seo_growth", departmentId: "rankscope_seo_office", visualTheme: "seo" },
  { id: "page_intent_report", label: "Page Intent Reports", businessUnitId: "seo_growth", departmentId: "page_journey_intent_lab", visualTheme: "lab" },
  { id: "copy_improvement", label: "Copy Improvements", businessUnitId: "creative", departmentId: "copy_department", visualTheme: "copy" },
  { id: "visual_layout", label: "Visual Layouts", businessUnitId: "creative", departmentId: "visual_design_department", visualTheme: "creative" },
  { id: "video_idea", label: "YouTube Video Ideas", businessUnitId: "youtube", departmentId: "youtube_department", visualTheme: "youtube" },
  { id: "youtube_video", label: "YouTube Videos", businessUnitId: "youtube", departmentId: "youtube_department", visualTheme: "youtube" },
  { id: "short", label: "Shorts", businessUnitId: "youtube", departmentId: "short_relay_studio", visualTheme: "studio" },
  { id: "backlink_opportunity", label: "Backlink Opportunities", businessUnitId: "seo_growth", departmentId: "localappconnector_department", visualTheme: "link" },
  { id: "saas_marketing_plan", label: "SaaS Marketing Plans", businessUnitId: "saas_growth", departmentId: "growthos_department", visualTheme: "growth" },
]

export const DEFAULT_AGENTOPS_WEBSITES: AgentOpsWebsite[] = [
  { id: "alexkerss_website", label: "alexkerss.com", url: "https://alexkerss.com", businessUnitId: "operations", appIds: [], visualTheme: "operations" },
  { id: "ai_tube_watch_website", label: "AI Tube Watch Website", businessUnitId: "youtube", departmentId: "youtube_department", appIds: ["ai_tube_watch"], visualTheme: "youtube" },
  { id: "financial_tube_watch", label: "Financial Tube Watch", businessUnitId: "youtube", departmentId: "youtube_department", appIds: ["ai_tube_watch"], visualTheme: "youtube" },
  { id: "affiliate_websites", label: "Affiliate Websites", businessUnitId: "affiliate_factory", departmentId: "affiliate_website_factory", appIds: ["gapminer", "pagejourney", "rankscope"], visualTheme: "affiliate" },
]

export const DEFAULT_AGENTOPS_APPLICATIONS: AgentOpsApplication[] = [
  { appId: "missioncontrol", label: "Mission Control", businessUnitId: "infrastructure", defaultDepartmentId: "mission_control_infrastructure", outputTypes: [], publicProperties: [], agentIds: [], visualTheme: "infrastructure", status: "active" },
  { appId: "clawchat", label: "Relay Console", businessUnitId: "infrastructure", defaultDepartmentId: "mission_control_infrastructure", outputTypes: [], publicProperties: [], agentIds: [], visualTheme: "infrastructure", status: "active" },
  { appId: "ai_tube_watch", label: "AI Tube Watch", businessUnitId: "youtube", defaultDepartmentId: "youtube_department", outputTypes: ["video_idea", "youtube_video"], publicProperties: ["ai_tube_watch_website"], agentIds: [], visualTheme: "youtube", status: "active" },
  { appId: "youtube", label: "YouTube Department", businessUnitId: "youtube", defaultDepartmentId: "youtube_department", outputTypes: ["video_idea", "youtube_video"], publicProperties: ["ai_tube_watch_website", "financial_tube_watch"], agentIds: [], visualTheme: "youtube", status: "active" },
  { appId: "short_relay", label: "Short Relay", businessUnitId: "youtube", defaultDepartmentId: "short_relay_studio", outputTypes: ["short"], publicProperties: ["ai_tube_watch_website"], agentIds: [], visualTheme: "studio", status: "active" },
  { appId: "gapminer", label: "GapMiner", businessUnitId: "seo_growth", defaultDepartmentId: "gapminer_office", outputTypes: ["opportunity", "affiliate_research", "serp_gap"], publicProperties: [], agentIds: [], visualTheme: "research", status: "active" },
  { appId: "localappconnector", label: "LocalAppConnector", businessUnitId: "seo_growth", defaultDepartmentId: "localappconnector_department", outputTypes: ["backlink_opportunity"], publicProperties: [], agentIds: [], visualTheme: "link", status: "active" },
  { appId: "pagejourney", label: "Page Journey", businessUnitId: "seo_growth", defaultDepartmentId: "page_journey_intent_lab", outputTypes: ["page_intent_report"], publicProperties: [], agentIds: [], visualTheme: "lab", status: "active" },
  { appId: "rankscope", label: "RankScope", businessUnitId: "seo_growth", defaultDepartmentId: "rankscope_seo_office", outputTypes: ["seo_report"], publicProperties: [], agentIds: [], visualTheme: "seo", status: "active" },
  { appId: "visualforge", label: "Visual Forge", businessUnitId: "creative", defaultDepartmentId: "visual_design_department", outputTypes: ["visual_layout"], publicProperties: [], agentIds: [], visualTheme: "creative", status: "active" },
  { appId: "copyloop", label: "CopyLoop", businessUnitId: "creative", defaultDepartmentId: "copy_department", outputTypes: ["copy_improvement"], publicProperties: [], agentIds: [], visualTheme: "copy", status: "planned" },
  { appId: "saasgrowth", label: "SaaS Discovery / GrowthOS", businessUnitId: "saas_growth", defaultDepartmentId: "growthos_department", outputTypes: ["saas_marketing_plan"], publicProperties: [], agentIds: [], visualTheme: "growth", status: "active" },
  { appId: "whitehouse", label: "White House App", businessUnitId: "civic_mode", defaultDepartmentId: "white_house_president_office", outputTypes: [], publicProperties: [], agentIds: [], visualTheme: "civic", status: "planned" },
]

export const DEFAULT_AGENTOPS_WORKFLOWS: AgentOpsWorkflow[] = [
  { id: "youtube_idea_to_video", label: "YouTube Idea to Video", businessUnitId: "youtube", departmentId: "youtube_department", appIds: ["ai_tube_watch", "youtube", "visualforge", "copyloop", "short_relay"], outputTypeIds: ["video_idea", "youtube_video", "short"], visualTheme: "youtube" },
  { id: "affiliate_site_factory", label: "Affiliate Site Factory", businessUnitId: "affiliate_factory", departmentId: "affiliate_website_factory", appIds: ["gapminer", "pagejourney", "rankscope", "visualforge", "copyloop"], outputTypeIds: ["affiliate_research", "serp_gap", "page_intent_report", "copy_improvement", "visual_layout"], visualTheme: "affiliate" },
  { id: "seo_growth_loop", label: "SEO Growth Loop", businessUnitId: "seo_growth", departmentId: "seo_department", appIds: ["gapminer", "rankscope", "localappconnector", "pagejourney"], outputTypeIds: ["opportunity", "seo_report", "backlink_opportunity", "page_intent_report"], visualTheme: "seo" },
  { id: "saas_growth_plan", label: "SaaS Growth Plan", businessUnitId: "saas_growth", departmentId: "growthos_department", appIds: ["saasgrowth"], outputTypeIds: ["saas_marketing_plan"], visualTheme: "growth" },
]
