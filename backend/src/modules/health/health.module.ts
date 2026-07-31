import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { MESSAGE_CONDENSING_QUEUE } from "../message/message-condensed.types";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { BillingObservabilityService } from "../cloud-commercial/billing-observability.service";
import { OperationsObservabilityService } from "../cloud-commercial/operations-observability.service";
import { SyntheticMonitorService } from "./synthetic-monitor.service";
import { RelayOperatorGuard } from "../cloud-commercial/operator.guard";

@Module({
  imports: [
    BullModule.registerQueue({
      name: MESSAGE_CONDENSING_QUEUE,
    }),
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    BillingObservabilityService,
    OperationsObservabilityService,
    SyntheticMonitorService,
    RelayOperatorGuard,
  ],
  exports: [
    HealthService,
    BillingObservabilityService,
    OperationsObservabilityService,
  ],
})
export class HealthModule {}
