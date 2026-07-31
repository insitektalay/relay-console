import type { Metadata } from "next";
import { buildMacOSUpdateManifest } from "../../lib/macos-update-manifest";
import { PolicyPage } from "../policy-page";

export const metadata: Metadata = { title: "Known issues | Relay Console" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function KnownIssuesPage() {
  const manifest = buildMacOSUpdateManifest(process.env);
  if (manifest) {
    const artifact = manifest.current;
    return (
      <PolicyPage
        title={`Known issues for Relay Console ${artifact.version}`}
        description={`Published limits and troubleshooting notes for version ${artifact.version}, build ${artifact.build}.`}
        eyebrow="Public beta release information"
        updatedLabel={`Release published: ${artifact.publishedAt.slice(0, 10)}`}
      >
        <h2>Supported Macs</h2>
        <p>
          This release supports Apple silicon Macs running macOS 14 or later.
          Intel Macs and earlier macOS versions are outside the supported public
          beta configuration.
        </p>
        <h2>Agent availability</h2>
        <p>
          Hermes Agent or OpenClaw must be independently installed, configured,
          authenticated, and running on a computer you control. Keep that host
          awake, online, and connected through the Relay bridge for web,
          iPhone, and iPad access. Relay does not install or repair either
          runtime.
        </p>
        <h2>Applications</h2>
        <p>
          Applications are a local preview in this release, not a promise that
          every catalog entry can connect or execute. Provider setup,
          permissions, quotas, paid plans, and the capabilities of the installed
          runtime can limit an application.
        </p>
        <h2>Hosting and remote access</h2>
        <p>
          Relay does not provide a computer, VPS, managed agent runtime, or
          model usage. Remote access stops when your selected runtime host is
          asleep, offline, or disconnected.
        </p>
        <h2>Updates</h2>
        <p>
          Public beta updates are manual. Read the release notes, export local
          data, and verify the new DMG checksum before replacing the app. A
          previous app version may not read a database changed by a newer
          version.
        </p>
        <h2>Support boundary</h2>
        <p>
          Relay Console does not include emergency support or a service-level
          agreement. Check the service status before reporting a service problem
          and remove credentials, messages, and personal data from logs or
          screenshots you send.
        </p>
      </PolicyPage>
    );
  }

  return (
    <PolicyPage
      title="Known public beta issues"
      description="This list tracks user-visible limits in the candidate under review. Relay will tie the launch version and update date to the signed release artifact."
    >
      <h2>Distribution</h2>
      <p>
        Relay has not published a signed and notarized download. Version 0.1.1
        build 4 targets Apple silicon Macs running macOS 14 or later and uses
        manual signed updates.
      </p>
      <h2>App connections</h2>
      <p>
        Applications are a local preview and are not part of the production
        guarantee. Same-Mac Hermes Agent and OpenClaw connectivity must still
        pass against the signed candidate.
      </p>
      <h2>AgentOps and Insights</h2>
      <p>
        The reviewed earlier artifact routes AgentOps and Insights to
        unavailable states. The replacement paid Relay launch candidate has not
        yet been frozen.
      </p>
      <h2>Accessibility</h2>
      <p>
        Automated visual and source checks pass for the reviewed local artifact.
        Human keyboard, focus, VoiceOver, long-content, and signed-candidate
        visual review remains open.
      </p>
      <h2>Model access</h2>
      <p>
        Hermes Agent or OpenClaw handles OpenAI sign-in. OpenAI controls account
        eligibility, plans, workspaces, usage limits, rollout, and model access.
        Runtime versions support different model sets.
      </p>
    </PolicyPage>
  );
}
