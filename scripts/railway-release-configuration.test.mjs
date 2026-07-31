import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSafeRailwayConfigurationEvidence,
  validateRailwayConfigurationSchema,
  validateRailwayReleaseConfiguration,
} from "./railway-release-configuration.mjs";

function topology() {
  return {
    schemaVersion: "relay.railway-release-topology.v1",
    capturedAt: "2026-07-15T04:00:00.000Z",
    project: { id: "project-1", name: "relay-console", workspaceName: "Relay" },
    production: {
      id: "environment-production",
      name: "production",
      services: ["Postgres", "Redis", "clawchat"],
      backend: {
        serviceId: "service-production",
        serviceName: "clawchat",
        sourceRepository: "insitektalay/relay-console",
        sourceBranch: "release/relay-console-0.1.0-rc1",
        checkSuites: true,
        rootDirectory: "/backend",
        deployment: {
          id: "deployment-production",
          status: "SUCCESS",
          createdAt: "2026-07-15T03:55:00.000Z",
          sourceCommit: "a".repeat(40),
          sourceBranch: "release/relay-console-0.1.0-rc1",
          sourceRepository: "insitektalay/relay-console",
        },
      },
    },
    staging: {
      id: "environment-staging",
      name: "staging",
      services: ["Postgres", "Redis", "clawchat"],
      backend: {
        serviceId: "service-staging",
        serviceName: "clawchat",
        sourceRepository: "insitektalay/relay-console",
        sourceBranch: "codex/shared-marketplace-loop",
        checkSuites: true,
        rootDirectory: "/backend",
        deployment: {
          id: "deployment-staging",
          status: "SUCCESS",
          createdAt: "2026-07-15T03:54:00.000Z",
          sourceCommit: "b".repeat(40),
          sourceBranch: "codex/shared-marketplace-loop",
          sourceRepository: "insitektalay/relay-console",
        },
      },
    },
  };
}

function variables() {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://secret",
    REDIS_URL: "redis://secret",
    RELAY_PUBLIC_BACKEND_ORIGIN: "https://api.relayconsole.work",
    CLAWCHAT_RAILWAY_ORIGIN: "https://api.relayconsole.work",
    RELAY_PUBLIC_WEBSOCKET_ORIGIN: "wss://api.relayconsole.work",
    RELAY_PUBLIC_WEB_ORIGIN: "https://relayconsole.work",
    CORS_ORIGINS: "https://relayconsole.work",
    CLAWCHAT_BETA_SIGNUP_MODE: "invite",
    CLAWCHAT_MARKETPLACE_BETA_MODE: "true",
    CLAWCHAT_MARKETPLACE_ALLOWED_APPS: "gmail,slack",
    CLAWCHAT_MARKETPLACE_BLOCKED_APPS: "x",
    RELAY_BILLING_ENABLED: "true",
    STRIPE_SECRET_KEY: "sk_live_secret-value",
    STRIPE_WEBHOOK_SECRET: "whsec_secret-value",
    STRIPE_RELAY_CLOUD_PRICE_ID: "price_123",
    RELAY_TRANSACTIONAL_EMAIL_ENABLED: "true",
    RESEND_API_KEY: "re_secret-value",
    RELAY_EMAIL_FROM: "support@relayconsole.work",
    RELAY_APPLE_BILLING_ENABLED: "true",
    APPLE_BUNDLE_ID: "com.relayconsole.app",
    APPLE_APP_ID: "123456789",
    APPLE_RELAY_CLOUD_PRODUCT_ID: "relay_cloud_monthly",
    APPLE_ROOT_CA_BASE64_JSON: '["certificate"]',
    RELAY_OPERATOR_API_SECRET: "operator-secret-value",
    JWT_SECRET: "jwt-secret-value",
  };
}

test("builds ready evidence without variable names or secret values", () => {
  const evidence = buildSafeRailwayConfigurationEvidence({
    variables: variables(),
    topology: topology(),
    productionSafetyValidatorPassed: true,
    capturedAt: "2026-07-15T04:01:00.000Z",
  });

  assert.equal(evidence.status, "ready");
  assert.deepEqual(validateRailwayConfigurationSchema(evidence), []);
  assert.deepEqual(
    validateRailwayReleaseConfiguration(evidence, {
      topology: topology(),
      releaseCommit: "a".repeat(40),
    }),
    { valid: true, errors: [] },
  );
  const serialized = JSON.stringify(evidence);
  assert.doesNotMatch(serialized, /secret-value|DATABASE_URL|STRIPE_SECRET_KEY|RESEND_API_KEY/);
});

test("reports missing commercial and hardened production configuration", () => {
  const input = variables();
  delete input.STRIPE_SECRET_KEY;
  delete input.RESEND_API_KEY;
  delete input.APPLE_ROOT_CA_BASE64_JSON;
  const evidence = buildSafeRailwayConfigurationEvidence({
    variables: input,
    topology: topology(),
    productionSafetyValidatorPassed: false,
  });

  assert.equal(evidence.status, "incomplete");
  assert.equal(evidence.configuration.productionSafetyValidatorPassed, false);
  assert.equal(evidence.configuration.billing.configured, false);
  assert.equal(evidence.configuration.transactionalEmail.configured, false);
  assert.equal(evidence.configuration.appleBilling.configured, false);
  assert.match(
    validateRailwayReleaseConfiguration(evidence).errors.join("\n"),
    /configuration is incomplete/,
  );
});

test("rejects a hand-edited ready status when a capability is false", () => {
  const evidence = buildSafeRailwayConfigurationEvidence({
    variables: variables(),
    topology: topology(),
    productionSafetyValidatorPassed: true,
  });
  evidence.status = "ready";
  evidence.configuration.billing.enabled = false;
  evidence.configuration.canonicalOrigins.websocket = false;

  const result = validateRailwayReleaseConfiguration(evidence, {
    topology: topology(),
    releaseCommit: "a".repeat(40),
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /Stripe billing is disabled/);
  assert.match(result.errors.join("\n"), /websocket origin is not canonical/);
});

test("rejects topology, deployment, commit, and hash substitution", () => {
  const evidence = buildSafeRailwayConfigurationEvidence({
    variables: variables(),
    topology: topology(),
    productionSafetyValidatorPassed: true,
  });
  evidence.identity.projectId = "another-project";
  evidence.identity.deploymentId = "another-deployment";
  evidence.identity.sourceCommit = "c".repeat(40);
  evidence.identity.railwayTopologySHA256 = "d".repeat(64);

  const result = validateRailwayReleaseConfiguration(evidence, {
    topology: topology(),
    releaseCommit: "a".repeat(40),
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /project differs/);
  assert.match(result.errors.join("\n"), /deployment differs/);
  assert.match(result.errors.join("\n"), /commit differs/);
  assert.match(result.errors.join("\n"), /topology hash differs/);
  assert.match(result.errors.join("\n"), /does not belong to the release commit/);
});

test("rejects unsupported fields and a topology race", () => {
  const evidence = buildSafeRailwayConfigurationEvidence({
    variables: variables(),
    topology: topology(),
    productionSafetyValidatorPassed: true,
    liveTopologyMatched: false,
  });
  evidence.configuration.billing.secret = "must-not-pass";

  assert.match(
    validateRailwayConfigurationSchema(evidence).join("\n"),
    /unsupported field secret/,
  );
  assert.match(
    validateRailwayReleaseConfiguration(evidence).errors.join("\n"),
    /stable live deployment/,
  );
});
