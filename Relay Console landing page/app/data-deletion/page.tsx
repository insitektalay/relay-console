import type { Metadata } from "next";
import { PolicyPage } from "../policy-page";

export const metadata: Metadata = { title: "Data deletion | Relay Console" };

export default function DataDeletionPage() {
  return (
    <PolicyPage
      title="Data export and deletion"
      description="This draft explains the implemented deletion boundaries and launch retention periods. Final legal approval is still required."
    >
      <h2>Data on your Mac</h2>
      <p>
        Mac app export and reset affect Relay Console&apos;s own database and
        settings. Removing Relay Console data does not uninstall, update, or
        delete Hermes Agent, OpenClaw, model-provider data, or files elsewhere
        on the Mac.
      </p>
      <h2>Relay account export</h2>
      <p>
        Settings can export your profile, memberships, audit-event summaries,
        and all registered workspace-scoped records from workspaces you own.
        Password hashes, session credentials, OAuth verifier material, provider
        credentials, and encrypted-secret fields are excluded.
      </p>
      <h2>Relay account deletion</h2>
      <p>
        Deletion requires your current password and the word DELETE. You must
        first cancel an active Relay subscription and leave or transfer
        workspaces you do not own. Relay then deletes the account and owned primary workspace data
        and revokes web/mobile sessions, legacy refresh state, bridge
        credentials, and Marketplace/OAuth connections.
      </p>
      <h2>After a subscription ends</h2>
      <p>
        Relay keeps primary Railway workspace data read-only and exportable for
        30 days after the paid entitlement expires. You may reactivate during
        that period and restore access to the retained workspace, or delete the
        account sooner. Relay deletes the primary workspace content after 30
        days. Local Relay data remains on your Mac until you reset or remove it.
      </p>
      <h2>Records not erased immediately</h2>
      <p>
        Identifying audit metadata is removed when account deletion succeeds. A
        content-free event type and timestamp may remain for no more than 90
        days. Daily encrypted backups use a 30-day rolling window, so deleted
        data expires as those snapshots age out. Relay keeps its minimal billing
        event ledger for seven years; Stripe and Apple keep invoices and
        transaction records under their own policies and applicable obligations.
      </p>
    </PolicyPage>
  );
}
