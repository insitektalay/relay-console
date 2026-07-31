import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { UserEntity } from "../../entities";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CloudCommercialService } from "./cloud-commercial.service";
import { AllowReadOnlyEntitlement } from "./entitlement-bypass.decorator";
import { StripeBillingService } from "./stripe-billing.service";
import { AppleBillingService } from "./apple-billing.service";
import {
  AppleServerNotificationDto,
  SubmitAppleTransactionDto,
} from "./dto/apple-billing.dto";

@ApiTags("billing")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@AllowReadOnlyEntitlement()
@Controller("workspaces/:workspaceId/billing")
export class WorkspaceBillingController {
  constructor(
    private readonly billing: StripeBillingService,
    private readonly appleBilling: AppleBillingService,
    private readonly cloud: CloudCommercialService,
  ) {}

  @Get("status")
  status(
    @CurrentUser() user: UserEntity,
    @Param("workspaceId") workspaceId: string,
  ) {
    return this.cloud.entitlements(user.id, workspaceId);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("checkout")
  checkout(
    @CurrentUser() user: UserEntity,
    @Param("workspaceId") workspaceId: string,
    @Body()
    body: { plan?: "relay_connect_monthly" | "relay_managed_cloud_monthly" },
  ) {
    return this.billing.createCheckout(user.id, workspaceId, body?.plan);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("portal")
  portal(
    @CurrentUser() user: UserEntity,
    @Param("workspaceId") workspaceId: string,
  ) {
    return this.billing.createPortal(user.id, workspaceId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("apple/transactions")
  appleTransaction(
    @CurrentUser() user: UserEntity,
    @Param("workspaceId") workspaceId: string,
    @Body() dto: SubmitAppleTransactionDto,
  ) {
    return this.appleBilling.submitTransaction(
      user.id,
      workspaceId,
      dto.signedTransaction,
    );
  }
}

@ApiTags("billing")
@Controller("billing/webhooks")
export class StripeBillingWebhookController {
  constructor(
    private readonly billing: StripeBillingService,
    private readonly appleBilling: AppleBillingService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post("stripe")
  stripe(
    @Req() request: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature?: string,
  ) {
    return this.billing.handleWebhook(
      request.rawBody || Buffer.alloc(0),
      signature,
    );
  }

  @Public()
  @Throttle({ default: { limit: 240, ttl: 60_000 } })
  @Post("apple")
  apple(@Body() dto: AppleServerNotificationDto) {
    return this.appleBilling.handleNotification(dto.signedPayload);
  }
}
