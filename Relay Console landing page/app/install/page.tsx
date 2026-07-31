import type { Metadata } from "next";
import { buildMacOSUpdateManifest } from "../../lib/macos-update-manifest";
import { PolicyPage } from "../policy-page";

export const metadata: Metadata = { title: "Install | Relay Console" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function InstallPage() {
  const manifest = buildMacOSUpdateManifest(process.env);
  const artifact = manifest?.current;
  return (
    <PolicyPage
      title="Install the public beta"
      description={
        artifact
          ? `Install Relay Console ${artifact.version}, build ${artifact.build}, from the Developer ID signed and notarized DMG.`
          : "Installation starts after Relay publishes a Developer ID signed and notarized DMG. Do not install an unsigned file that claims to be the public beta."
      }
      eyebrow={artifact ? "Signed public beta" : undefined}
      updatedLabel={
        artifact
          ? `Release published: ${artifact.publishedAt.slice(0, 10)}`
          : undefined
      }
    >
      <h2>Before download</h2>
      <p>
        The public beta supports Apple silicon Macs running macOS 14 or later.
        Check the version, build, file size, SHA-256 checksum, and release notes
        on the download page before installing the signed artifact.
      </p>
      <p>
        Relay Console is an interface for a Hermes Agent or OpenClaw runtime
        that you install, configure, authenticate, and update yourself. Relay
        Console does not install either runtime or include model usage; your
        chosen provider may charge separately.
      </p>
      <p>
        Relay is one paid subscription for the Mac, web, iPhone, and iPad apps.
        It does not provide runtime hosting or model usage. Keep the computer
        running Hermes Agent or OpenClaw awake, online, and connected through
        the Relay bridge when you want to reach its agents remotely.
      </p>
      <h2>Install</h2>
      <ol className="mt-3 list-decimal pl-5">
        <li>
          Download the DMG from{" "}
          <a href="/download">relayconsole.work/download</a>.
        </li>
        <li>
          Compare its SHA-256 checksum with the value on the download page.
        </li>
        <li>Open the DMG and drag Relay Console to Applications.</li>
        <li>
          Open Relay Console from Applications and confirm macOS identifies the
          signed developer.
        </li>
      </ol>
      <h2>Updates</h2>
      <p>
        The first public beta uses manual signed updates only. Relay Console
        never downloads, installs, relaunches, or rolls back in the background.
        Compare the new DMG checksum with the download page, keep the previous
        supported DMG, and follow the release notes before replacing the app in
        Applications.
      </p>
      <h2>Remove the app</h2>
      <p>
        Use Settings, Security, Prepare for app removal before deleting the app.
        That flow removes Relay Console Keychain records and local data, then
        closes the app. It does not uninstall or change your Hermes Agent or
        OpenClaw installation.
      </p>
    </PolicyPage>
  );
}
