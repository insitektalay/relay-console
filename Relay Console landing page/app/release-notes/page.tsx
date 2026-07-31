import Link from "next/link";
import type { Metadata } from "next";
import { buildMacOSUpdateManifest } from "../../lib/macos-update-manifest";
import { PolicyPage } from "../policy-page";

export const metadata: Metadata = { title: "Release notes | Relay Console" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ReleaseNotesPage() {
  const manifest = buildMacOSUpdateManifest(process.env);
  if (manifest) {
    const artifact = manifest.current;
    return (
      <PolicyPage
        title={`Relay Console ${artifact.version}`}
        description={`Public beta release ${artifact.version}, build ${artifact.build}, for Apple silicon Macs running macOS 14 or later.`}
        eyebrow="Public beta release notes"
        updatedLabel={`Published: ${artifact.publishedAt.slice(0, 10)}`}
      >
        <h2>Included in this release</h2>
        <ul>
          <li>
            Relay for Mac, including conversations, agents, settings, and
            SQLite-backed app data.
          </li>
          <li>
            Connections to customer-operated Hermes Agent and OpenClaw
            runtimes through the Relay bridge.
          </li>
          <li>
            Applications preview and guarded agent actions where the
            installed runtime supports them.
          </li>
          <li>
            Account sync and access from the web, iPhone, and iPad while the
            customer-operated runtime host is awake and connected.
          </li>
        </ul>
        <h2>Runtime responsibility</h2>
        <p>
          Relay Console does not install, authenticate, update, host, or
          uninstall Hermes Agent or OpenClaw. You manage your runtime,
          model-provider account, API charges, and the same Mac where Relay
          Console connects to that runtime directly.
        </p>
        <h2>Updates and rollback</h2>
        <p>
          Updates are manual. Verify the published checksum, export local data
          before replacing the app, and read the{" "}
          <Link href="/updates">update and rollback policy</Link>. A previous
          supported release is retained as described in that policy.
        </p>
        <h2>Known issues and support</h2>
        <p>
          Review <Link href="/known-issues">known issues</Link> before
          installing. If you need help, use the{" "}
          <Link href="/support">support page</Link> and remove secrets or
          private content from anything you send.
        </p>
        <h2>Artifact</h2>
        <p>
          Download <Link href="/download">{artifact.fileName}</Link>, build{" "}
          {artifact.build}. Its SHA-256 is{" "}
          <code className="break-all">{artifact.sha256}</code>.
        </p>
      </PolicyPage>
    );
  }

  return (
    <PolicyPage
      title="Public beta release notes"
      description="Relay will publish release notes against the exact signed artifact. The previous local-only candidate was superseded before publication and has no public download."
    >
      <h2>Release scope</h2>
      <p>
        The launch candidate must cover the paid Relay subscription across the
        Mac, web, iPhone, and iPad apps, with customer-operated Hermes Agent or
        OpenClaw installations connected through the Relay bridge.
      </p>
      <h2>Security and data</h2>
      <p>
        The candidate must support account export and deletion, local reset and
        app-removal cleanup, protected credentials, and the approved production
        diagnostics policy.
      </p>
      <h2>Open launch gates</h2>
      <p>
        Developer ID signing and notarization, same-Mac Hermes and OpenClaw
        acceptance, legal approval, human accessibility review, clean-machine
        acceptance, HTTPS publication, and final go/no-go review remain open.
      </p>
    </PolicyPage>
  );
}
