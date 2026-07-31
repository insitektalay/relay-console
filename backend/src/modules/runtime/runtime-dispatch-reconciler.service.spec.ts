import { RuntimeDispatchReconcilerService } from "./runtime-dispatch-reconciler.service";

describe("RuntimeDispatchReconcilerService", () => {
  it("fails expired pending dispatches through the coordinator", async () => {
    const runtimeDispatchService = {
      findExpiredPendingDispatches: jest
        .fn()
        .mockResolvedValue([{ id: "dispatch-1" }, { id: "dispatch-2" }]),
    };
    const runtimeDispatchCoordinator = {
      failDispatchById: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RuntimeDispatchReconcilerService(
      runtimeDispatchService as never,
      runtimeDispatchCoordinator as never,
    );

    await service.reconcileExpiredPendingDispatches();

    expect(
      runtimeDispatchService.findExpiredPendingDispatches,
    ).toHaveBeenCalledWith(expect.any(Date), 100);
    expect(runtimeDispatchCoordinator.failDispatchById).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        dispatchId: "dispatch-1",
        code: "timeout",
      }),
    );
    expect(runtimeDispatchCoordinator.failDispatchById).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        dispatchId: "dispatch-2",
        code: "timeout",
      }),
    );
  });

  it("runs reconciliation once on application bootstrap", async () => {
    const runtimeDispatchService = {
      findExpiredPendingDispatches: jest.fn().mockResolvedValue([]),
    };
    const service = new RuntimeDispatchReconcilerService(
      runtimeDispatchService as never,
      { failDispatchById: jest.fn() } as never,
    );

    service.onApplicationBootstrap();
    await Promise.resolve();

    expect(
      runtimeDispatchService.findExpiredPendingDispatches,
    ).toHaveBeenCalledWith(expect.any(Date), 100);
  });
});
