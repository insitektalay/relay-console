import { MARKETPLACE_CATALOG } from "./catalog/marketplace-catalog";
import { MarketplaceConnectorRegistry } from "./connectors/connector-registry";
import { defaultLocalAppAutonomyPolicy } from "./local-app-autonomy.policy";
import {
  DANGEROUS_POLICY_ACKNOWLEDGEMENT_VERSION,
  DANGEROUS_POLICY_PRESERVED_INVARIANTS,
  DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID,
} from "./marketplace-permission-policy";

describe("Marketplace launch policy", () => {
  it("gives every built-in provider exactly one non-dangerous default profile", () => {
    expect(MARKETPLACE_CATALOG.length).toBeGreaterThan(0);

    for (const app of MARKETPLACE_CATALOG) {
      const defaults = app.approvalProfiles.filter(
        (profile) => profile.defaultSelected,
      );
      expect({
        app: app.slug,
        defaults: defaults.map((profile) => profile.id),
      }).toEqual({
        app: app.slug,
        defaults: [expect.not.stringMatching(/^dangerously_skip_permissions$/)],
      });
      expect(defaults[0]?.id).not.toBe(DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID);
    }
  });

  it("offers the explicitly acknowledged direct-writes profile for every executable provider", () => {
    for (const app of MARKETPLACE_CATALOG) {
      const executableActionCount =
        app.allowedActions.length + app.approvalRequiredActions.length;
      if (executableActionCount === 0) continue;

      expect({
        app: app.slug,
        profiles: app.approvalProfiles.map((profile) => profile.id),
      }).toEqual({
        app: app.slug,
        profiles: expect.arrayContaining([
          DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID,
        ]),
      });
    }
  });

  it("keeps the local-app default fail-closed for external effects", () => {
    const policy = defaultLocalAppAutonomyPolicy();

    expect(policy.mode).toBe("safe_default");
    expect(new Set(Object.values(policy.external))).toEqual(
      new Set(["disabled"]),
    );
    expect(new Set(Object.values(policy.lifecycleStatus))).toEqual(
      new Set(["disabled"]),
    );
    expect(policy.hardStops).toEqual({
      payments: true,
      destructiveDataLoss: true,
      exposeSecrets: true,
      captchaBypass: true,
      legalCommitments: true,
    });
    expect(policy.evidenceRequired).toBe(true);
  });

  it("requires approval or blocks every declared consequential action outside the dangerous policy", () => {
    const violations: string[] = [];
    for (const app of MARKETPLACE_CATALOG) {
      const consequentialActionIds = new Set(
        app.approvalRequiredActions.map((action) => action.id),
      );
      for (const profile of app.approvalProfiles) {
        if (profile.id === DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID) continue;
        const inheritsAppPolicy =
          profile.allowedActions === undefined &&
          profile.approvalRequiredActions === undefined &&
          profile.blockedActions === undefined;
        const allowed = new Set(
          (inheritsAppPolicy
            ? app.allowedActions
            : (profile.allowedActions ?? [])
          ).map((action) => action.id),
        );
        const approvalRequired = new Set(
          (inheritsAppPolicy
            ? app.approvalRequiredActions
            : (profile.approvalRequiredActions ?? [])
          ).map((action) => action.id),
        );
        const blocked = new Set(
          (inheritsAppPolicy
            ? app.blockedActions
            : (profile.blockedActions ?? [])
          ).map((action) => action.id),
        );

        for (const actionId of consequentialActionIds) {
          if (allowed.has(actionId)) {
            violations.push(
              `${app.slug}/${profile.id} allows consequential action ${actionId}`,
            );
          }
          if (!approvalRequired.has(actionId) && !blocked.has(actionId)) {
            violations.push(
              `${app.slug}/${profile.id} does not gate consequential action ${actionId}`,
            );
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("marks every connector write and admin tool as approval-required", () => {
    const manifests = new MarketplaceConnectorRegistry().list();
    expect(manifests.length).toBeGreaterThan(0);

    for (const manifest of manifests) {
      for (const tool of manifest.tools) {
        if (tool.action !== "write" && tool.action !== "admin") continue;
        expect({
          app: manifest.slug,
          tool: tool.name,
          approvalRequired: tool.approvalRequired,
        }).toEqual({
          app: manifest.slug,
          tool: tool.name,
          approvalRequired: true,
        });
      }
    }
  });

  it("versions the advanced acknowledgement and preserves non-approval invariants", () => {
    expect(DANGEROUS_POLICY_ACKNOWLEDGEMENT_VERSION).toBe(
      "relay-marketplace-dangerous-policy-v1",
    );
    expect(new Set(DANGEROUS_POLICY_PRESERVED_INVARIANTS)).toEqual(
      new Set([
        "workspace_and_connection_ownership",
        "provider_authentication_and_granted_authority",
        "selected_capabilities_and_blocked_actions",
        "fixed_provider_origins_and_request_bounds",
        "provider_and_relay_rate_limits",
        "audit_evidence_and_truthful_results",
        "secret_non_exposure",
      ]),
    );
  });
});
