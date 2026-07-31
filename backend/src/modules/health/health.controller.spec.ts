import {
  ExecutionContext,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import {
  AUTH_BOUNDARY_KEY,
  IS_PUBLIC_KEY,
} from "../../common/decorators/public.decorator";
import { RelayOperatorGuard } from "../cloud-commercial/operator.guard";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("publishes only coarse liveness and guards detailed checks as operator routes", () => {
    const handlers = HealthController.prototype as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >;

    for (const name of ["check", "live"]) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handlers[name])).toBe(true);
      expect(Reflect.getMetadata(AUTH_BOUNDARY_KEY, handlers[name])).toBe(
        "public",
      );
    }

    for (const name of ["ready", "synthetic"]) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handlers[name])).toBeUndefined();
      expect(Reflect.getMetadata(AUTH_BOUNDARY_KEY, handlers[name])).toBe(
        "operator",
      );
      expect(
        Reflect.getMetadata(GUARDS_METADATA, handlers[name]) as unknown[],
      ).toContain(RelayOperatorGuard);
    }
  });

  it("rejects missing or wrong operator secrets and accepts the configured secret", () => {
    const guard = new RelayOperatorGuard({
      get: jest.fn().mockReturnValue("configured-operator-secret"),
    } as any);
    const context = (supplied?: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({
            get: (name: string) =>
              name === "x-relay-operator-secret" ? supplied : undefined,
          }),
        }),
      }) as unknown as ExecutionContext;

    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context("wrong-secret"))).toThrow(
      UnauthorizedException,
    );
    expect(guard.canActivate(context("configured-operator-secret"))).toBe(true);
  });

  it("returns degraded readiness with HTTP 503 when a dependency is unavailable", async () => {
    const response = { status: jest.fn() };
    const controller = new HealthController(
      {
        ready: jest.fn().mockResolvedValue({
          ok: false,
          status: "degraded",
          service: "clawchat-backend",
          checkedAt: new Date().toISOString(),
          checks: {
            database: { ok: false, error: "database_unavailable" },
          },
        }),
        live: jest.fn(),
      } as any,
      {
        check: jest.fn().mockResolvedValue({
          ok: true,
          status: "healthy",
          checkedAt: "2026-07-16T00:00:00.000Z",
        }),
      } as any,
    );

    const result = await controller.ready(response as any);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe("degraded");
  });

  it("returns a sanitized synthetic status and propagates failure as 503", async () => {
    const controller = new HealthController(
      {} as any,
      {
        check: jest.fn().mockResolvedValue({
          ok: false,
          status: "attention",
          checkedAt: "2026-07-16T00:00:00.000Z",
        }),
      } as any,
    );
    const response = { status: jest.fn() };
    const result = await controller.synthetic(response as any);
    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect(result).toEqual({
      ok: false,
      status: "attention",
      checkedAt: "2026-07-16T00:00:00.000Z",
    });
  });
});
