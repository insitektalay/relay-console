import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { RelayOperatorController } from "./cloud-commercial.controller";
import { RelayOperatorGuard } from "./operator.guard";

describe("billing observability controller contract", () => {
  it("keeps the snapshot behind the operator-secret guard", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, RelayOperatorController) as unknown[];
    expect(guards).toContain(RelayOperatorGuard);

    const handler = Object.getOwnPropertyDescriptor(
      RelayOperatorController.prototype,
      "billingSnapshot",
    )!.value;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe("billing-observability");
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
  });

  it("returns only the observability service snapshot", async () => {
    const expected = { schemaVersion: "relay.billing-observability.v1" };
    const billingObservability = { snapshot: jest.fn().mockResolvedValue(expected) };
    const controller = new RelayOperatorController(
      {} as any,
      billingObservability as any,
      {} as any,
    );

    await expect(controller.billingSnapshot()).resolves.toBe(expected);
    expect(billingObservability.snapshot).toHaveBeenCalledTimes(1);
  });

  it("keeps the operations snapshot behind the same operator-secret guard", async () => {
    const handler = Object.getOwnPropertyDescriptor(
      RelayOperatorController.prototype,
      "operationsSnapshot",
    )!.value;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe("operations-observability");
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);

    const expected = { schemaVersion: "relay.operations-observability.v1" };
    const operationsObservability = { snapshot: jest.fn().mockResolvedValue(expected) };
    const controller = new RelayOperatorController(
      {} as any,
      {} as any,
      operationsObservability as any,
    );

    await expect(controller.operationsSnapshot()).resolves.toBe(expected);
    expect(operationsObservability.snapshot).toHaveBeenCalledTimes(1);
  });
});
