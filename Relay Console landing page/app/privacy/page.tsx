import type { Metadata } from "next";
import { PolicyPage } from "../policy-page";

export const metadata: Metadata = { title: "Privacy | Relay Console" };

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy"
      description="This draft describes the data boundaries in the Relay Console public beta. A legal reviewer must approve it before launch."
    >
      <h2>Data stored on your Mac</h2>
      <p>
        Relay Console stores your local profile, workspaces, agents, messages,
        runtime bindings, app settings, and operational diagnostics in its
        Application Support folder. macOS Keychain stores credentials. Relay
        Console excludes Keychain values from local exports.
      </p>
      <h2>Relay control plane</h2>
      <p>
        Relay stores your account, workspaces, conversations,
        agents, attachments, synchronization records, bridge state, Marketplace
        connection state, action approvals, bounded action results, and audit
        records in Relay&apos;s Railway-hosted backend. Marketplace provider
        tokens, credentials, and OAuth material are encrypted at rest. Relay
        stores control-plane records, not the runtime files and
        applications on your computer.
      </p>
      <h2>Your agent runtime</h2>
      <p>
        You install and manage Hermes Agent or OpenClaw. That runtime handles
        model-provider sign-in and agent requests on the computer or server
        where you run it. Model and app providers receive the data needed to
        perform your request under their own terms. You are responsible for the
        accounts, permissions, API or model charges, content, and security of
        that runtime host. Hermes Agent and OpenClaw are third-party,
        user-managed runtimes; Relay Console is their interface and control
        plane, not their installer or host. Before the iPhone or iPad app sends
        a message to an agent for the first time, it asks for permission to
        share that message with the user-managed runtime and any model provider
        configured there. You can withdraw that permission in Settings.
      </p>
      <h2>Website data</h2>
      <p>
        The public website and browser app are hosted by Vercel. The Relay
        backend, database, and queues run on Railway. Stripe will process web
        subscription payments when billing is enabled, Resend will deliver
        account email when transactional email is enabled, Apple will process
        iOS distribution and purchases. PostHog and Sentry may receive the
        optional diagnostics described below only after you enable the
        corresponding choice. See the Subprocessors page for the current
        activation status.
      </p>
      <h2>Analytics and diagnostics</h2>
      <p>
        On first launch of the Mac, iPhone, iPad, or browser app, Relay asks
        separately whether you want to share product analytics and crash or
        error reports. Both choices start off, Relay works normally if you
        decline, and you can change either choice later in Settings. If enabled,
        PostHog receives allowlisted feature and screen events plus
        pseudonymous identifiers. If enabled, Sentry receives bounded,
        sanitized error, crash, hang, stack-trace, release, and device context.
        Relay disables PostHog autocapture and session recording and excludes
        form values, messages, prompts, files, credentials, URLs, request
        bodies, screenshots, and view contents. Relay does not use this
        information for advertising or cross-app tracking. Service providers
        may also retain bounded security and access logs. Support bundles omit
        message content and secrets by default; do not send private data unless
        support explicitly asks for it and you agree.
      </p>
      <h2>Export and deletion</h2>
      <p>
        The Mac app can export or reset its local database without removing
        Hermes Agent or OpenClaw. The Relay account export includes owned
        control-plane workspace data. Account deletion requires password
        confirmation, cancellation of active subscriptions, and no unresolved
        shared workspace; it deletes primary workspace data and revokes
        sessions, bridges, OAuth connections, and refresh state. Backup and
        payment-record retention is described on the Data deletion page:
        identifying audit metadata is removed immediately, content-free security
        events expire within 90 days, and deleted primary data ages out of the
        30-day backup window. After subscription expiry, primary Railway
        workspace data remains read-only and exportable for 30 days before
        deletion. Final legal approval remains required.
      </p>
      <h2>Your choices</h2>
      <p>
        You can independently enable or disable PostHog product analytics and
        Sentry crash or error reporting in Settings on Mac, iPhone, iPad, and
        web. You can disconnect Marketplace apps, revoke runtime bridges and
        signed-in sessions, export your Relay account data, or start permanent
        account deletion from Settings. The Data deletion page explains each
        route and the records that Relay must retain for security, billing, or
        legal reasons. Relay does not sell personal data or use it for
        cross-app advertising.
      </p>
      <h2>Security and access</h2>
      <p>
        Relay limits production access to people and services that need it to
        operate, secure, or support the product. Connections use encrypted
        transport. Provider credentials are stored as encrypted, workspace-bound
        secret material and are not returned through connection responses,
        exports, logs, or audit records. The Security page describes current
        controls and the limits of the public beta.
      </p>
      <h2>Children and launch regions</h2>
      <p>
        Relay Console is a work product and is not directed to children. The
        final age-rating, launch-country, international-transfer, and
        regional-rights wording must be confirmed with the intended distribution
        regions during legal and App Store review.
      </p>
      <h2>Contact</h2>
      <p>
        Send privacy questions to{" "}
        <a href="mailto:hello@relayconsole.work">hello@relayconsole.work</a>.
        Relay must approve a privacy owner and response commitment before
        launch.
      </p>
    </PolicyPage>
  );
}
