import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import { TOOL_REQUEST_STATUSES, type ToolRequestStatus } from "../../../entities";

export const TOOL_REQUEST_CAPABILITIES = [
  "browser_navigation",
  "external_search",
  "web_search",
  "prospect_discovery",
  "content_extraction",
  "research",
  "deep_research",
  "evidence_gathering",
  "competitor_research",
  "backlink_prospecting",
  "public_form_fill",
  "public_form_submit",
  "email_draft",
  "email_send",
  "email_read",
  "email_reply",
  "email_forward",
  "account_creation",
  "credential_use",
  "external_publishing",
  "backlink_verification",
  "index_checking",
  "lifecycle_contacted_submitted",
  "lifecycle_live_indexed",
  "linkcrest_openclaw_tools",
  "local_app_record_write",
  "other",
] as const;

export type ToolRequestCapability = (typeof TOOL_REQUEST_CAPABILITIES)[number];

export class CreateToolRequestDto {
  @IsOptional()
  @IsString()
  linkedAppId?: string | null;

  @IsOptional()
  @IsString()
  appSlug?: string | null;

  @IsOptional()
  @IsString()
  teamId?: string | null;

  @IsOptional()
  @IsString()
  threadId?: string | null;

  @IsOptional()
  @IsString()
  campaignId?: string | null;

  @IsOptional()
  @IsString()
  campaignName?: string | null;

  @IsOptional()
  @IsString()
  requestingAgentId?: string | null;

  @IsOptional()
  @IsString()
  requestingAgentName?: string | null;

  @IsOptional()
  @IsString()
  agentId?: string | null;

  @IsOptional()
  @IsString()
  requestingAgentSlug?: string | null;

  @IsOptional()
  @IsString()
  role?: string | null;

  @IsString()
  requestedCapability!: string;

  @IsString()
  requiredForAction!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  relatedTaskId?: string | null;

  @IsOptional()
  @IsString()
  relatedRecordType?: string | null;

  @IsOptional()
  @IsString()
  relatedRecordId?: string | null;

  @IsOptional()
  @IsString()
  autonomyModeAtRequest?: string | null;

  @IsOptional()
  @IsBoolean()
  policyAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  toolAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  toolConnected?: boolean;

  @IsOptional()
  @IsBoolean()
  toolGranted?: boolean;

  @IsOptional()
  @IsArray()
  suggestedMarketplaceAppSlugs?: string[];

  @IsOptional()
  @IsArray()
  suggestedMarketplaceApps?: string[];

  @IsOptional()
  @IsArray()
  suggestedToolCategories?: string[];

  @IsOptional()
  @IsString()
  requiredEvidenceType?: string | null;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateToolRequestStatusDto {
  @IsIn(TOOL_REQUEST_STATUSES)
  status!: ToolRequestStatus;

  @IsOptional()
  @IsString()
  resolutionNotes?: string | null;
}
