import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import * as ts from "typescript";
import { AppModule } from "../../app.module";
import {
  AUTH_BOUNDARY_KEY,
  AuthBoundary,
  BridgeAuthenticated,
  IS_PUBLIC_KEY,
  JWT_AUTH_BYPASS_KEY,
} from "../../common/decorators/public.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

type RouteBoundary = {
  id: string;
  boundary: AuthBoundary | "jwt-global";
  classDecorators: string[];
  methodDecorators: string[];
  body: string;
};

const EXPECTED_PUBLIC_ROUTES = [
  "modules/auth/auth.controller.ts#AuthController.completeEmailChange",
  "modules/auth/auth.controller.ts#AuthController.completePasswordReset",
  "modules/auth/auth.controller.ts#AuthController.csrf",
  "modules/auth/auth.controller.ts#AuthController.login",
  "modules/auth/auth.controller.ts#AuthController.refresh",
  "modules/auth/auth.controller.ts#AuthController.register",
  "modules/auth/auth.controller.ts#AuthController.requestPasswordReset",
  "modules/auth/auth.controller.ts#AuthController.verifyEmail",
  "modules/auth/auth.controller.ts#AuthController.webLogin",
  "modules/auth/auth.controller.ts#AuthController.webRefresh",
  "modules/auth/auth.controller.ts#AuthController.webRegister",
  "modules/cloud-commercial/cloud-commercial.controller.ts#CloudDeploymentController.bootstrapOwner",
  "modules/cloud-commercial/cloud-commercial.controller.ts#CloudDeploymentController.compatibility",
  "modules/cloud-commercial/cloud-commercial.controller.ts#CloudDeploymentController.connectionPackage",
  "modules/cloud-commercial/cloud-commercial.controller.ts#CloudDeploymentController.manifest",
  "modules/cloud-commercial/cloud-commercial.controller.ts#CloudDeploymentController.release",
  "modules/cloud-commercial/stripe-billing.controller.ts#StripeBillingWebhookController.apple",
  "modules/cloud-commercial/stripe-billing.controller.ts#StripeBillingWebhookController.stripe",
  "modules/health/health.controller.ts#HealthController.check",
  "modules/health/health.controller.ts#HealthController.live",
  "modules/marketplace/bluesky/bluesky-marketplace.controller.ts#BlueskyMarketplaceOAuthController.callback",
  "modules/marketplace/bluesky/bluesky-marketplace.controller.ts#BlueskyMarketplaceOAuthController.clientMetadata",
  "modules/marketplace/connector-oauth-callback.controller.ts#MarketplaceConnectorOAuthCallbackController.callback",
  "modules/marketplace/connector-oauth-callback.controller.ts#MarketplaceConnectorOAuthCallbackController.implicitCallback",
  "modules/marketplace/marketplace.controller.ts#PublicMarketplaceController.app",
  "modules/marketplace/marketplace.controller.ts#PublicMarketplaceController.catalog",
  "modules/marketplace/x-marketplace.controller.ts#XMarketplaceOAuthCallbackController.callback",
  "modules/relay-sync/relay-sync.controller.ts#RelaySyncController.capabilities",
  "modules/relay-sync/relay-sync.controller.ts#RelaySyncController.uploadAttachment",
  "modules/waitlist/waitlist.controller.ts#WaitlistController.signup",
];

describe("global HTTP authentication boundary", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("registers JwtAuthGuard as the first application guard", () => {
    const providers =
      (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AppModule) as Array<{
        provide?: unknown;
        useClass?: unknown;
      }>) ?? [];
    const applicationGuards = providers.filter(
      (provider) => provider?.provide === APP_GUARD,
    );

    expect(applicationGuards.length).toBeGreaterThanOrEqual(1);
    expect(applicationGuards[0]?.useClass).toBe(JwtAuthGuard);
  });

  it("delegates an unannotated HTTP route to Passport JWT authentication", () => {
    const reflector = reflectorFor({});
    const guard = new JwtAuthGuard(reflector);
    const parent = Object.getPrototypeOf(
      JwtAuthGuard.prototype,
    ) as JwtAuthGuard;
    const passportGuard = jest
      .spyOn(parent, "canActivate")
      .mockReturnValue(false);

    expect(guard.canActivate(executionContext("http"))).toBe(false);
    expect(passportGuard).toHaveBeenCalledTimes(1);
  });

  it.each<AuthBoundary>(["public", "bridge", "operator"])(
    "bypasses JWT only for the explicit %s boundary",
    (boundary) => {
      const parent = Object.getPrototypeOf(
        JwtAuthGuard.prototype,
      ) as JwtAuthGuard;
      const passportGuard = jest
        .spyOn(parent, "canActivate")
        .mockReturnValue(false);
      const guard = new JwtAuthGuard(reflectorFor({ boundary }));

      expect(guard.canActivate(executionContext("http"))).toBe(true);
      expect(passportGuard).not.toHaveBeenCalled();
    },
  );

  it("does not apply the HTTP JWT strategy to WebSocket handlers", () => {
    const parent = Object.getPrototypeOf(
      JwtAuthGuard.prototype,
    ) as JwtAuthGuard;
    const passportGuard = jest
      .spyOn(parent, "canActivate")
      .mockReturnValue(false);
    const guard = new JwtAuthGuard(reflectorFor({}));

    expect(guard.canActivate(executionContext("ws"))).toBe(true);
    expect(passportGuard).not.toHaveBeenCalled();
  });

  it("does not mislabel bridge authentication as a public route", () => {
    class BridgeRoute {}
    BridgeAuthenticated()(BridgeRoute);

    expect(Reflect.getMetadata(AUTH_BOUNDARY_KEY, BridgeRoute)).toBe("bridge");
    expect(Reflect.getMetadata(JWT_AUTH_BYPASS_KEY, BridgeRoute)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, BridgeRoute)).toBeUndefined();
  });

  it("rejects an HTTP request when Passport returns no user", () => {
    const guard = new JwtAuthGuard(reflectorFor({}));
    expect(() => guard.handleRequest(null, null, { message: "No auth token" }))
      .toThrow(UnauthorizedException);
  });
});

describe("production controller authentication inventory", () => {
  const routes = controllerRoutes();

  it("keeps the intentional public-route allowlist exact", () => {
    expect(
      routes
        .filter((route) => route.boundary === "public")
        .map((route) => route.id)
        .sort(),
    ).toEqual(EXPECTED_PUBLIC_ROUTES);
  });

  it("requires every bridge-bypass route to authenticate a bridge credential", () => {
    const bridgeRoutes = routes.filter(
      (route) => route.boundary === "bridge",
    );
    expect(bridgeRoutes.length).toBeGreaterThan(0);
    for (const route of bridgeRoutes) {
      expect({
        route: route.id,
        authenticatesBridge:
          /authenticateBridgeAccessToken|redeemEnrollment|authenticateDevice|rotateDeviceCredential|executeLocalAppConnectorAgentApiTool|executeLocalAppRuntimeTool/.test(
            route.body,
          ),
      }).toEqual({ route: route.id, authenticatesBridge: true });
    }
    const localAppConnectorSource = readFileSync(
      join(
        process.cwd(),
        "src/modules/marketplace/localappconnector-agent-api-tools.controller.ts",
      ),
      "utf8",
    );
    expect(localAppConnectorSource).toMatch(
      /private async executeLocalAppConnectorAgentApiTool[\s\S]*?authenticateBridgeAccessToken/,
    );
    expect(localAppConnectorSource).toMatch(
      /private async executeLocalAppRuntimeTool[\s\S]*?authenticateBridgeAccessToken/,
    );
  });

  it("requires JWT overrides inside a bridge-authenticated mixed controller", () => {
    for (const route of routes.filter(
      (candidate) => candidate.boundary === "jwt",
    )) {
      expect(route.methodDecorators).toContain("UseGuards");
      expect(route.body).not.toContain("authenticateBridgeAccessToken");
    }
  });

  it("allows operator bypass only behind RelayOperatorGuard", () => {
    const operatorRoutes = routes.filter(
      (candidate) => candidate.boundary === "operator",
    );
    for (const route of operatorRoutes) {
      expect([
        ...route.classDecorators,
        ...route.methodDecorators,
      ]).toContain("UseGuards");
      expect(
        route.id.includes("#RelayOperatorController.") ||
          route.id.endsWith("#HealthController.ready") ||
          route.id.endsWith("#HealthController.synthetic"),
      ).toBe(true);
    }
    expect(operatorRoutes.map((route) => route.id)).toEqual(
      expect.arrayContaining([
        "modules/health/health.controller.ts#HealthController.ready",
        "modules/health/health.controller.ts#HealthController.synthetic",
      ]),
    );
  });

  it("classifies every production HTTP route under a known boundary", () => {
    expect(routes.length).toBeGreaterThan(400);
    expect(
      routes.every((route) =>
        ["jwt-global", "jwt", "public", "bridge", "operator"].includes(
          route.boundary,
        ),
      ),
    ).toBe(true);
  });
});

function reflectorFor(input: {
  boundary?: AuthBoundary;
  isPublic?: boolean;
}): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === AUTH_BOUNDARY_KEY) return input.boundary;
      if (key === JWT_AUTH_BYPASS_KEY) {
        return input.boundary !== undefined && input.boundary !== "jwt";
      }
      if (key === IS_PUBLIC_KEY) return input.isPublic;
      return undefined;
    }),
  } as unknown as Reflector;
}

function executionContext(type: "http" | "ws"): ExecutionContext {
  return {
    getType: () => type,
    getHandler: () => function testHandler() {},
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

function controllerRoutes(): RouteBoundary[] {
  const sourceRoot = join(process.cwd(), "src");
  const files = listFiles(sourceRoot).filter((file) =>
    file.endsWith(".controller.ts"),
  );
  const httpDecorators = new Set([
    "All",
    "Delete",
    "Get",
    "Head",
    "Options",
    "Patch",
    "Post",
    "Put",
  ]);
  const boundaries = new Map<string, AuthBoundary>([
    ["JwtAuthenticated", "jwt"],
    ["Public", "public"],
    ["BridgeAuthenticated", "bridge"],
    ["OperatorAuthenticated", "operator"],
  ]);
  const routes: RouteBoundary[] = [];

  for (const file of files.sort()) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (!ts.isClassDeclaration(statement) || !statement.name) continue;
      const classDecorators = decoratorNames(statement);
      if (!classDecorators.includes("Controller")) continue;
      for (const member of statement.members) {
        if (!ts.isMethodDeclaration(member) || !member.name) continue;
        const methodDecorators = decoratorNames(member);
        if (!methodDecorators.some((name) => httpDecorators.has(name))) {
          continue;
        }
        const explicit =
          methodDecorators.find((name) => boundaries.has(name)) ??
          classDecorators.find((name) => boundaries.has(name));
        routes.push({
          id: `${file.slice(sourceRoot.length + 1)}#${statement.name.text}.${member.name.getText(source)}`,
          boundary: explicit
            ? boundaries.get(explicit)!
            : "jwt-global",
          classDecorators,
          methodDecorators,
          body: member.body?.getText(source) ?? "",
        });
      }
    }
  }
  return routes;
}

function decoratorNames(node: ts.Node): string[] {
  const decorators = ts.canHaveDecorators(node)
    ? (ts.getDecorators(node) ?? [])
    : [];
  return decorators.map((decorator) => {
    const expression = ts.isCallExpression(decorator.expression)
      ? decorator.expression.expression
      : decorator.expression;
    return ts.isIdentifier(expression)
      ? expression.text
      : expression.getText();
  });
}

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}
