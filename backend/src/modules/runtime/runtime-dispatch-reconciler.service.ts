import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { RuntimeDispatchCoordinator } from "./runtime-dispatch-coordinator.service";
import { RuntimeDispatchService } from "./runtime-dispatch.service";

const RECONCILE_BATCH_SIZE = 100;

@Injectable()
export class RuntimeDispatchReconcilerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RuntimeDispatchReconcilerService.name);

  constructor(
    private readonly runtimeDispatchService: RuntimeDispatchService,
    private readonly runtimeDispatchCoordinator: RuntimeDispatchCoordinator,
  ) {}

  onApplicationBootstrap(): void {
    void this.reconcileExpiredPendingDispatches().catch((error) => {
      this.logger.warn(
        `Failed to run startup runtime dispatch reconciliation: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  @Cron("*/15 * * * * *")
  async reconcileExpiredPendingDispatches(): Promise<void> {
    const now = new Date();
    const expiredDispatches =
      await this.runtimeDispatchService.findExpiredPendingDispatches(
        now,
        RECONCILE_BATCH_SIZE,
      );

    for (const dispatch of expiredDispatches) {
      try {
        await this.runtimeDispatchCoordinator.failDispatchById({
          dispatchId: dispatch.id,
          code: "timeout",
          message:
            "Runtime dispatch timed out before the agent posted a reply.",
          retryable: true,
          failedAt: now,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to reconcile expired runtime dispatch ${dispatch.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}
