import Link from "next/link";
import type { Metadata } from "next";
import { buildMacOSUpdateManifest } from "../../lib/macos-update-manifest";
import { PolicyPage } from "../policy-page";

export const metadata: Metadata = { title: "Download | Relay Console" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

function fileSize(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export default function DownloadPage() {
  const manifest = buildMacOSUpdateManifest(process.env);
  if (manifest) {
    const artifact = manifest.current;
    return (
      <PolicyPage
        title="Download Relay Console"
        description={`Download Relay Console ${artifact.version} build ${artifact.build} for Apple silicon Macs running macOS 14 or later.`}
        eyebrow="Signed public beta"
        updatedLabel={`Published: ${artifact.publishedAt.slice(0, 10)}`}
      >
        <h2>Release details</h2>
        <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2">
          <dt>Version</dt><dd>{artifact.version}</dd>
          <dt>Build</dt><dd>{artifact.build}</dd>
          <dt>Minimum macOS</dt><dd>14.0</dd>
          <dt>Architecture</dt><dd>Apple silicon (arm64)</dd>
          <dt>File</dt><dd>{artifact.fileName}</dd>
          <dt>Size</dt><dd>{fileSize(artifact.sizeBytes)}</dd>
          <dt>SHA-256</dt><dd><code className="break-all">{artifact.sha256}</code></dd>
          <dt>Signature</dt><dd>Developer ID signed</dd>
          <dt>Notarization</dt><dd>Accepted by Apple and stapled</dd>
        </dl>
        <h2>Download</h2>
        <p>
          <a href={artifact.url}>Download {artifact.fileName}</a>. Then download the{" "}
          <a href={artifact.checksumURL}>SHA-256 checksum file</a> and compare it with the value
          above before opening the DMG.
        </p>
        <h2>Before installing</h2>
        <p>
          Read the <Link href="/release-notes">release notes</Link>,{" "}
          <Link href="/known-issues">known issues</Link>, and{" "}
          <Link href="/install">installation guide</Link>. Relay Console uses manual signed
          updates. Review the <Link href="/updates">update and rollback policy</Link> before
          replacing an existing installation.
        </p>
      </PolicyPage>
    );
  }

  return (
    <PolicyPage
      title="Public beta download"
      description="No public artifact is available. The previous local-only candidate was superseded before publication. Relay will enable a download only after the one-product candidate passes signing, notarization, Gatekeeper, quarantine-path, checksum, update, accessibility, and clean-machine review."
    >
      <h2>Candidate metadata</h2>
      <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2">
        <dt>Version</dt><dd>1.0.0 launch target</dd>
        <dt>Build</dt><dd>Assigned from the current exact source at release freeze</dd>
        <dt>Minimum macOS</dt><dd>14.0</dd>
        <dt>Architecture</dt><dd>Apple silicon (arm64)</dd>
        <dt>DMG</dt><dd>Not published</dd>
        <dt>SHA-256</dt><dd>Not available</dd>
        <dt>Signature</dt><dd>Developer ID candidate signing pending</dd>
        <dt>Notarization</dt><dd>Apple acceptance pending</dd>
      </dl>
      <h2>Release information</h2>
      <p>
        Read the <Link href="/release-notes">candidate release notes</Link>,
        {" "}<Link href="/known-issues">known issues</Link>, and
        {" "}<Link href="/install">installation guide</Link>. Review the
        {" "}<Link href="/updates">update and rollback policy</Link>. Relay will replace candidate values
        with the signed artifact metadata before enabling the download.
      </p>
    </PolicyPage>
  );
}
