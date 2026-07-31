import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsArray, IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import {
  OperatorAuthenticated,
  Public,
} from "../../common/decorators/public.decorator";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { UserEntity } from "../../entities";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CloudCommercialService } from "./cloud-commercial.service";
import { AllowReadOnlyEntitlement } from "./entitlement-bypass.decorator";
import { RelayOperatorGuard } from "./operator.guard";
import { BillingObservabilityService } from "./billing-observability.service";
import { OperationsObservabilityService } from "./operations-observability.service";
import { IsBcryptCompatiblePassword } from "../auth/password-policy";

export class OwnerBootstrapDto {
  @IsString() @MinLength(32) @MaxLength(256) token: string;
  @IsEmail() email: string;
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsString()
  @MinLength(12)
  @MaxLength(72)
  @IsBcryptCompatiblePassword()
  password: string;
}

class SupportGrantDto {
  @IsString() @MinLength(1) @MaxLength(200) supportPrincipalId: string;
  @IsArray() @IsString({ each: true }) scopes: string[];
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @IsInt() @Min(5) @Max(1440) expiresInMinutes: number;
}

@ApiTags("deployment")
@UseInterceptors(ResponseInterceptor)
@Controller("deployment")
export class CloudDeploymentController {
  constructor(private readonly cloud: CloudCommercialService) {}

  @Public() @Get("manifest") manifest() { return this.cloud.manifest(); }
  @Public() @Get("release") release() { return this.cloud.releaseManifest(); }
  @Public() @Get("connection-package") connectionPackage() { return this.cloud.connectionPackage(); }
  @Public() @Get("compatibility") compatibility(@Query("clientKind") clientKind: string, @Query("version") version: string, @Query("contractVersion") contractVersion: string, @Query("deploymentId") deploymentId?: string) { return this.cloud.compatibility(clientKind, version, contractVersion, deploymentId); }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("bootstrap/owner")
  bootstrapOwner(@Body() dto: OwnerBootstrapDto) { return this.cloud.bootstrapOwner(dto); }
}

@ApiTags("commercial-cloud")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller("workspaces/:workspaceId/cloud")
export class WorkspaceCloudController {
  constructor(private readonly cloud: CloudCommercialService) {}

  @Get("entitlements") entitlements(@CurrentUser() user: UserEntity, @Param("workspaceId") workspaceId: string) { return this.cloud.entitlements(user.id, workspaceId); }
  @Get("support-bundle") supportBundle(@CurrentUser() user: UserEntity, @Param("workspaceId") workspaceId: string) { return this.cloud.supportBundle(user.id, workspaceId); }
  @Post("support-grants") createSupportGrant(@CurrentUser() user: UserEntity, @Param("workspaceId") workspaceId: string, @Body() dto: SupportGrantDto) { return this.cloud.createSupportGrant(user.id, workspaceId, dto); }
  @Delete("support-grants/:grantId") revokeSupportGrant(@CurrentUser() user: UserEntity, @Param("workspaceId") workspaceId: string, @Param("grantId") grantId: string) { return this.cloud.revokeSupportGrant(user.id, workspaceId, grantId); }
}

@ApiTags("relay-operator")
@OperatorAuthenticated()
@AllowReadOnlyEntitlement()
@UseGuards(RelayOperatorGuard)
@UseInterceptors(ResponseInterceptor)
@Controller("operator")
export class RelayOperatorController {
  constructor(
    private readonly cloud: CloudCommercialService,
    private readonly billingObservability: BillingObservabilityService,
    private readonly operationsObservability: OperationsObservabilityService,
  ) {}

  @Get("overview") overview() { return this.cloud.operatorOverview(); }
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get("billing-observability") billingSnapshot() { return this.billingObservability.snapshot(); }
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get("operations-observability") operationsSnapshot() { return this.operationsObservability.snapshot(); }
  @Post("provisioning-jobs") provisioningJob(@Body() input: Record<string, unknown>) { return this.cloud.upsertProvisioningJob(input); }
  @Post("deployments") deployment(@Body() input: Record<string, unknown>) { return this.cloud.upsertOperatorDeployment(input); }
  @Post("subscriptions") subscription(@Body() input: Record<string, unknown>) { return this.cloud.upsertSubscription(input); }
  @Post("complimentary-lifetime-grants") complimentaryLifetimeGrant(@Body() input: Record<string, unknown>) { return this.cloud.grantComplimentaryLifetimeAccess(input); }
  @Delete("complimentary-lifetime-grants/:workspaceId") revokeComplimentaryLifetimeGrant(@Param("workspaceId") workspaceId: string, @Body() input: Record<string, unknown>) { return this.cloud.revokeComplimentaryLifetimeAccess(workspaceId, input); }
  @Post("backups") backup(@Body() input: Record<string, unknown>) { return this.cloud.recordBackup(input); }
  @Post("incidents") incident(@Body() input: Record<string, unknown>) { return this.cloud.upsertIncident(input); }
}
