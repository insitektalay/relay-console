import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { type MarketplaceInstallRole } from "../marketplace-install-role";

const LOCAL_APP_AUTONOMY_MODES = [
  "safe_default",
  "internal_write",
  "supervised_external",
  "dangerously_skip_permissions",
  "custom_policy",
] as const;

export class CreateMarketplaceConnectionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  appSlug!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  displayName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  environment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  authType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;

  @ApiPropertyOptional({
    description:
      "Retain the encrypted credential only when the provider has no harmless verification probe.",
  })
  @IsOptional()
  @IsBoolean()
  retainUnverifiedCredentials?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedCapabilities?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateLocalMarketplaceAppDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @IsString()
  repoPath!: string;

  @ApiProperty({
    enum: ["openclaw_bridge", "hermes_bridge", "runtime_host"],
  })
  @IsIn(["openclaw_bridge", "hermes_bridge", "runtime_host"])
  sourceHostType!: "openclaw_bridge" | "hermes_bridge" | "runtime_host";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceHostId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bridgeDeviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  runtimeBindingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceHostLabel?: string;

  @ApiPropertyOptional({ enum: ["openclaw", "hermes"] })
  @IsOptional()
  @IsIn(["openclaw", "hermes"])
  runtimeType?: "openclaw" | "hermes";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localAppUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localApiUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  openApiSpecPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  docsSourcePath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  lifecycle?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  runtimeProfile?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localappconnectorCampaignId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localappconnectorCampaignName?: string;

  @ApiPropertyOptional({
    enum: ["manual_review", "auto_apply_safe", "auto_apply_full"],
  })
  @IsOptional()
  @IsIn(["manual_review", "auto_apply_safe", "auto_apply_full"])
  documentationAutomationMode?:
    | "manual_review"
    | "auto_apply_safe"
    | "auto_apply_full";

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  autonomyPolicy?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      "Required when autonomyPolicy selects dangerously_skip_permissions.",
  })
  @IsOptional()
  @IsBoolean()
  acknowledgeDangerouslySkipPermissions?: boolean;
}

export class UpdateLocalMarketplaceAppDto {
  @ApiPropertyOptional({
    enum: ["openclaw_bridge", "hermes_bridge", "runtime_host"],
  })
  @IsOptional()
  @IsIn(["openclaw_bridge", "hermes_bridge", "runtime_host"])
  sourceHostType?: "openclaw_bridge" | "hermes_bridge" | "runtime_host";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceHostId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bridgeDeviceId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  runtimeBindingId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceHostLabel?: string | null;

  @ApiPropertyOptional({ enum: ["openclaw", "hermes"] })
  @IsOptional()
  @IsIn(["openclaw", "hermes"])
  runtimeType?: "openclaw" | "hermes" | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  repoPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localAppUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localApiUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  openApiSpecPath?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  docsSourcePath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  lifecycle?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  runtimeProfile?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localappconnectorCampaignId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localappconnectorCampaignName?: string | null;

  @ApiPropertyOptional({
    enum: ["manual_review", "auto_apply_safe", "auto_apply_full"],
  })
  @IsOptional()
  @IsIn(["manual_review", "auto_apply_safe", "auto_apply_full"])
  documentationAutomationMode?:
    | "manual_review"
    | "auto_apply_safe"
    | "auto_apply_full";

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  autonomyPolicy?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description:
      "Required when autonomyPolicy selects dangerously_skip_permissions.",
  })
  @IsOptional()
  @IsBoolean()
  acknowledgeDangerouslySkipPermissions?: boolean;
}

export class SyncLocalAppConnectorPolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignName?: string | null;
}

export class ConfigureLocalAppConnectorOpenClawDto {
  @ApiProperty()
  @IsString()
  openclawBaseUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bearerKey?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignName?: string | null;
}

export class AutoConnectLocalAppDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workerAgentIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerAgentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  auditorAgentId?: string | null;

  @ApiPropertyOptional({ enum: LOCAL_APP_AUTONOMY_MODES })
  @IsOptional()
  @IsIn(LOCAL_APP_AUTONOMY_MODES)
  autonomyMode?:
    | "safe_default"
    | "internal_write"
    | "supervised_external"
    | "dangerously_skip_permissions"
    | "custom_policy";

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  autonomyPolicy?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceHostId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approvalProfileId?: string | null;

  @ApiPropertyOptional({
    description:
      "Required when the selected autonomy or approval policy is dangerously_skip_permissions.",
  })
  @IsOptional()
  @IsBoolean()
  acknowledgeDangerouslySkipPermissions?: boolean;
}

export class ApplyLocalRepoDocsProposalDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  approvedFileIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rejectedFileIds?: string[];
}

export class UpdateMarketplaceConnectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  environment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;

  @ApiPropertyOptional({
    description:
      "Retain the encrypted credential only when the provider has no harmless verification probe.",
  })
  @IsOptional()
  @IsBoolean()
  retainUnverifiedCredentials?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedCapabilities?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class StartXOAuthDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedCapabilities?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  environment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  returnTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  connectionId?: string;
}

export class CreateXApprovalDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  action!: string;

  @ApiProperty()
  @IsUUID()
  connectionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  requestingAgentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  policyProfile?: string;
}

export class ExecuteXWriteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  approvalId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  requestingAgentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string;
}

export class PreviewMarketplacePackDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  appSlug!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedCapabilities?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  approvalProfileId?: string;

  @ApiPropertyOptional({ enum: ["openclaw", "hermes"] })
  @IsOptional()
  @IsIn(["openclaw", "hermes"])
  runtimeFormat?: "openclaw" | "hermes";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(320)
  outlookSenderEmail?: string;
}

export class MarketplacePackDocsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_048)
  apiOverview?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_048)
  auth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_048)
  scopes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_048)
  rateLimits?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_048)
  webhooks?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_048)
  openApiSpec?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_048)
  postmanCollection?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_048)
  mcpManifest?: string;
}

export class UpdateMarketplacePackSourcesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => MarketplacePackDocsDto)
  docs?: MarketplacePackDocsDto;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  knownObjects?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  highRiskActions?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(1_000, { each: true })
  commonWorkflows?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(100_000, { each: true })
  manuallySuppliedNotes?: string[];
}

export class ImportMarketplacePackSourcesDto extends UpdateMarketplacePackSourcesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_048)
  apiDocsUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_048)
  authDocsUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_048)
  scopesDocsUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_048)
  rateLimitDocsUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_048)
  webhookDocsUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2_048)
  openApiSpecUrl?: string;

  @ApiPropertyOptional({
    description:
      "Bounded inline OpenAPI JSON or YAML. Host filesystem paths are not accepted.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2 * 1024 * 1024)
  openApiSpecContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  manualMarkdown?: string;
}

export class RecordMarketplacePackReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class InstallMarketplaceAppDto extends PreviewMarketplacePackDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  agentIds?: string[];

  @ApiProperty()
  @IsString()
  role!: MarketplaceInstallRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  libraryTargetFolder?: string;

  @ApiPropertyOptional({ enum: ["existing_agents", "activate_new_agent"] })
  @IsOptional()
  @IsIn(["existing_agents", "activate_new_agent"])
  targetMode?: "existing_agents" | "activate_new_agent";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  newAgentName?: string;

  @ApiPropertyOptional({ enum: ["openclaw", "hermes"] })
  @IsOptional()
  @IsIn(["openclaw", "hermes"])
  newAgentRuntimeType?: "openclaw" | "hermes";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  newAgentRole?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  acknowledgeGeneratedDraftRisk?: boolean;

  @ApiPropertyOptional({
    description:
      "Required when approvalProfileId is dangerously_skip_permissions.",
  })
  @IsOptional()
  @IsBoolean()
  acknowledgeDangerouslySkipPermissions?: boolean;
}

export class UpdateMarketplaceInstallDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedCapabilities?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  approvalProfileId?: string;

  @ApiPropertyOptional({
    description:
      "Required when approvalProfileId is dangerously_skip_permissions.",
  })
  @IsOptional()
  @IsBoolean()
  acknowledgeDangerouslySkipPermissions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(320)
  outlookSenderEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ValidateConnectorSenderIdentityDto {
  @ApiProperty()
  @IsString()
  @MaxLength(320)
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  installId?: string;
}
