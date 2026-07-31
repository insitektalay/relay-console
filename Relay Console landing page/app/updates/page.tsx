import Link from "next/link";
import type { Metadata } from "next";
import { PolicyPage } from "../policy-page";

export const metadata: Metadata = { title: "Updates and rollback | Relay Console" };

export default function UpdatesPage() {
  return (
    <PolicyPage
      title="Updates and rollback"
      description="Relay Console public beta updates are manual. You choose when to download and install each signed release."
      eyebrow="Public beta update policy"
      updatedLabel="Last updated: 15 July 2026"
    >
      <h2>Install an update</h2>
      <ol>
        <li>Read the release notes and known issues for the new version.</li>
        <li>Export any local data you want to keep as a separate backup.</li>
        <li>Download the DMG from the Relay Console download page.</li>
        <li>Compare its SHA-256 checksum with the published checksum.</li>
        <li>Quit Relay Console, replace the existing app, and open the new version.</li>
      </ol>
      <p>
        Relay Console does not download, install, relaunch, downgrade, or roll back the app on
        your behalf. Each public DMG uses Developer ID signing and Apple notarization.
      </p>

      <h2>Rollback availability</h2>
      <p>
        After Relay publishes a successor, Relay keeps the previous supported notarized DMG and
        checksum available for at least 30 days. The public beta update manifest identifies the
        current and previous supported releases.
      </p>
      <p>
        Relay may remove a previous release sooner when a documented security issue or data-format
        incompatibility makes rollback unsafe. The release notes and known-issues page will state
        that exception and the recovery steps.
      </p>

      <h2>Data compatibility</h2>
      <p>
        A previous app version may be unable to read a database changed by a newer version. Export
        local data before updating and follow the rollback instructions in the release notes. Do
        not replace or edit the Relay Console database by hand.
      </p>

      <h2>Release records</h2>
      <p>
        Review the <Link href="/download">download and checksum</Link>,
        {" "}<Link href="/release-notes">release notes</Link>,
        {" "}<Link href="/known-issues">known issues</Link>, and
        {" "}<Link href="/support">support options</Link> before changing versions.
      </p>
    </PolicyPage>
  );
}
