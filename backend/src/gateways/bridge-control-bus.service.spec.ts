import { ConfigService } from "@nestjs/config";
import { createClient } from "redis";
import { BridgeControlBusService } from "./bridge-control-bus.service";

jest.mock("redis", () => ({ createClient: jest.fn() }));

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function client(connect: () => Promise<unknown>) {
  return {
    isReady: false,
    connect: jest.fn(connect),
    subscribe: jest.fn(async () => undefined),
    publish: jest.fn(async () => 1),
    on: jest.fn(),
    quit: jest.fn(async () => undefined),
    disconnect: jest.fn(),
  };
}

describe("BridgeControlBusService Redis outage startup", () => {
  beforeEach(() => mockedCreateClient.mockReset());

  it("does not block application startup while Redis is unavailable", () => {
    const neverConnects = () => new Promise<unknown>(() => undefined);
    const publisher = client(neverConnects);
    const subscriber = client(neverConnects);
    mockedCreateClient
      .mockReturnValueOnce(publisher as never)
      .mockReturnValueOnce(subscriber as never);
    const service = new BridgeControlBusService({
      get: (key: string) => key === "REDIS_URL" ? "redis://redis.invalid:6379" : undefined,
    } as ConfigService);

    expect(service.onModuleInit()).toBeUndefined();
    expect(publisher.connect).toHaveBeenCalledTimes(1);
    expect(subscriber.connect).toHaveBeenCalledTimes(1);
    expect(service.isEnabled()).toBe(false);
  });

  it("becomes enabled after both clients connect and subscriptions complete", async () => {
    const publisher = client(async () => { publisher.isReady = true; });
    const subscriber = client(async () => { subscriber.isReady = true; });
    mockedCreateClient
      .mockReturnValueOnce(publisher as never)
      .mockReturnValueOnce(subscriber as never);
    const service = new BridgeControlBusService({
      get: (key: string) => key === "REDIS_URL" ? "redis://redis.invalid:6379" : undefined,
    } as ConfigService);

    service.onModuleInit();
    await new Promise((resolve) => setImmediate(resolve));

    expect(service.isEnabled()).toBe(true);
    expect(subscriber.subscribe).toHaveBeenCalledTimes(4);
    await service.onModuleDestroy();
  });
});
