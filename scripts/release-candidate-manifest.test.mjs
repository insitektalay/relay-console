import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  bridgeAcceptanceEvidence,
  bridgeReleaseEvidence,
  frozenRepositorySnapshot,
  hashJson,
  validateFrozenRepositoryComponents,
  validateReleaseCandidate,
  validateReleaseCheckout,
  validateReleaseCandidateSchema,
} from "./release-candidate-manifest.mjs";
import { failureRecoverySourceEvidence } from "./failure-recovery-evidence.mjs";
import { billingSourceEvidence } from "./billing-release-evidence.mjs";
import { appStoreRepositoryEvidence } from "./app-store-release-evidence.mjs";
import { marketplaceFreezeHash } from "./marketplace-freeze-source-audit.mjs";

const repositoryRoot = resolve(fileURLToPath(import.meta.url), "../..");

function railwayTopology() {
  return {
    schemaVersion: "relay.railway-release-topology.v1",
    capturedAt: "2026-07-14T22:00:00.000Z",
    project: { id: "project-1", name: "relay-console", workspaceName: "Relay" },
    production: {
      id: "production-1", name: "production", services: ["Postgres", "Redis", "clawchat"],
      backend: { serviceId: "backend-1", serviceName: "clawchat", sourceRepository: "insitektalay/relay-console", sourceBranch: "release/relay-console-1.0.0-rc1", checkSuites: true, rootDirectory: "/backend", deployment: { id: "railway-1", status: "SUCCESS", createdAt: "2026-07-14T22:00:00.000Z", sourceCommit: "a".repeat(40), sourceBranch: "release/relay-console-1.0.0-rc1", sourceRepository: "insitektalay/relay-console" } },
    },
    staging: {
      id: "staging-1", name: "staging", services: ["Postgres", "Redis", "clawchat"],
      backend: { serviceId: "backend-2", serviceName: "clawchat", sourceRepository: "insitektalay/relay-console", sourceBranch: "codex/shared-marketplace-loop", checkSuites: true, rootDirectory: "/backend", deployment: { id: "railway-staging-1", status: "SUCCESS", createdAt: "2026-07-14T21:59:00.000Z", sourceCommit: "9".repeat(40), sourceBranch: "codex/shared-marketplace-loop", sourceRepository: "insitektalay/relay-console" } },
    },
  };
}

const topologySHA256 = hashJson(railwayTopology());

function railwayConfiguration() {
  return {
    schemaVersion: "relay.railway-release-configuration.v1",
    capturedAt: "2026-07-14T22:03:00.000Z",
    status: "ready",
    identity: {
      projectId: "project-1",
      environmentId: "production-1",
      environmentName: "production",
      serviceId: "backend-1",
      serviceName: "clawchat",
      deploymentId: "railway-1",
      sourceCommit: "a".repeat(40),
      railwayTopologySHA256: topologySHA256,
      liveTopologyMatched: true,
    },
    configuration: {
      productionSafetyValidatorPassed: true,
      nodeEnvironment: "production",
      databaseConfigured: true,
      redisConfigured: true,
      canonicalOrigins: {
        backend: true,
        websocket: true,
        web: true,
        corsIncludesWeb: true,
      },
      signup: { mode: "invite", configured: true },
      marketplace: { betaGateEnabled: true, cohortConfigured: true },
      billing: {
        provider: "stripe",
        enabled: true,
        configured: true,
        liveMode: true,
      },
      transactionalEmail: {
        provider: "resend",
        enabled: true,
        configured: true,
      },
      appleBilling: {
        enabled: true,
        configured: true,
        bundleIdentifierMatches: true,
      },
      destructiveSeedingDisabled: true,
    },
    privacy: { variableNamesIncluded: false, secretValuesIncluded: false },
  };
}

const railwayConfigurationSHA256 = hashJson(railwayConfiguration());

function remoteEvidence() {
  const ciRun = (runId, workflowName) => ({
    runId,
    workflowName,
    url: `https://github.com/insitektalay/relay-console/actions/runs/${runId}`,
    status: "completed",
    conclusion: "success",
    headSha: "a".repeat(40),
    headBranch: "release/relay-console-1.0.0-rc1",
    event: "push",
    createdAt: "2026-07-14T22:01:00.000Z",
    updatedAt: "2026-07-14T22:07:00.000Z",
  });
  return {
    schemaVersion: "relay.release-remote-evidence.v1",
    capturedAt: "2026-07-14T22:09:00.000Z",
    repository: "insitektalay/relay-console",
    sourceCommit: "a".repeat(40),
    sourceBranch: "release/relay-console-1.0.0-rc1",
    ciRuns: {
      backend: ciRun(101, "Backend Beta Readiness"),
      web: ciRun(102, "Web Beta Readiness"),
      apple: ciRun(103, "Apple Beta Readiness"),
    },
    vercel: {
      githubDeploymentId: 1234,
      sourceCommit: "a".repeat(40),
      sourceRef: "release/relay-console-1.0.0-rc1",
      environment: "Production",
      deploymentCreator: "vercel[bot]",
      state: "success",
      statusCreator: "vercel[bot]",
      deploymentURL: "https://relay-console-release.vercel.app",
      createdAt: "2026-07-14T22:02:00.000Z",
      statusUpdatedAt: "2026-07-14T22:08:00.000Z",
    },
  };
}

const remoteEvidenceSHA256 = hashJson(remoteEvidence());

function publicSurfaces() {
  const routes = [
    "/",
    "/privacy", "/terms", "/acceptable-use", "/support", "/security",
    "/subprocessors", "/data-deletion", "/third-party-notices", "/status",
    "/known-issues", "/release-notes", "/download", "/updates",
  ];
  return {
    schemaVersion: "relay.public-launch-surfaces.v5",
    capturedAt: "2026-07-14T22:09:30.000Z",
    baseURL: "https://relayconsole.work",
    releaseBinding: {
      repository: "insitektalay/relay-console",
      sourceCommit: "a".repeat(40),
      sourceBranch: "release/relay-console-1.0.0-rc1",
      githubDeploymentId: 1234,
      deploymentURL: "https://relay-console-release.vercel.app",
    },
    releaseIdentity: {
      path: "/release-identity.json",
      finalURL: "https://relayconsole.work/release-identity.json",
      status: 200,
      contentType: "application/json; charset=utf-8",
      bodySha256: "1".repeat(64),
      document: {
        schemaVersion: "relay.web-release-identity.v1",
        repository: "insitektalay/relay-console",
        sourceCommit: "a".repeat(40),
        sourceBranch: "release/relay-console-1.0.0-rc1",
        environment: "production",
        deploymentId: "dpl_Release123",
        deploymentURL: "https://relay-console-release.vercel.app",
      },
      error: null,
    },
    routes: routes.map((path) => ({
      path,
      finalURL: `https://relayconsole.work${path}`,
      status: 200,
      contentType: "text/html; charset=utf-8",
      bodySha256: "2".repeat(64),
      placeholderHits: [],
      supportHoursPublished: path === "/support",
      responseTargetPublished: path === "/support",
      error: null,
    })),
    advertisedAddresses: ["hello@relayconsole.work"],
    mailDomains: [{
      domain: "relayconsole.work",
      exchanges: ["mail.relayconsole.work"],
      error: null,
    }],
  };
}

const publicSurfacesSHA256 = hashJson(publicSurfaces());

function productionSmoke() {
  const health = (serviceStatus) => ({
    passed: true,
    statusCode: 200,
    latencyMs: 10,
    serviceOk: true,
    serviceStatus,
    service: "clawchat-backend",
  });
  return {
    schemaVersion: "relay.production-smoke-evidence.v1",
    capturedAt: "2026-07-14T22:09:45.000Z",
    status: "ready",
    checkSetComplete: true,
    releaseBinding: {
      repository: "insitektalay/relay-console",
      sourceCommit: "a".repeat(40),
      sourceBranch: "release/relay-console-1.0.0-rc1",
      railwayProjectId: "project-1",
      railwayEnvironmentId: "production-1",
      railwayServiceId: "backend-1",
      railwayDeploymentId: "railway-1",
      vercelGithubDeploymentId: 1234,
      vercelDeploymentId: "dpl_Release123",
      vercelDeploymentURL: "https://relay-console-release.vercel.app",
      railwayTopologySHA256: hashJson(railwayTopology()),
      railwayConfigurationSHA256: hashJson(railwayConfiguration()),
      remoteEvidenceSHA256: hashJson(remoteEvidence()),
      publicSurfacesSHA256: hashJson(publicSurfaces()),
    },
    origins: {
      backend: "https://api.relayconsole.work",
      web: "https://relayconsole.work",
      websocket: "wss://api.relayconsole.work",
    },
    checks: {
      backendLive: health("ok"),
      backendReady: health("ready"),
      productionSynthetic: health("healthy"),
      webRoot: { passed: true, statusCode: 200, latencyMs: 10 },
      webRewriteLive: health("ok"),
      webRewriteReady: health("ready"),
      authenticatedWebsocket: {
        passed: true,
        latencyMs: 25,
        loginPassed: true,
        workspaceLookupPassed: true,
        workspaceSource: "discovered",
        ticketPassed: true,
        socketAuthenticated: true,
      },
      billingObservability: {
        passed: true,
        statusCode: 200,
        latencyMs: 8,
        snapshotStatus: "healthy",
        alerts: [],
        activePaidSubscriptions: 3,
        failedBillingEvents: 0,
        staleBillingEvents: 0,
        entitlementMismatches: 0,
        privacySafe: true,
      },
      operationsObservability: {
        passed: true,
        statusCode: 200,
        latencyMs: 9,
        snapshotStatus: "healthy",
        alerts: [],
        activeBridgeDevices: 2,
        recentBridgeDevices: 2,
        failedBridgeEvents: 0,
        staleBridgeEvents: 0,
        staleRuntimeDispatches: 0,
        oauthRefreshFailures: 0,
        privacySafe: true,
      },
    },
    privacy: {
      credentialsIncluded: false,
      cookiesIncluded: false,
      websocketTicketsIncluded: false,
      operatorSecretIncluded: false,
      workspaceIdentifiersIncluded: false,
      customerIdentifiersIncluded: false,
      responseBodiesIncluded: false,
    },
  };
}

const productionSmokeSHA256 = hashJson(productionSmoke());

function failureRecovery() {
  const source = failureRecoverySourceEvidence(repositoryRoot);
  const environments = {
    railway_unavailable: "staging",
    redis_or_queue_unavailable: "staging",
    database_migration_failure: "staging",
    expired_or_revoked_human_session: "production",
    expired_or_revoked_bridge_credential: "production",
    runtime_incompatible_or_offline: "production",
    oauth_failure_and_recovery: "production",
    duplicate_or_delayed_billing_event: "sandbox",
    client_below_minimum_contract: "production",
    backend_rollback_and_database_restore: "production",
  };
  const drills = Object.fromEntries(Object.entries(environments).map(([id, environment]) => [id, {
    status: "passed",
    environment,
    deploymentId: environment === "staging" ? "railway-staging-1" : "railway-1",
    verifiedAt: "2026-07-14T22:05:00.000Z",
    reviewer: "Independent recovery reviewer",
    evidenceURL: `https://evidence.relayconsole.work/releases/rc1/${id}`,
    recoveryConfirmed: true,
    customerImpact: environment === "staging" || id === "backend_rollback_and_database_restore"
      ? "none"
      : "synthetic-only",
    secretValuesIncluded: false,
    customerContentIncluded: false,
  }]));
  return {
    schemaVersion: "relay.failure-recovery-evidence.v1",
    releaseId: "relay-console-0.1.0-rc1",
    capturedAt: "2026-07-14T22:09:50.000Z",
    drillsCompletedAt: "2026-07-14T22:09:40.000Z",
    candidate: {
      sourceCommit: "a".repeat(40),
      manifestSHA256: authorizedCandidateSHA256,
    },
    releaseBinding: {
      sourceBranch: "release/relay-console-1.0.0-rc1",
      productionDeploymentId: "railway-1",
      stagingDeploymentId: "railway-staging-1",
      railwayTopologySHA256: hashJson(railwayTopology()),
      railwayConfigurationSHA256: hashJson(railwayConfiguration()),
      remoteEvidenceSHA256: hashJson(remoteEvidence()),
    },
    repository: {
      executedAt: "2026-07-14T22:09:30.000Z",
      status: "passed",
      journeyCount: source.journeyCount,
      testFileCount: source.testFileCount,
      testSuiteCount: source.testFileCount,
      passedTestSuiteCount: source.testFileCount,
      testCount: 390,
      passedTestCount: 390,
      sourceEvidenceSHA256: source.sourceEvidenceSHA256,
      backendCIRunId: 101,
      backendCIRunURL: "https://github.com/insitektalay/relay-console/actions/runs/101",
    },
    drills,
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      rawCommandOutputIncluded: false,
    },
  };
}

function launchJourneyEvidence() {
  const journey = (section, id, index) => ({
    status: "passed",
    verifiedAt: "2026-07-14T22:05:00.000Z",
    reviewer: "Independent journey reviewer",
    evidenceURL: `https://evidence.relayconsole.work/releases/rc1/${section}/${index}-${id}`,
    customerImpact: "test-account",
    credentialMaterialIncluded: false,
    customerContentIncluded: false,
    testAccountIdentifiersIncluded: false,
  });
  const relayIds = [
    "notarizedInstall", "accountVerification", "purchaseAndEntitlement",
    "entitlementRequiredOnMac", "userInstalledRuntimes", "sameMacHermes",
    "sameMacOpenClaw", "remoteBridgeEnrollment", "crossClientConvergence",
    "dispatchFromEveryClient",
    "runtimeOfflineState", "runtimeReconnectBackfill",
    "messageAndPersistence", "liveMarketplaceLifecycle",
    "cancellationExportDeletion",
  ];
  const migrationIds = [
    "customerHostToCustomerHost", "interruptionAndRollback",
  ];
  return {
    schemaVersion: "relay.launch-journey-evidence.v1",
    releaseId: "relay-console-0.1.0-rc1",
    capturedAt: "2026-07-14T22:09:55.000Z",
    candidate: {
      sourceCommit: "a".repeat(40),
      manifestSHA256: authorizedCandidateSHA256,
    },
    releaseBinding: {
      sourceBranch: "release/relay-console-1.0.0-rc1",
      railwayDeploymentId: "railway-1",
      vercelDeploymentId: "1234",
      railwayTopologySHA256: hashJson(railwayTopology()),
      railwayConfigurationSHA256: hashJson(railwayConfiguration()),
      remoteEvidenceSHA256: hashJson(remoteEvidence()),
    },
    artifacts: {
      macOSDistributionSHA256: hashJson(macOSDistribution()),
      iOSDistributionSHA256: hashJson(iOSDistribution()),
    },
    results: {
      schemaVersion: "relay.launch-journey-results.v3",
      completedAt: "2026-07-14T22:09:40.000Z",
      clientMatrix: {
        macOS: {
          appVersion: "0.1.0",
          appBuild: "1",
          deviceModel: "MacBook Air M3",
          architecture: "arm64",
          osVersion: "15.5",
          cleanHost: true,
        },
        web: {
          sourceCommit: "a".repeat(40),
          deploymentId: "1234",
          browser: "Safari 19",
        },
        iPhone: {
          appVersion: "1.0",
          appBuild: "1",
          deviceModel: "iPhone 16",
          osVersion: "19.0",
        },
        iPad: {
          appVersion: "1.0",
          appBuild: "1",
          deviceModel: "iPad Air M3",
          osVersion: "19.0",
        },
      },
      runtimeMatrix: {
        hermes: {
          version: "0.9.0",
          commit: "8".repeat(40),
          hostOS: "macOS 15.5",
          hostArchitecture: "arm64",
          userInstalled: true,
          relayInstalled: false,
        },
        openClaw: {
          version: "1.2.0",
          commit: "9".repeat(40),
          hostOS: "Ubuntu 24.04",
          hostArchitecture: "x86_64",
          userInstalled: true,
          relayInstalled: false,
        },
      },
      marketplace: {
        providerSlug: "example",
        connectionType: "oauth",
        liveActionName: "Create and remove a test label",
        dedicatedTestAccount: true,
      },
      billing: {
        stripeMode: "live",
        appleEnvironment: "sandbox",
        plan: "relay_connect_monthly",
        monthlyPriceUSD: "9.99",
        managedRuntimeAvailable: false,
      },
      relay: Object.fromEntries(
        relayIds.map((id, index) => [id, journey("relay", id, index)]),
      ),
      migration: Object.fromEntries(
        migrationIds.map((id, index) => [id, journey("migration", id, index)]),
      ),
    },
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      testAccountIdentifiersIncluded: false,
      rawCommandOutputIncluded: false,
    },
  };
}

function productionChecklistEvidence() {
  return {
    schemaVersion: "relay.production-launch-checklist-evidence.v3",
    releaseId: "relay-console-0.1.0-rc1",
    capturedAt: "2026-07-14T22:09:58.000Z",
    candidate: {
      sourceBranch: "release/relay-console-1.0.0-rc1",
      sourceCommit: "a".repeat(40),
      manifestSHA256: authorizedCandidateSHA256,
    },
    checklist: {
      path: "docs/production-launch-current/PRODUCTION_LAUNCH_CHECKLIST.md",
      status: "complete",
      fileSHA256: "1".repeat(64),
      itemSetSHA256: "2".repeat(64),
      sectionSetSHA256: "3".repeat(64),
      sectionCount: 18,
      totalItemCount: 256,
      completedItemCount: 256,
      openItemCount: 0,
    },
    review: {
      reviewedAt: "2026-07-14T22:09:30.000Z",
      reviewer: "Independent checklist reviewer",
      evidenceURL: "https://evidence.relayconsole.work/releases/rc1/checklist-review",
    },
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      rawCommandOutputIncluded: false,
    },
  };
}

function finalAcceptance(overrides = {}) {
  let evidenceIndex = 0;
  const gate = (reviewer = "Independent reviewer") => ({
    passed: true,
    verifiedAt: "2026-07-14T22:05:00.000Z",
    reviewer,
    evidenceURL: `https://evidence.relayconsole.work/releases/rc1/final/${++evidenceIndex}`,
  });
  const railwayOperations = {
    passed: true,
    verifiedAt: "2026-07-14T22:05:00.000Z",
    reviewer: "Production operations reviewer",
    reviewerRole: "Production operations owner",
    controls: {
      stagingProductionSeparated: true,
      deploymentsUseBackendRoot: true,
      migrationsRunOnStartup: true,
      strongSecretsReviewed: true,
      automatedBackupsEnabled: true,
      monitoringActive: true,
      allRequiredSignalsMonitored: true,
      alertRecipientConfigured: true,
      testAlertReceived: true,
      spendAlertsConfigured: true,
      capacityLimitsConfigured: true,
      statusPageOperational: true,
      incidentOwnerAssigned: true,
      backupRestoreDrillPassed: true,
      backendRollbackDrillPassed: true,
      marketplaceKillSwitchDrillPassed: true,
    },
    releaseEvidence: {
      railwayTopologySHA256: topologySHA256,
      railwayConfigurationSHA256,
      publicSurfacesSHA256,
      productionSmokeSHA256,
      failureRecoverySHA256: hashJson(failureRecovery()),
    },
    evidenceURLs: Object.fromEntries([
      "environmentSeparation", "secretReview", "backups",
      "monitoringAndAlert", "costControls", "statusAndIncident",
      "productionDrills",
    ].map((name, index) => [
      name,
      `https://evidence.relayconsole.work/releases/rc1/operations/${index + 1}-${name}`,
    ])),
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      rawCommandOutputIncluded: false,
    },
  };
  return {
    schemaVersion: "relay.final-release-acceptance.v1",
    releaseId: "relay-console-0.1.0-rc1",
    sourceCommit: "a".repeat(40),
    railwayDeploymentId: "railway-1",
    vercelDeploymentId: "1234",
    completedAt: "2026-07-14T22:06:00.000Z",
    gates: {
      bridgeHosts: gate(),
      billing: gate(),
      marketplace: gate(),
      railwayOperations,
      macOSDistribution: gate(),
      iOSDistribution: gate(),
      accountLifecycle: gate(),
      publicSurfaces: gate(),
      humanGoNoGo: { ...gate("Release owner"), residualRiskAccepted: true },
    },
    ...overrides,
  };
}

const authorizedCandidateSHA256 = "7".repeat(64);

function macOSDistribution() {
  return {
    schemaVersion: "relay.macos-distribution-evidence.v1",
    releaseId: "relay-console-0.1.0-rc1",
    capturedAt: "2026-07-14T22:08:00.000Z",
    candidate: { sourceCommit: "a".repeat(40), manifestSHA256: authorizedCandidateSHA256 },
    artifact: {
      fileName: "RelayConsole-public-beta.dmg",
      dmgSHA256: "f".repeat(64),
      dmgSizeBytes: 1024,
      appVersion: "0.1.0",
      appBuild: "1",
      bundleIdentifier: "com.relayconsole.app",
      minimumOS: "14.0",
      architectures: ["arm64"],
      mainExecutableSHA256: "1".repeat(64),
      bridgeExecutableSHA256: "2".repeat(64),
    },
    signing: {
      mode: "developer-id-hardened-runtime",
      authority: "Developer ID Application: Relay Console Ltd (A1B2C3D4E5)",
      teamIdentifier: "A1B2C3D4E5",
      appCDHash: "3".repeat(40),
      timestamped: true,
      hardenedRuntime: true,
      nestedExecutablesVerified: true,
      appVerified: true,
      dmgVerified: true,
    },
    notarization: {
      appSubmissionId: "123e4567-e89b-42d3-a456-426614174000",
      appStatus: "Accepted",
      appSubmissionSHA256: "4".repeat(64),
      dmgSubmissionId: "123e4567-e89b-42d3-a456-426614174001",
      dmgStatus: "Accepted",
      dmgSubmissionSHA256: "5".repeat(64),
      appStapleValidated: true,
      dmgStapleValidated: true,
    },
    gatekeeper: {
      appAccepted: true,
      dmgAccepted: true,
      quarantinedMountSignatureVerified: true,
      quarantinedMountGatekeeperAccepted: true,
    },
  };
}

function iOSDistribution() {
  return {
    schemaVersion: "relay.ios-distribution-evidence.v1",
    releaseId: "relay-console-0.1.0-rc1",
    capturedAt: "2026-07-14T22:08:30.000Z",
    candidate: { sourceCommit: "a".repeat(40), manifestSHA256: authorizedCandidateSHA256 },
    archive: {
      name: "RelayConsole.xcarchive",
      appBundleSHA256: "6".repeat(64),
      appVersion: "1.0",
      appBuild: "1",
      bundleIdentifier: "com.relayconsole.app",
      minimumOS: "18.0",
      architectures: ["arm64"],
    },
    signing: {
      authority: "Apple Distribution: Relay Console Ltd (A1B2C3D4E5)",
      teamIdentifier: "A1B2C3D4E5",
      appCDHash: "8".repeat(40),
      strictVerificationPassed: true,
      distributionSignature: true,
    },
    provisioning: {
      profileUUID: "123e4567-e89b-42d3-a456-426614174002",
      profileName: "Relay Console App Store",
      teamIdentifier: "A1B2C3D4E5",
      applicationIdentifier: "A1B2C3D4E5.com.relayconsole.app",
      expirationDate: "2027-07-14T22:08:30.000Z",
      getTaskAllow: false,
      hasProvisionedDevices: false,
      provisionsAllDevices: false,
    },
    appStoreConnect: {
      apiOrigin: "https://api.appstoreconnect.apple.com",
      appId: "app-1",
      buildId: "build-1",
      processingState: "VALID",
      buildAudienceType: "APP_STORE_ELIGIBLE",
      uploadedDate: "2026-07-14T22:07:30.000Z",
      expired: false,
      minimumOS: "18.0",
      marketingVersion: "1.0",
      buildNumber: "1",
    },
  };
}

function billingReleaseEvidence() {
  const journey = (section, id, index) => ({
    status: "passed",
    verifiedAt: "2026-07-14T22:05:00.000Z",
    reviewer: "Independent billing reviewer",
    evidenceURL: "https://evidence.relayconsole.work/releases/rc1/billing/" + section + "/" + index + "-" + id,
    customerImpact: section === "apple" || section === "cross-provider"
      ? "sandbox"
      : section === "monitoring" ? "synthetic-only" : "test-account",
    credentialMaterialIncluded: false,
    customerContentIncluded: false,
    testAccountIdentifiersIncluded: false,
    paymentIdentifiersIncluded: false,
  });
  const group = (section, ids) => Object.fromEntries(
    ids.map((id, index) => [id, journey(section, id, index)]),
  );
  const source = billingSourceEvidence(repositoryRoot);
  return {
    schemaVersion: "relay.billing-release-evidence.v1",
    releaseId: "relay-console-0.1.0-rc1",
    capturedAt: "2026-07-14T22:09:56.000Z",
    candidate: {
      sourceCommit: "a".repeat(40),
      manifestSHA256: authorizedCandidateSHA256,
    },
    releaseBinding: {
      sourceBranch: "release/relay-console-1.0.0-rc1",
      railwayDeploymentId: "railway-1",
      vercelDeploymentId: "1234",
      railwayTopologySHA256: hashJson(railwayTopology()),
      railwayConfigurationSHA256: hashJson(railwayConfiguration()),
      remoteEvidenceSHA256: hashJson(remoteEvidence()),
    },
    artifacts: {
      iOSDistributionSHA256: hashJson(iOSDistribution()),
    },
    repository: {
      executedAt: "2026-07-14T22:09:30.000Z",
      status: "passed",
      testFileCount: source.testFileCount,
      testSuiteCount: 6,
      passedTestSuiteCount: 6,
      testCount: 80,
      passedTestCount: 80,
      sourceEvidenceSHA256: source.sourceEvidenceSHA256,
      backendCIRunId: 101,
      backendCIRunURL: "https://github.com/insitektalay/relay-console/actions/runs/101",
    },
    results: {
      schemaVersion: "relay.billing-release-results.v3",
      completedAt: "2026-07-14T22:09:40.000Z",
      pricing: {
        relay: {
          plan: "relay_connect_monthly",
          monthlyPriceUSD: "9.99",
          billingPeriod: "month",
          stripeLiveProductConfigured: true,
          stripePriceConfigured: true,
          stripeAutomaticTaxConfigured: true,
          appleProductConfigured: true,
          appleIAPOffered: true,
          webPriceTaxDisclosure: "varies-by-region",
        },
        verifiedAt: "2026-07-14T22:05:00.000Z",
        reviewer: "Commercial release reviewer",
        evidenceURL: "https://evidence.relayconsole.work/releases/rc1/billing/pricing",
      },
      taxAndMerchant: {
        launchCountriesReviewed: true,
        launchCountries: ["GB"],
        taxVATReviewed: true,
        merchantObligationsReviewed: true,
        reviewedAt: "2026-07-14T22:05:00.000Z",
        reviewer: "Qualified tax reviewer",
        evidenceURL: "https://evidence.relayconsole.work/releases/rc1/billing/tax",
      },
      relayStripe: group("relay-stripe", [
        "checkoutAndEntitlement", "renewal", "failedPaymentAndGrace",
        "cancellation", "refund", "dispute", "recovery",
      ]),
      relayApple: group("apple", [
        "purchaseAndEntitlement", "renewal", "billingRetryAndGrace",
        "cancellationOrRevocation", "refund", "accountMismatch", "restore",
      ]),
      crossProvider: group("cross-provider", [
        "duplicateSubscriptionPrevention", "entitlementConvergence",
      ]),
      monitoring: group("monitoring", [
        "revenue", "churn", "failedPayment", "entitlementMismatch",
        "managedRuntimeDisabled", "alertAcknowledgement",
      ]),
      privacy: {
        credentialsIncluded: false,
        secretValuesIncluded: false,
        customerIdentifiersIncluded: false,
        paymentIdentifiersIncluded: false,
        providerObjectIdentifiersIncluded: false,
        customerContentIncluded: false,
        rawCommandOutputIncluded: false,
      },
    },
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      paymentIdentifiersIncluded: false,
      rawCommandOutputIncluded: false,
    },
  };
}

function launchGovernanceEvidence() {
  const surfaces = publicSurfaces();
  const billing = billingReleaseEvidence();
  const approval = (id) => ({
    approved: true,
    reviewedAt: "2026-07-14T22:05:00.000Z",
    reviewer: `${id} reviewer`,
    reviewerRole: `${id} owner`,
    evidenceURL: `https://evidence.relayconsole.work/releases/rc1/governance#${id}`,
  });
  const documentPaths = [
    "/", "/acceptable-use", "/data-deletion", "/privacy",
    "/security", "/subprocessors", "/support", "/terms",
    "/third-party-notices",
  ];
  return {
    schemaVersion: "relay.launch-governance-evidence.v1",
    releaseId: "relay-console-0.1.0-rc1",
    capturedAt: "2026-07-14T22:09:57.000Z",
    candidate: {
      sourceCommit: "a".repeat(40),
      manifestSHA256: authorizedCandidateSHA256,
    },
    releaseBinding: {
      sourceBranch: "release/relay-console-1.0.0-rc1",
      vercelDeploymentId: "1234",
      publicSurfacesSHA256: hashJson(surfaces),
      billingReleaseSHA256: hashJson(billing),
    },
    documents: documentPaths.map((path) => ({
      path,
      bodySHA256: surfaces.routes.find((route) => route.path === path).bodySha256,
    })),
    results: {
      schemaVersion: "relay.launch-governance-results.v3",
      completedAt: "2026-07-14T22:09:45.000Z",
      launchCountries: ["GB"],
      approvals: {
        legalPolicyReview: {
          ...approval("legal"),
          qualifiedForLaunchCountries: true,
        },
        acceptableUseApproval: approval("acceptable-use"),
        supportApproval: approval("support"),
        productClaimsApproval: approval("product"),
        dataHandlingApproval: approval("data"),
        thirdPartyNoticesApproval: {
          ...approval("third-party-notices"),
          lockedDependencyInventoryReviewed: true,
          requiredLicenseTextsPresent: true,
        },
      },
      support: {
        address: "hello@relayconsole.work",
        hoursPublished: true,
        responseTargetPublished: true,
        mailRoutingVerified: true,
        accountableOwner: "Support owner",
      },
      productClaims: {
        relayMonthlyPriceUSD: "9.99",
        relayTaxDisclosure: "varies-by-region",
        customerOperatedRuntime: true,
        paidEntitlementRequired: true,
        managedRuntimeAvailableAtLaunch: false,
        enterpriseAvailableAtLaunch: false,
      },
      privacy: {
        credentialsIncluded: false,
        secretValuesIncluded: false,
        customerContentIncluded: false,
        customerIdentifiersIncluded: false,
        rawDocumentBodiesIncluded: false,
      },
    },
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      rawDocumentBodiesIncluded: false,
      rawReviewMaterialIncluded: false,
    },
  };
}

function appStoreReleaseEvidence() {
  const review = (id) => ({
    reviewedAt: "2026-07-14T22:08:00.000Z",
    reviewer: `${id} reviewer`,
    evidenceURL: `https://evidence.relayconsole.work/releases/rc1/app-store#${id}`,
  });
  const testFlight = (id) => ({
    status: "passed",
    testedBuildId: "build-1",
    iPhoneCovered: true,
    iPadCovered: true,
    completedAt: "2026-07-14T22:08:00.000Z",
    reviewer: `${id} reviewer`,
    evidenceURL: `https://evidence.relayconsole.work/releases/rc1/app-store#${id}`,
  });
  return {
    schemaVersion: "relay.app-store-release-evidence.v1",
    releaseId: "relay-console-0.1.0-rc1",
    capturedAt: "2026-07-14T22:09:58.000Z",
    candidate: {
      sourceCommit: "a".repeat(40),
      manifestSHA256: authorizedCandidateSHA256,
    },
    releaseBinding: {
      sourceBranch: "release/relay-console-1.0.0-rc1",
      iOSDistributionSHA256: hashJson(iOSDistribution()),
      billingReleaseSHA256: hashJson(billingReleaseEvidence()),
      publicSurfacesSHA256: hashJson(publicSurfaces()),
    },
    repository: appStoreRepositoryEvidence(repositoryRoot),
    results: {
      schemaVersion: "relay.app-store-release-results.v1",
      completedAt: "2026-07-14T22:09:50.000Z",
      app: {
        appId: "app-1",
        buildId: "build-1",
        bundleIdentifier: "com.relayconsole.app",
        teamIdentifier: "A1B2C3D4E5",
        version: "1.0",
        build: "1",
        locale: "en-GB",
      },
      listing: {
        metadataSubmitted: true,
        metadataReviewed: true,
        iPhoneScreenshotsSubmitted: true,
        iPadScreenshotsSubmitted: true,
        screenshotsMatchBuild: true,
        privacyURL: "https://relayconsole.work/privacy",
        supportURL: "https://relayconsole.work/support",
        termsURL: "https://relayconsole.work/terms",
        ageRatingCompleted: true,
        exportComplianceCompleted: true,
        reviewNotesSubmitted: true,
        ...review("listing"),
      },
      privacyDisclosures: {
        submitted: true,
        reviewedAgainstFrozenBinary: true,
        reviewedAgainstFrozenMarketplace: true,
        tracking: false,
        categories: {
          account: true,
          messages: true,
          providerConnections: true,
          diagnostics: true,
          purchases: true,
          deviceData: true,
          telemetry: true,
        },
        ...review("privacy"),
      },
      reviewPath: {
        accountEmailVerified: true,
        writableSubscription: true,
        runtimeBridgeOnline: true,
        agentAvailable: true,
        messageRoundTripPassed: true,
        restorePurchasesPassed: true,
        accountExportPassed: true,
        accountDeletionPassed: true,
        ...review("review-path"),
      },
      deviceAcceptance: {
        iPhonePassed: true,
        iPadPassed: true,
        dynamicTypePassed: true,
        voiceOverPassed: true,
        darkModePassed: true,
        keyboardPassed: true,
        supportedRotationPassed: true,
        poorNetworkPassed: true,
        offlineRuntimePassed: true,
        expiredSubscriptionPassed: true,
        expiredAuthenticationPassed: true,
        ...review("devices"),
      },
      testFlight: {
        internal: testFlight("testflight-internal"),
        external: testFlight("testflight-external"),
      },
      appReview: {
        approvalStatus: "approved",
        submissionId: "submission-1",
        submittedBuildId: "build-1",
        storeState: "PENDING_DEVELOPER_RELEASE",
        rejectionCount: 0,
        resolvedRejectionCount: 0,
        unresolvedRejectionCount: 0,
        reviewedAt: "2026-07-14T22:08:00.000Z",
        verifiedBy: "Release owner",
        evidenceURL: "https://evidence.relayconsole.work/releases/rc1/app-store#app-review",
      },
      privacy: {
        credentialsIncluded: false,
        secretValuesIncluded: false,
        reviewAccountIdentifiersIncluded: false,
        customerContentIncluded: false,
        paymentIdentifiersIncluded: false,
        rawScreenshotsIncluded: false,
      },
    },
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      reviewAccountIdentifiersIncluded: false,
      customerContentIncluded: false,
      paymentIdentifiersIncluded: false,
      rawScreenshotsIncluded: false,
      rawAppStoreConnectResponseIncluded: false,
    },
  };
}

function macOSPublicationEvidence() {
  const surfaces = publicSurfaces();
  const distribution = macOSDistribution();
  const review = (id) => ({
    reviewedAt: "2026-07-14T22:09:00.000Z",
    reviewer: `${id} reviewer`,
    evidenceURL: `https://evidence.relayconsole.work/releases/rc1/macos#${id}`,
  });
  const current = {
    version: distribution.artifact.appVersion,
    build: distribution.artifact.appBuild,
    fileName: distribution.artifact.fileName,
    url: `https://relayconsole.work/downloads/${distribution.artifact.fileName}`,
    checksumURL: `https://relayconsole.work/downloads/${distribution.artifact.fileName}.sha256`,
    sha256: distribution.artifact.dmgSHA256,
    sizeBytes: distribution.artifact.dmgSizeBytes,
    publishedAt: "2026-07-14T22:08:30.000Z",
    architectures: distribution.artifact.architectures,
    signatureMode: distribution.signing.mode,
    notarizationStatus: "accepted-stapled",
    distributionEvidenceSHA256: hashJson(distribution),
  };
  return {
    schemaVersion: "relay.macos-publication-evidence.v1",
    releaseId: "relay-console-0.1.0-rc1",
    capturedAt: "2026-07-14T22:09:59.000Z",
    candidate: {
      sourceCommit: "a".repeat(40),
      manifestSHA256: authorizedCandidateSHA256,
    },
    releaseBinding: {
      sourceBranch: "release/relay-console-1.0.0-rc1",
      vercelDeploymentId: "1234",
      macOSDistributionSHA256: hashJson(distribution),
      publicSurfacesSHA256: hashJson(surfaces),
    },
    pages: ["/download", "/release-notes", "/support", "/updates"].map((path) => ({
      path,
      bodySHA256: surfaces.routes.find((route) => route.path === path).bodySha256,
    })),
    updateManifest: {
      url: "https://relayconsole.work/updates/public-beta.json",
      finalURL: "https://relayconsole.work/updates/public-beta.json",
      status: 200,
      contentType: "application/json; charset=utf-8",
      bodySHA256: "3".repeat(64),
      document: {
        schemaVersion: "relay.macos-update-manifest.v1",
        channel: "public-beta",
        generatedAt: "2026-07-14T22:09:00.000Z",
        manualUpdate: true,
        current,
        previous: null,
        previousDMGMinimumRetentionDays: 30,
        downloadPageURL: "https://relayconsole.work/download",
        releaseNotesURL: "https://relayconsole.work/release-notes",
        supportURL: "https://relayconsole.work/support",
        rollbackPolicyURL: "https://relayconsole.work/updates",
      },
    },
    download: {
      url: current.url,
      finalURL: current.url,
      status: 200,
      contentType: "application/x-apple-diskimage",
      sha256: current.sha256,
      sizeBytes: current.sizeBytes,
    },
    checksum: {
      url: current.checksumURL,
      finalURL: current.checksumURL,
      status: 200,
      contentType: "text/plain; charset=utf-8",
      bodySHA256: "4".repeat(64),
      advertisedSHA256: current.sha256,
      advertisedFileName: current.fileName,
    },
    previousDownload: null,
    previousChecksum: null,
    previousDistribution: null,
    results: {
      schemaVersion: "relay.macos-publication-results.v1",
      completedAt: "2026-07-14T22:09:50.000Z",
      releaseHistory: { firstPublicRelease: true },
      publicationReview: {
        downloadPageMatchesArtifact: true,
        releaseNotesMatchArtifact: true,
        supportPathUsable: true,
        updateManifestReviewed: true,
        ...review("publication"),
      },
      cleanMachine: {
        supportedMacPassed: true,
        developmentToolsAbsent: true,
        independentHermesPassed: true,
        independentOpenClawPassed: true,
        ...review("clean-machine"),
      },
      lifecycle: {
        databaseMigrationPassed: true,
        exportPassed: true,
        resetPassed: true,
        updatePassed: true,
        rollbackPassed: true,
        keychainContinuityPassed: true,
        uninstallBoundaryPassed: true,
        ...review("lifecycle"),
      },
      policy: {
        manualSignedUpdates: true,
        rollbackPolicyPublished: true,
        minimumPreviousDMGRetentionDays: 30,
        ...review("policy"),
      },
      privacy: {
        credentialsIncluded: false,
        secretValuesIncluded: false,
        customerContentIncluded: false,
        customerIdentifiersIncluded: false,
        rawScreenshotsIncluded: false,
        rawMachineInventoryIncluded: false,
      },
    },
    privacy: {
      credentialsIncluded: false,
      secretValuesIncluded: false,
      customerContentIncluded: false,
      customerIdentifiersIncluded: false,
      rawScreenshotsIncluded: false,
      rawMachineInventoryIncluded: false,
      artifactBytesIncluded: false,
      rawPageBodiesIncluded: false,
    },
  };
}

function completeArtifacts() {
  const macOS = macOSDistribution();
  const iOS = iOSDistribution();
  return {
    macOSDistribution: macOS,
    macOSDistributionSHA256: hashJson(macOS),
    iOSDistribution: iOS,
    iOSDistributionSHA256: hashJson(iOS),
  };
}

function emptyArtifacts() {
  return {
    macOSDistribution: null,
    macOSDistributionSHA256: null,
    iOSDistribution: null,
    iOSDistributionSHA256: null,
  };
}

function bridgePlugins() {
  return [
    {
      id: "hermes-agent-bridge",
      version: "1.0.0",
      supportedHarness: { version: "v2026.7.7.2", commit: "8".repeat(40) },
      candidateHostOS: ["linux-systemd", "macos-launchd"],
    },
    {
      id: "openclaw-bridge",
      version: "1.0.0",
      supportedHarness: { version: "v2026.6.11", commit: "9".repeat(40) },
      candidateHostOS: ["linux-systemd", "macos-launchd"],
    },
  ];
}

function bridgeAcceptance() {
  const record = (plugin, kind, hostOS, runtimeLocation) => ({
    recordId: `${plugin.id}-${kind}-${hostOS ?? "clients"}`,
    release: "v1.0.0",
    pluginId: plugin.id,
    pluginVersion: plugin.version,
    harness: { ...plugin.supportedHarness },
    scope: { kind, hostOS, runtimeLocation },
    executedAt: "2026-07-14T22:04:00.000Z",
    operator: "Bridge acceptance operator",
    reviewedBy: "Independent bridge reviewer",
    independentReview: true,
    backendDeploymentId: "railway-1",
    runtimeInstalledBeforeBridge: true,
    relayInstalledRuntime: false,
    cleanHost: kind === "clean-host" ? true : null,
    clients: kind === "cross-client"
      ? { macos: "0.1.0/1", web: "1234", iphone: "1.0/1", ipad: "1.0/1" }
      : null,
    journeyCount: kind === "clean-host" ? 13 : 11,
    allJourneysPassed: true,
    evidenceArtifactCount: 1,
    evidenceArtifactsSHA256: "4".repeat(64),
    recordSHA256: "5".repeat(64),
    noSecrets: true,
  });
  const records = bridgePlugins().flatMap((plugin) => [
    record(plugin, "clean-host", "macos-launchd", "same-mac"),
    record(plugin, "clean-host", "linux-systemd", "linux-vps"),
    record(plugin, "cross-client", null, "second-computer"),
  ]);
  return {
    recordCount: records.length,
    matrixSHA256: "6".repeat(64),
    backendDeploymentId: "railway-1",
    latestExecutedAt: "2026-07-14T22:04:00.000Z",
    records,
  };
}

function emptyBridgeAcceptance() {
  return {
    recordCount: 0,
    matrixSHA256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    backendDeploymentId: null,
    latestExecutedAt: null,
    records: [],
  };
}

function freezeSourceAudit(overrides = {}) {
  const empty = marketplaceFreezeHash([]);
  const base = {
    schemaVersion: "relay.marketplace-freeze-source-audit.v1",
    policyVersion: "relay.marketplace-freeze-path-policy.v1",
    capturedAt: "2026-07-14T20:55:00.000Z",
    source: {
      repository: "insitektalay/relay-console",
      branch: "codex/shared-marketplace-loop",
      revision: "a".repeat(40),
      treeSHA1: "b".repeat(40),
      clean: true,
    },
    releaseBase: {
      branch: "codex/production-launch-readiness",
      revision: "c".repeat(40),
      clean: true,
    },
    divergenceBaseRevision: "d".repeat(40),
    changes: {
      total: { count: 1, sha256: "1".repeat(64) },
      automatic: { count: 1, sha256: "1".repeat(64) },
      reviewRequired: { count: 0, sha256: empty },
      prohibited: { count: 0, sha256: empty },
    },
    providers: { manifestCount: 1, manifestSHA256: "2".repeat(64) },
    review: { status: "not-required", reviewer: null, reviewerRole: null, rationale: null },
    privacy: { localPathsIncluded: false, secretValuesIncluded: false, fileContentsIncluded: false },
  };
  return {
    ...base,
    ...overrides,
    source: { ...base.source, ...(overrides.source ?? {}) },
    releaseBase: { ...base.releaseBase, ...(overrides.releaseBase ?? {}) },
    changes: { ...base.changes, ...(overrides.changes ?? {}) },
    providers: { ...base.providers, ...(overrides.providers ?? {}) },
    review: { ...base.review, ...(overrides.review ?? {}) },
    privacy: { ...base.privacy, ...(overrides.privacy ?? {}) },
  };
}

function candidate(overrides = {}) {
  const acceptance = finalAcceptance();
  const recovery = failureRecovery();
  const billing = billingReleaseEvidence();
  const governance = launchGovernanceEvidence();
  const appStore = appStoreReleaseEvidence();
  const macOSPublication = macOSPublicationEvidence();
  const journeys = launchJourneyEvidence();
  const checklist = productionChecklistEvidence();
  const base = {
    schemaVersion: "relay.release-candidate.v1",
    status: "final",
    releaseId: "relay-console-0.1.0-rc1",
    createdAt: "2026-07-14T22:10:00.000Z",
    source: { branch: "release/relay-console-1.0.0-rc1", commit: "a".repeat(40), clean: true },
    components: {
      backend: { version: "1.0.0" }, web: { version: "0.0.1" },
      website: { version: "0.1.0" },
      macOS: { version: "0.1.0", build: "1", bundleIdentifier: "com.relayconsole.app", minimumOS: "14.0", architectures: ["arm64"] },
      iOS: { version: "1.0", build: "1", bundleIdentifier: "com.relayconsole.app", minimumOS: "18.0" },
    },
    contracts: { api: "v1", runtime: "bridge.v1", marketplace: "swift-marketplace.v1", deploymentManifest: "relay.deployment-manifest.v1", releaseManifest: "relay.release-manifest.v1" },
    database: { firstMigration: "001", lastMigration: "058", migrationCount: 58, migrationSourceSHA256: "b".repeat(64) },
    catalog: {
      releaseManifestSchemaVersion: "relay.marketplace-release.v1",
      releaseManifestVersion: "2026-07-14-draft.1",
      releaseManifestParity: true,
      releaseChannel: "public-beta",
      freezeStatus: "frozen",
      frozenAt: "2026-07-14T21:00:00.000Z",
      sourceRevision: "a".repeat(40),
      freezeSourceAudit: freezeSourceAudit(),
      freezeSourceAuditSHA256: hashJson(freezeSourceAudit()),
      reviewedProviderCount: 1,
      connectEligibleSlugs: ["example"],
      providerManifestCount: 1,
      providerAcceptanceCount: 1,
      providerAcceptanceSHA256: "7".repeat(64),
      swiftSlugCount: 1,
      backendSlugCount: 1,
      connectorCount: 1,
      sourceSHA256: "c".repeat(64),
    },
    bridge: { branch: "codex/prd2-bridge-hardening", commit: "d".repeat(40), clean: true, release: "v1.0.0", releaseStatus: "stable", releaseTag: "v1.0.0", releaseTagAtHead: true, releaseTagAnnotated: true, stableGatePassed: true, supportedBackend: { version: "1.0.0", commit: "a".repeat(40), origin: "https://api.relayconsole.work" }, plugins: bridgePlugins(), acceptance: bridgeAcceptance(), compatibilityManifestSHA256: "e".repeat(64), backendCompatibilityManifestSHA256: "e".repeat(64), compatibilityParity: true },
    deployments: {
      railwayDeploymentId: "railway-1",
      vercelDeploymentId: "1234",
      railwayTopology: railwayTopology(),
      railwayTopologySHA256: topologySHA256,
      railwayConfiguration: railwayConfiguration(),
      railwayConfigurationSHA256,
    },
    artifacts: completeArtifacts(),
    evidence: {
      remote: remoteEvidence(),
      remoteSHA256: remoteEvidenceSHA256,
      publicSurfaces: publicSurfaces(),
      publicSurfacesSHA256,
      macOSPublication,
      macOSPublicationSHA256: hashJson(macOSPublication),
      productionSmoke: productionSmoke(),
      productionSmokeSHA256,
      failureRecovery: recovery,
      failureRecoverySHA256: hashJson(recovery),
      billingRelease: billing,
      billingReleaseSHA256: hashJson(billing),
      launchGovernance: governance,
      launchGovernanceSHA256: hashJson(governance),
      appStoreRelease: appStore,
      appStoreReleaseSHA256: hashJson(appStore),
      launchJourneys: journeys,
      launchJourneysSHA256: hashJson(journeys),
      productionChecklist: checklist,
      productionChecklistSHA256: hashJson(checklist),
      goNoGoOwner: "Release owner",
      finalAcceptance: acceptance,
      finalAcceptanceSHA256: hashJson(acceptance),
    },
  };
  return {
    ...base,
    ...overrides,
    source: { ...base.source, ...(overrides.source ?? {}) },
    components: { ...base.components, ...(overrides.components ?? {}) },
    database: { ...base.database, ...(overrides.database ?? {}) },
    catalog: { ...base.catalog, ...(overrides.catalog ?? {}) },
    bridge: {
      ...base.bridge,
      ...(overrides.bridge ?? {}),
      supportedBackend: {
        ...base.bridge.supportedBackend,
        ...(overrides.bridge?.supportedBackend ?? {}),
      },
    },
    deployments: { ...base.deployments, ...(overrides.deployments ?? {}) },
    artifacts: { ...base.artifacts, ...(overrides.artifacts ?? {}) },
    evidence: { ...base.evidence, ...(overrides.evidence ?? {}) },
  };
}

test("accepts a complete final candidate", () => {
  assert.deepEqual(validateReleaseCandidate(candidate()), { valid: true, errors: [], warnings: [] });
});

test("the compiled schema rejects unsupported fields and invalid referenced records", () => {
  const manifest = candidate();
  manifest.unexpected = true;
  manifest.bridge.supportedBackend.secret = "must-not-pass";
  manifest.deployments.railwayTopology.production.backend.rootDirectory = "/";
  manifest.deployments.railwayConfiguration.configuration.billing.secret = "must-not-pass";
  manifest.evidence.publicSurfaces.releaseIdentity.document.secret = "must-not-pass";
  manifest.evidence.productionSmoke.checks.webRoot.secret = "must-not-pass";
  manifest.evidence.finalAcceptance.gates.billing.unexpected = true;

  const errors = validateReleaseCandidateSchema(manifest);
  assert(errors.some((error) => error.includes("unsupported field unexpected")));
  assert(errors.some((error) => error.includes("unsupported field secret")));
  assert(errors.some((error) => error.includes("rootDirectory")));
  assert(errors.some((error) => error.includes("unsupported field unexpected")));
});

test("bridge evidence executes the stable gate and requires the exact annotated tag at HEAD", () => {
  const bridgeRoot = mkdtempSync(join(tmpdir(), "relay-product-bridge-evidence-"));
  try {
    const gatePath = resolve(bridgeRoot, "scripts/bridge-release-gate.mjs");
    mkdirSync(dirname(gatePath), { recursive: true });
    writeFileSync(gatePath, "process.exit(0);\n");
    writeFileSync(resolve(bridgeRoot, "fixture.txt"), "bridge fixture\n");
    execFileSync("git", ["init", "--quiet"], { cwd: bridgeRoot });
    execFileSync("git", ["config", "user.email", "release-gate@example.invalid"], { cwd: bridgeRoot });
    execFileSync("git", ["config", "user.name", "Release Gate"], { cwd: bridgeRoot });
    execFileSync("git", ["add", "."], { cwd: bridgeRoot });
    execFileSync("git", ["commit", "--quiet", "-m", "stable fixture"], { cwd: bridgeRoot });
    execFileSync("git", ["tag", "-a", "v1.0.0", "-m", "stable fixture"], { cwd: bridgeRoot });

    assert.deepEqual(
      bridgeReleaseEvidence({ bridgeRoot, status: "candidate", releaseTag: "v1.0.0" }),
      { releaseTagAtHead: true, releaseTagAnnotated: true, stableGatePassed: true },
    );

    execFileSync("git", ["tag", "-d", "v1.0.0"], { cwd: bridgeRoot, stdio: "ignore" });
    execFileSync("git", ["tag", "v1.0.0"], { cwd: bridgeRoot });
    writeFileSync(gatePath, "process.exit(1);\n");
    assert.deepEqual(
      bridgeReleaseEvidence({ bridgeRoot, status: "candidate", releaseTag: "v1.0.0" }),
      { releaseTagAtHead: true, releaseTagAnnotated: false, stableGatePassed: false },
    );
  } finally {
    rmSync(bridgeRoot, { recursive: true, force: true });
  }
});

test("bridge acceptance evidence binds record and artifact bytes without leaving the repository", () => {
  const bridgeRoot = mkdtempSync(join(tmpdir(), "relay-product-bridge-matrix-"));
  const release = "v1.0.0";
  const recordDirectory = resolve(bridgeRoot, "acceptance/records", release);
  const evidenceDirectory = resolve(bridgeRoot, "acceptance/evidence/record-1");
  try {
    mkdirSync(recordDirectory, { recursive: true });
    mkdirSync(evidenceDirectory, { recursive: true });
    const evidencePath = "acceptance/evidence/record-1/redacted.txt";
    writeFileSync(resolve(bridgeRoot, evidencePath), "redacted evidence\n");
    const recordPath = resolve(recordDirectory, "record-1.json");
    const record = {
      recordId: "record-1",
      release,
      pluginId: "hermes-agent-bridge",
      pluginVersion: "1.0.0",
      harness: { version: "v1", commit: "8".repeat(40) },
      scope: { kind: "clean-host", hostOS: "macos-launchd", runtimeLocation: "same-mac" },
      executedAt: "2026-07-14T22:04:00.000Z",
      operator: "operator",
      reviewedBy: "reviewer",
      environment: {
        backendDeploymentId: "railway-1",
        runtimeInstalledBeforeRelayBridge: true,
        relayInstalledRuntime: false,
        cleanHost: true,
      },
      journeys: { install: "passed" },
      evidence: [{ path: evidencePath, redacted: true, containsSecrets: false }],
    };
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);

    const first = bridgeAcceptanceEvidence({ bridgeRoot, release });
    assert.equal(first.recordCount, 1);
    assert.match(first.records[0].recordSHA256, /^[a-f0-9]{64}$/);
    assert.match(first.records[0].evidenceArtifactsSHA256, /^[a-f0-9]{64}$/);
    assert.notEqual(first.matrixSHA256, emptyBridgeAcceptance().matrixSHA256);

    writeFileSync(resolve(bridgeRoot, evidencePath), "changed redacted evidence\n");
    const changed = bridgeAcceptanceEvidence({ bridgeRoot, release });
    assert.notEqual(changed.matrixSHA256, first.matrixSHA256);
    assert.notEqual(
      changed.records[0].evidenceArtifactsSHA256,
      first.records[0].evidenceArtifactsSHA256,
    );

    const gatePath = resolve(bridgeRoot, "scripts/bridge-acceptance-gate.mjs");
    mkdirSync(dirname(gatePath), { recursive: true });
    writeFileSync(gatePath, "process.exit(0);\n");
    assert.equal(
      bridgeAcceptanceEvidence({ bridgeRoot, release, verifyGate: true }).recordCount,
      1,
    );
    writeFileSync(gatePath, "process.exit(1);\n");
    assert.throws(
      () => bridgeAcceptanceEvidence({ bridgeRoot, release, verifyGate: true }),
      /declared-status acceptance gate failed/,
    );

    record.evidence[0].path = "../outside.txt";
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
    assert.throws(
      () => bridgeAcceptanceEvidence({ bridgeRoot, release }),
      /bridge evidence path is unsafe/,
    );
  } finally {
    rmSync(bridgeRoot, { recursive: true, force: true });
  }
});

test("refuses a dirty final candidate and a zero-provider release", () => {
  const manifest = candidate({
    source: { branch: "release/relay-console-1.0.0-rc1", commit: "a".repeat(40), clean: false },
    catalog: { sourceSHA256: "c".repeat(64), releaseManifestParity: true, freezeStatus: "open", connectEligibleSlugs: [] },
  });
  const result = validateReleaseCandidate(manifest);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /source tree is dirty/);
  assert.match(result.errors.join("\n"), /frozen Marketplace manifest/);
  assert.match(result.errors.join("\n"), /at least one live-verified Marketplace provider/);
});

test("refuses a malformed or future Marketplace freeze identity", () => {
  const manifest = candidate({
    status: "candidate",
    catalog: {
      sourceRevision: "short",
      frozenAt: "2026-07-15T22:10:01.000Z",
    },
    artifacts: emptyArtifacts(),
  });
  const result = validateReleaseCandidate(manifest, "candidate");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /full Marketplace freeze source revision|sourceRevision/);
  assert.match(result.errors.join("\n"), /frozenAt cannot be later/);
});

test("refuses a missing, unapproved, mismatched, or tampered Marketplace freeze source audit", () => {
  const missing = candidate({
    status: "candidate",
    catalog: { freezeSourceAudit: null, freezeSourceAuditSHA256: null },
    artifacts: emptyArtifacts(),
  });
  assert.match(
    validateReleaseCandidate(missing, "candidate").errors.join("\n"),
    /approved Marketplace freeze source audit/,
  );

  const pendingAudit = freezeSourceAudit({
    changes: {
      total: { count: 2, sha256: "3".repeat(64) },
      reviewRequired: { count: 1, sha256: "4".repeat(64) },
    },
    review: { status: "pending", reviewer: null, reviewerRole: null, rationale: null },
  });
  const pending = candidate({
    status: "candidate",
    catalog: {
      freezeSourceAudit: pendingAudit,
      freezeSourceAuditSHA256: hashJson(pendingAudit),
    },
    artifacts: emptyArtifacts(),
  });
  assert.match(
    validateReleaseCandidate(pending, "candidate").errors.join("\n"),
    /explicit human approval/,
  );

  const mismatchedAudit = freezeSourceAudit({
    source: { revision: "f".repeat(40) },
    providers: { manifestCount: 2 },
  });
  const mismatched = candidate({
    status: "candidate",
    catalog: {
      freezeSourceAudit: mismatchedAudit,
      freezeSourceAuditSHA256: "0".repeat(64),
    },
    artifacts: emptyArtifacts(),
  });
  const errors = validateReleaseCandidate(mismatched, "candidate").errors.join("\n");
  assert.match(errors, /source-audit SHA-256 differs/);
  assert.match(errors, /differs from the release-manifest source revision/);
  assert.match(errors, /provider count differs/);
});

test("saved candidate validation rechecks exact clean checkout and freeze ancestry", () => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "relay-product-release-checkout-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: repositoryRoot });
    execFileSync("git", ["config", "user.email", "release-gate@example.invalid"], { cwd: repositoryRoot });
    execFileSync("git", ["config", "user.name", "Release Gate"], { cwd: repositoryRoot });
    mkdirSync(resolve(repositoryRoot, "packages/marketplace-catalog/providers/example"), { recursive: true });
    writeFileSync(resolve(repositoryRoot, "packages/marketplace-catalog/providers/example/manifest.json"), "{\"slug\":\"example\"}\n");
    execFileSync("git", ["add", "."], { cwd: repositoryRoot });
    execFileSync("git", ["commit", "--quiet", "-m", "shared base"], { cwd: repositoryRoot });
    const releaseBaseRevision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
    mkdirSync(resolve(repositoryRoot, "backend/src/modules/marketplace"), { recursive: true });
    writeFileSync(resolve(repositoryRoot, "backend/src/modules/marketplace/example.ts"), "export const example = true;\n");
    execFileSync("git", ["add", "."], { cwd: repositoryRoot });
    execFileSync("git", ["commit", "--quiet", "-m", "marketplace freeze"], { cwd: repositoryRoot });
    const freezeRevision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
    const sourceTreeSHA1 = execFileSync("git", ["rev-parse", `${freezeRevision}^{tree}`], { cwd: repositoryRoot, encoding: "utf8" }).trim();
    const providerTreeLine = execFileSync(
      "git",
      ["ls-tree", "-r", freezeRevision, "--", "packages/marketplace-catalog/providers"],
      { cwd: repositoryRoot, encoding: "utf8" },
    ).trim();
    const paths = ["backend/src/modules/marketplace/example.ts"];
    const actualFreezeAudit = freezeSourceAudit({
      source: { revision: freezeRevision, treeSHA1: sourceTreeSHA1 },
      releaseBase: { revision: releaseBaseRevision },
      divergenceBaseRevision: releaseBaseRevision,
      changes: {
        total: { count: 1, sha256: marketplaceFreezeHash(paths) },
        automatic: { count: 1, sha256: marketplaceFreezeHash(paths) },
      },
      providers: { manifestCount: 1, manifestSHA256: marketplaceFreezeHash([providerTreeLine]) },
    });
    execFileSync("git", ["checkout", "--quiet", "-b", "release/relay-console-1.0.0-rc1"], { cwd: repositoryRoot });
    writeFileSync(resolve(repositoryRoot, "release.txt"), "release source\n");
    execFileSync("git", ["add", "."], { cwd: repositoryRoot });
    execFileSync("git", ["commit", "--quiet", "-m", "release source"], { cwd: repositoryRoot });
    const releaseCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
    const manifest = candidate({
      source: { branch: "release/relay-console-1.0.0-rc1", commit: releaseCommit, clean: true },
      catalog: {
        sourceRevision: freezeRevision,
        freezeSourceAudit: actualFreezeAudit,
        freezeSourceAuditSHA256: hashJson(actualFreezeAudit),
      },
    });

    assert.deepEqual(validateReleaseCheckout(manifest, repositoryRoot), []);
    manifest.source.branch = "release/substituted";
    assert.match(
      validateReleaseCheckout(manifest, repositoryRoot).join("\n"),
      /branch differs/,
    );
    manifest.source.branch = "release/relay-console-1.0.0-rc1";
    writeFileSync(resolve(repositoryRoot, "dirty.txt"), "not committed\n");
    const dirtyErrors = validateReleaseCheckout(manifest, repositoryRoot);
    assert.match(dirtyErrors.join("\n"), /dirty at validation time/);
    manifest.source.commit = "f".repeat(40);
    const wrongCommitErrors = validateReleaseCheckout(manifest, repositoryRoot);
    assert.match(wrongCommitErrors.join("\n"), /HEAD differs/);
    assert.match(wrongCommitErrors.join("\n"), /not an ancestor/);
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
});

test("saved candidate validation recomputes every frozen repository component", () => {
  const snapshot = frozenRepositorySnapshot(repositoryRoot);
  const manifest = {
    components: structuredClone(snapshot.components),
    database: structuredClone(snapshot.database),
    catalog: structuredClone(snapshot.catalog),
  };
  assert.deepEqual(validateFrozenRepositoryComponents(manifest, repositoryRoot), []);

  manifest.components.backend.version = "substituted";
  manifest.database.migrationSourceSHA256 = "0".repeat(64);
  manifest.catalog.sourceSHA256 = "1".repeat(64);
  const errors = validateFrozenRepositoryComponents(manifest, repositoryRoot).join("\n");
  assert.match(errors, /Frozen component versions differs/);
  assert.match(errors, /Frozen database migration set differs/);
  assert.match(errors, /Frozen Marketplace catalog sourceSHA256 differs/);
});

test("refuses a legacy iOS bundle identifier", () => {
  const manifest = candidate({
    components: {
      backend: { version: "1.0.0" },
      web: { version: "0.0.1" },
      macOS: { version: "0.1.0", build: "1" },
      iOS: { version: "1.0", build: "1", bundleIdentifier: "com.clawchat.app" },
    },
  });
  const result = validateReleaseCandidate(manifest);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /Relay Console bundle identifier/);
});

test("reports unfinished final gates as draft warnings", () => {
  const manifest = candidate({
    status: "draft",
    source: { branch: "codex/production-launch-readiness", commit: "a".repeat(40), clean: false },
    catalog: { sourceSHA256: "c".repeat(64), releaseManifestParity: true, freezeStatus: "open", connectEligibleSlugs: [] },
    deployments: {
      railwayDeploymentId: null,
      vercelDeploymentId: null,
      railwayTopology: null,
      railwayTopologySHA256: null,
      railwayConfiguration: null,
      railwayConfigurationSHA256: null,
    },
    artifacts: emptyArtifacts(),
    evidence: {
      remote: null,
      remoteSHA256: null,
      publicSurfaces: null,
      publicSurfacesSHA256: null,
      macOSPublication: null,
      macOSPublicationSHA256: null,
      productionSmoke: null,
      productionSmokeSHA256: null,
      failureRecovery: null,
      failureRecoverySHA256: null,
      billingRelease: null,
      billingReleaseSHA256: null,
      launchGovernance: null,
      launchGovernanceSHA256: null,
      appStoreRelease: null,
      appStoreReleaseSHA256: null,
      launchJourneys: null,
      launchJourneysSHA256: null,
      productionChecklist: null,
      productionChecklistSHA256: null,
      goNoGoOwner: null,
      finalAcceptance: null,
      finalAcceptanceSHA256: null,
    },
    bridge: { commit: "d".repeat(40), clean: false, release: "v0.2.0-rc.1", releaseStatus: "preview", releaseTag: null, releaseTagAtHead: false, releaseTagAnnotated: false, stableGatePassed: false, supportedBackend: { version: "1.0.0", commit: null, origin: "https://api.relayconsole.work" }, plugins: bridgePlugins(), acceptance: emptyBridgeAcceptance(), compatibilityManifestSHA256: "e".repeat(64), backendCompatibilityManifestSHA256: "e".repeat(64), compatibilityParity: true },
  });
  const result = validateReleaseCandidate(manifest);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.length >= 9);
});

test("refuses a candidate when the backend and bridge compatibility manifests drift", () => {
  const manifest = candidate({
    status: "candidate",
    bridge: {
      commit: "d".repeat(40),
      clean: true,
      releaseTag: "v1.0.0",
      supportedBackend: { version: "1.0.0", commit: "a".repeat(40), origin: "https://api.relayconsole.work" },
      compatibilityManifestSHA256: "e".repeat(64),
      backendCompatibilityManifestSHA256: "f".repeat(64),
      compatibilityParity: false,
    },
    artifacts: emptyArtifacts(),
  });
  const result = validateReleaseCandidate(manifest, "candidate");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /compatibility manifests differ/);
});

test("refuses a preview, mismatched, unverified, or lightweight bridge release", () => {
  const manifest = candidate({
    status: "candidate",
    bridge: {
      ...candidate().bridge,
      releaseStatus: "preview",
      releaseTag: "v9.9.9",
      releaseTagAtHead: false,
      releaseTagAnnotated: false,
      stableGatePassed: false,
    },
    artifacts: emptyArtifacts(),
  });
  const result = validateReleaseCandidate(manifest, "candidate");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /stable bridge compatibility manifest/);
  assert.match(result.errors.join("\n"), /tag must exactly match/);
  assert.match(result.errors.join("\n"), /tag must point at/);
  assert.match(result.errors.join("\n"), /tag must be annotated/);
  assert.match(result.errors.join("\n"), /stable release gate has not passed/);
});

test("refuses a bridge manifest relabelled stable while its release is still a prerelease", () => {
  const manifest = candidate({
    status: "candidate",
    bridge: {
      ...candidate().bridge,
      release: "v1.0.0-rc.1",
      releaseTag: "v1.0.0-rc.1",
    },
    artifacts: emptyArtifacts(),
  });
  const result = validateReleaseCandidate(manifest, "candidate");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /non-prerelease bridge version/);
});

test("refuses a bridge matrix that substitutes a second-computer run for a same-Mac run", () => {
  const manifest = candidate({ status: "candidate", artifacts: emptyArtifacts() });
  const macRecord = manifest.bridge.acceptance.records.find((record) =>
    record.pluginId === "hermes-agent-bridge" && record.scope.hostOS === "macos-launchd"
  );
  macRecord.scope.runtimeLocation = "second-computer";

  const result = validateReleaseCandidate(manifest, "candidate");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /clean-host runtime location is invalid/);
  assert.match(result.errors.join("\n"), /exact six-record bridge matrix/);
});

test("refuses a candidate whose bridge has a mismatched backend version or no full compatibility commit", () => {
  const manifest = candidate({
    status: "candidate",
    bridge: {
      ...candidate().bridge,
      supportedBackend: {
        version: "2.0.0",
        commit: "short",
        origin: "https://api.relayconsole.work",
      },
    },
    artifacts: emptyArtifacts(),
  });
  const result = validateReleaseCandidate(manifest, "candidate");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /supported-backend version differs/);
  assert.match(result.errors.join("\n"), /full backend compatibility commit/);
});

test("keeps the backend compatibility baseline distinct from the self-referential product manifest commit", () => {
  const manifest = candidate({
    status: "candidate",
    bridge: {
      ...candidate().bridge,
      supportedBackend: {
        version: "1.0.0",
        commit: "b".repeat(40),
        origin: "https://api.relayconsole.work",
      },
    },
    artifacts: emptyArtifacts(),
  });
  const result = validateReleaseCandidate(manifest, "candidate");
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("refuses a candidate when a deployable Marketplace manifest snapshot drifts", () => {
  const manifest = candidate({
    status: "candidate",
    catalog: {
      sourceSHA256: "c".repeat(64),
      releaseManifestParity: false,
      freezeStatus: "frozen",
      connectEligibleSlugs: ["example"],
    },
    artifacts: emptyArtifacts(),
  });
  const result = validateReleaseCandidate(manifest, "candidate");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /release-manifest snapshots differ/);
});

test("refuses a candidate whose live Marketplace cohort lacks staging acceptance", () => {
  const manifest = candidate({
    status: "candidate",
    catalog: {
      providerAcceptanceCount: 0,
      providerAcceptanceSHA256: "short",
    },
    artifacts: emptyArtifacts(),
  });
  const result = validateReleaseCandidate(manifest, "candidate");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /Every live-verified Marketplace provider/);
  assert.match(result.errors.join("\n"), /provider-acceptance SHA-256 is invalid|providerAcceptanceSHA256/);
});

test("accepts an artifact-free candidate but not as a final release", () => {
  const manifest = candidate({
    status: "candidate",
    artifacts: emptyArtifacts(),
    evidence: {
      failureRecovery: null,
      failureRecoverySHA256: null,
      billingRelease: null,
      billingReleaseSHA256: null,
      launchGovernance: null,
      launchGovernanceSHA256: null,
      appStoreRelease: null,
      appStoreReleaseSHA256: null,
      macOSPublication: null,
      macOSPublicationSHA256: null,
      launchJourneys: null,
      launchJourneysSHA256: null,
      productionChecklist: null,
      productionChecklistSHA256: null,
    },
  });
  const result = validateReleaseCandidate(manifest, "candidate");
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 10);
});

test("final release rejects missing, incomplete, or tampered production checklist evidence", () => {
  const missing = candidate({
    evidence: {
      productionChecklist: null,
      productionChecklistSHA256: null,
    },
  });
  assert.match(
    validateReleaseCandidate(missing, "final").errors.join("\n"),
    /production checklist has zero open items/,
  );

  const checklist = productionChecklistEvidence();
  checklist.candidate.manifestSHA256 = "0".repeat(64);
  checklist.checklist.completedItemCount = 237;
  checklist.checklist.openItemCount = 1;
  checklist.checklist.status = "incomplete";
  const manifest = candidate({
    evidence: {
      productionChecklist: checklist,
      productionChecklistSHA256: "4".repeat(64),
    },
  });
  const result = validateReleaseCandidate(manifest, "final");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /candidate SHA-256 differs/);
  assert.match(result.errors.join("\n"), /checklist evidence is not complete/);
  assert.match(result.errors.join("\n"), /Production checklist evidence SHA-256 differs/);
});

test("final release rejects missing, tampered, or substituted launch journeys", () => {
  const missing = candidate({
    evidence: {
      launchJourneys: null,
      launchJourneysSHA256: null,
    },
  });
  assert.match(
    validateReleaseCandidate(missing, "final").errors.join("\n"),
    /one-product Relay journey evidence is required/,
  );

  const journeys = launchJourneyEvidence();
  journeys.candidate.manifestSHA256 = "0".repeat(64);
  journeys.results.clientMatrix.iPhone.appBuild = "2";
  journeys.results.marketplace.providerSlug = "outside-cohort";
  const manifest = candidate({
    evidence: {
      launchJourneys: journeys,
      launchJourneysSHA256: "1".repeat(64),
    },
  });
  const result = validateReleaseCandidate(manifest, "final");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /candidate SHA-256 differs/);
  assert.match(result.errors.join("\n"), /iPhone build differs/);
  assert.match(result.errors.join("\n"), /outside the frozen live-verified cohort/);
  assert.match(result.errors.join("\n"), /Launch journey evidence SHA-256 differs/);
});

test("final release rejects missing, stale, tampered, or differently authorized recovery evidence", () => {
  const missing = candidate({
    evidence: {
      failureRecovery: null,
      failureRecoverySHA256: null,
    },
  });
  assert.match(
    validateReleaseCandidate(missing, "final").errors.join("\n"),
    /failure and recovery evidence is required/i,
  );

  const recovery = failureRecovery();
  recovery.capturedAt = "2026-07-12T20:00:00.000Z";
  recovery.candidate.manifestSHA256 = "9".repeat(64);
  recovery.drills.railway_unavailable.deploymentId = "different-deployment";
  const manifest = candidate({
    evidence: {
      failureRecovery: recovery,
      failureRecoverySHA256: "0".repeat(64),
    },
  });
  const result = validateReleaseCandidate(manifest, "final");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /candidate SHA-256 differs/);
  assert.match(result.errors.join("\n"), /wrong deployment/);
  assert.match(result.errors.join("\n"), /evidence SHA-256 differs/);
  assert.match(result.errors.join("\n"), /within 24 hours/);
});

test("final release rejects missing, stale, or substituted billing evidence", () => {
  const missing = candidate({
    evidence: {
      billingRelease: null,
      billingReleaseSHA256: null,
    },
  });
  assert.match(
    validateReleaseCandidate(missing, "final").errors.join("\n"),
    /Stripe and Apple billing evidence is required/,
  );

  const billing = billingReleaseEvidence();
  billing.capturedAt = "2026-07-12T20:00:00.000Z";
  billing.candidate.manifestSHA256 = "9".repeat(64);
  billing.releaseBinding.railwayConfigurationSHA256 = "8".repeat(64);
  billing.artifacts.iOSDistributionSHA256 = "6".repeat(64);
  const manifest = candidate({
    evidence: {
      billingRelease: billing,
      billingReleaseSHA256: "0".repeat(64),
    },
  });
  const result = validateReleaseCandidate(manifest, "final");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /candidate SHA-256 differs/);
  assert.match(result.errors.join("\n"), /configuration SHA-256 differs/);
  assert.match(result.errors.join("\n"), /iOS distribution SHA-256 differs/);
  assert.match(result.errors.join("\n"), /Billing release evidence SHA-256 differs/);
  assert.match(result.errors.join("\n"), /within 24 hours/);
});

test("final release rejects missing, tampered, or substituted governance approval", () => {
  const missing = candidate({
    evidence: {
      launchGovernance: null,
      launchGovernanceSHA256: null,
    },
  });
  assert.match(
    validateReleaseCandidate(missing, "final").errors.join("\n"),
    /legal, policy, product-claim, and support approval is required/,
  );

  const governance = launchGovernanceEvidence();
  governance.candidate.manifestSHA256 = "9".repeat(64);
  governance.releaseBinding.vercelDeploymentId = "different";
  governance.documents.find((document) => document.path === "/terms").bodySHA256 = "8".repeat(64);
  const manifest = candidate({
    evidence: {
      launchGovernance: governance,
      launchGovernanceSHA256: "0".repeat(64),
    },
  });
  const result = validateReleaseCandidate(manifest, "final");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /candidate SHA-256 differs/);
  assert.match(result.errors.join("\n"), /Vercel deployment differs/);
  assert.match(result.errors.join("\n"), /terms governance hash differs/);
  assert.match(result.errors.join("\n"), /Launch governance evidence SHA-256 differs/);
});

test("final release rejects missing, stale, mixed-build, or tampered App Store acceptance", () => {
  const missing = candidate({
    evidence: {
      appStoreRelease: null,
      appStoreReleaseSHA256: null,
    },
  });
  assert.match(
    validateReleaseCandidate(missing, "final").errors.join("\n"),
    /App Store listing, privacy, TestFlight, device, review-path, and App Review evidence is required/,
  );

  const appStore = appStoreReleaseEvidence();
  appStore.capturedAt = "2026-07-12T20:00:00.000Z";
  appStore.candidate.manifestSHA256 = "9".repeat(64);
  appStore.results.testFlight.external.testedBuildId = "older-build";
  appStore.results.appReview.unresolvedRejectionCount = 1;
  const manifest = candidate({
    evidence: {
      appStoreRelease: appStore,
      appStoreReleaseSHA256: "0".repeat(64),
    },
  });
  const result = validateReleaseCandidate(manifest, "final");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /candidate SHA-256 differs/);
  assert.match(result.errors.join("\n"), /External TestFlight tested a different build/);
  assert.match(result.errors.join("\n"), /unresolvedRejectionCount/);
  assert.match(result.errors.join("\n"), /App Store release evidence SHA-256 differs/);
  assert.match(result.errors.join("\n"), /within 24 hours/);
});

test("final release rejects missing, stale, substituted, or tampered macOS publication evidence", () => {
  const missing = candidate({
    evidence: {
      macOSPublication: null,
      macOSPublicationSHA256: null,
    },
  });
  assert.match(
    validateReleaseCandidate(missing, "final").errors.join("\n"),
    /macOS download, checksum, update-manifest, clean-machine, lifecycle, and rollback evidence is required/,
  );

  const publication = macOSPublicationEvidence();
  publication.capturedAt = "2026-07-12T20:00:00.000Z";
  publication.candidate.manifestSHA256 = "9".repeat(64);
  publication.download.sha256 = "8".repeat(64);
  publication.pages.find((page) => page.path === "/download").bodySHA256 = "7".repeat(64);
  const manifest = candidate({
    evidence: {
      macOSPublication: publication,
      macOSPublicationSHA256: "0".repeat(64),
    },
  });
  const result = validateReleaseCandidate(manifest, "final");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /candidate SHA-256 differs/);
  assert.match(result.errors.join("\n"), /Current download SHA-256 differs/);
  assert.match(result.errors.join("\n"), /download page hash differs/);
  assert.match(result.errors.join("\n"), /macOS publication evidence SHA-256 differs/);
  assert.match(result.errors.join("\n"), /within 24 hours/);
});

test("final release rejects fabricated Apple status, tampered evidence, and artifacts from different candidates", () => {
  const macOS = macOSDistribution();
  const iOS = iOSDistribution();
  macOS.notarization.dmgStatus = "Invalid";
  iOS.appStoreConnect.processingState = "PROCESSING";
  iOS.candidate.manifestSHA256 = "9".repeat(64);
  const manifest = candidate({
    artifacts: {
      macOSDistribution: macOS,
      macOSDistributionSHA256: hashJson(macOS),
      iOSDistribution: iOS,
      iOSDistributionSHA256: hashJson(iOS),
    },
  });
  const result = validateReleaseCandidate(manifest, "final");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /must be equal to constant/);
  assert.match(result.errors.join("\n"), /same candidate manifest/);

  const tampered = candidate();
  tampered.artifacts.macOSDistribution.artifact.dmgSHA256 = "0".repeat(64);
  assert.match(
    validateReleaseCandidate(tampered, "final").errors.join("\n"),
    /macOS distribution evidence SHA-256 differs/,
  );
});

test("refuses a stale Railway release-topology snapshot", () => {
  const staleTopology = railwayTopology();
  staleTopology.capturedAt = "2026-07-12T20:00:00.000Z";
  const manifest = candidate({
    deployments: {
      railwayDeploymentId: "railway-1",
      vercelDeploymentId: "1234",
      railwayTopology: staleTopology,
      railwayTopologySHA256: hashJson(staleTopology),
    },
  });
  const result = validateReleaseCandidate(manifest, "candidate");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /within 24 hours/);
});

test("refuses deployment ids that are not derived from the release-bound snapshots", () => {
  const manifest = candidate({
    status: "candidate",
    deployments: {
      railwayDeploymentId: "invented-railway-id",
      vercelDeploymentId: "9999",
    },
    artifacts: emptyArtifacts(),
  });
  const result = validateReleaseCandidate(manifest, "candidate");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /Railway deployment id differs/);
  assert.match(result.errors.join("\n"), /Vercel deployment id differs/);
});

test("refuses missing, incomplete, stale, or tampered Railway configuration evidence", () => {
  const incomplete = railwayConfiguration();
  incomplete.status = "incomplete";
  incomplete.configuration.billing.enabled = false;
  incomplete.capturedAt = "2026-07-12T20:00:00.000Z";
  const manifest = candidate({
    status: "candidate",
    deployments: {
      railwayConfiguration: incomplete,
      railwayConfigurationSHA256: "0".repeat(64),
    },
    artifacts: emptyArtifacts(),
  });

  const result = validateReleaseCandidate(manifest, "candidate");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /configuration is incomplete/);
  assert.match(result.errors.join("\n"), /configuration evidence SHA-256 differs/);
  assert.match(result.errors.join("\n"), /within 24 hours/);

  const missing = candidate({
    status: "candidate",
    deployments: {
      railwayConfiguration: null,
      railwayConfigurationSHA256: null,
    },
    artifacts: emptyArtifacts(),
  });
  assert.match(
    validateReleaseCandidate(missing, "candidate").errors.join("\n"),
    /production configuration evidence is required/,
  );
});

test("refuses failed or tampered remote CI and Vercel evidence", () => {
  const remote = remoteEvidence();
  remote.ciRuns.apple.conclusion = "failure";
  remote.vercel.statusCreator = "someone";
  const manifest = candidate({
    status: "candidate",
    evidence: {
      remote,
      remoteSHA256: hashJson(remote),
      goNoGoOwner: "Release owner",
      finalAcceptance: null,
      finalAcceptanceSHA256: null,
    },
    artifacts: emptyArtifacts(),
  });
  const result = validateReleaseCandidate(manifest, "candidate");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /Apple Beta Readiness is not completed successfully|conclusion/);
  assert.match(result.errors.join("\n"), /not authored by Vercel|statusCreator/);
});

test("refuses missing, stale, unbound, or tampered public-surface evidence for final release", () => {
  const publicEvidence = publicSurfaces();
  publicEvidence.capturedAt = "2026-07-12T20:00:00.000Z";
  publicEvidence.releaseBinding.githubDeploymentId = 9999;
  publicEvidence.releaseIdentity.document.sourceCommit = "b".repeat(40);
  const manifest = candidate({
    evidence: {
      publicSurfaces: publicEvidence,
      publicSurfacesSHA256: "0".repeat(64),
    },
  });
  const result = validateReleaseCandidate(manifest, "final");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /githubDeploymentId differs/);
  assert.match(result.errors.join("\n"), /sourceCommit differs/);
  assert.match(result.errors.join("\n"), /Public surfaces evidence SHA-256 differs/);
  assert.match(result.errors.join("\n"), /within 24 hours/);

  const missing = candidate({
    evidence: { publicSurfaces: null, publicSurfacesSHA256: null },
  });
  assert.match(
    validateReleaseCandidate(missing, "final").errors.join("\n"),
    /Fresh public surfaces bound to the exact Vercel release are required/,
  );
});

test("refuses missing, stale, failed, or substituted production smoke evidence", () => {
  const smoke = productionSmoke();
  smoke.status = "failed";
  smoke.checks.authenticatedWebsocket.socketAuthenticated = false;
  smoke.releaseBinding.railwayDeploymentId = "different-deployment";
  const manifest = candidate({
    createdAt: "2026-07-14T23:20:00.000Z",
    evidence: {
      productionSmoke: smoke,
      productionSmokeSHA256: "0".repeat(64),
    },
  });
  const result = validateReleaseCandidate(manifest, "final");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /status is not ready/);
  assert.match(result.errors.join("\n"), /websocket smoke did not complete/);
  assert.match(result.errors.join("\n"), /railwayDeploymentId differs/);
  assert.match(result.errors.join("\n"), /Production smoke evidence SHA-256 differs/);
  assert.match(result.errors.join("\n"), /within one hour/);

  const missing = candidate({
    evidence: { productionSmoke: null, productionSmokeSHA256: null },
  });
  assert.match(
    validateReleaseCandidate(missing, "final").errors.join("\n"),
    /Fresh passing production smoke evidence is required/,
  );
});

test("refuses a final release without release-bound acceptance", () => {
  const manifest = candidate({
    evidence: {
      remote: remoteEvidence(),
      remoteSHA256: remoteEvidenceSHA256,
      goNoGoOwner: "Release owner",
      finalAcceptance: null,
      finalAcceptanceSHA256: null,
    },
  });
  const result = validateReleaseCandidate(manifest, "final");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /final acceptance record is required/i);
});

test("refuses incomplete, unbound, or tampered final acceptance", () => {
  const acceptance = finalAcceptance({ railwayDeploymentId: "different-deployment" });
  acceptance.gates.billing.passed = false;
  acceptance.gates.publicSurfaces.evidenceURL = "http://insecure.example/evidence";
  acceptance.gates.humanGoNoGo.residualRiskAccepted = false;
  const manifest = candidate({
    evidence: {
      remote: remoteEvidence(),
      remoteSHA256: remoteEvidenceSHA256,
      goNoGoOwner: "Release owner",
      finalAcceptance: acceptance,
      finalAcceptanceSHA256: "0".repeat(64),
    },
  });
  const result = validateReleaseCandidate(manifest, "final");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /Railway deployment differs/);
  assert.match(result.errors.join("\n"), /gate billing has not passed/);
  assert.match(result.errors.join("\n"), /publicSurfaces needs a non-placeholder HTTPS evidence URL/);
  assert.match(result.errors.join("\n"), /accept residual risk/);
  assert.match(result.errors.join("\n"), /SHA-256 differs/);
});

test("refuses a generic Railway operations approval in place of exact controls", () => {
  const acceptance = finalAcceptance();
  acceptance.gates.railwayOperations = {
    passed: true,
    verifiedAt: "2026-07-14T22:05:00.000Z",
    reviewer: "Production operations reviewer",
    evidenceURL: "https://evidence.relayconsole.work/releases/rc1/operations",
  };
  const manifest = candidate({
    evidence: {
      finalAcceptance: acceptance,
      finalAcceptanceSHA256: hashJson(acceptance),
    },
  });
  const result = validateReleaseCandidate(manifest, "final");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /reviewerRole|controls|releaseEvidence|evidenceURLs|privacy/);
  assert.match(result.errors.join("\n"), /unsupported field evidenceURL/);
});

test("refuses incomplete, substituted, private, or broadly reused Railway operations evidence", () => {
  const acceptance = finalAcceptance();
  const operations = acceptance.gates.railwayOperations;
  operations.controls.automatedBackupsEnabled = false;
  operations.releaseEvidence.productionSmokeSHA256 = "0".repeat(64);
  operations.evidenceURLs.backups = operations.evidenceURLs.monitoringAndAlert;
  operations.privacy.secretValuesIncluded = true;
  const manifest = candidate({
    evidence: {
      finalAcceptance: acceptance,
      finalAcceptanceSHA256: hashJson(acceptance),
    },
  });
  const result = validateReleaseCandidate(manifest, "final");
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /automatedBackupsEnabled has not passed/);
  assert.match(result.errors.join("\n"), /productionSmokeSHA256 differs/);
  assert.match(result.errors.join("\n"), /own evidence URL or document anchor/);
  assert.match(result.errors.join("\n"), /secretValuesIncluded must be false/);
});
