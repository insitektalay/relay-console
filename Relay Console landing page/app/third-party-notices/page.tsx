import type { Metadata } from "next";
import dependencyInventory from "../../lib/third-party-dependency-inventory.json";
import { PolicyPage } from "../policy-page";

export const metadata: Metadata = { title: "Third-party notices | Relay Console" };

export default function ThirdPartyNoticesPage() {
  return (
    <PolicyPage
      title="Third-party notices"
      description="This draft inventory names the locked production dependency graphs for the Relay control plane, browser app, and public website. The release process must ship reviewed license text with the signed artifact."
    >
      <h2>macOS app packages</h2>
      <ul>
        <li>Swift Markdown UI 2.4.1, MIT License, copyright Guillermo Gonzalez.</li>
        <li>NetworkImage 6.0.1, MIT License, copyright Guille Gonzalez.</li>
        <li>swift-cmark 0.8.0, BSD and component notices listed in its COPYING file.</li>
      </ul>
      <h2>iPhone and iPad app package</h2>
      <ul>
        <li>Sentry Cocoa 8.58.2, MIT License, copyright 2015 Sentry.</li>
      </ul>
      <h2>Website packages</h2>
      <p>
        The website uses Next.js, React, Tailwind CSS, Lucide React, Radix Slot, and their locked
        package dependencies. The exact production package versions and license categories appear
        below and are bound to the checked-in lockfiles by SHA-256.
      </p>
      <h2>Locked production dependency inventory</h2>
      <p>
        This technical inventory covers the Relay control-plane backend, browser application,
        and public website. It excludes installation paths and does not
        represent legal approval of a license category.
      </p>
      {dependencyInventory.surfaces.map((surface) => (
        <details className="my-4 rounded-xl border border-[color:var(--border)] p-4" key={surface.id}>
          <summary className="cursor-pointer font-medium text-foreground">
            {surface.label}: {surface.packageVersionCount} package versions
          </summary>
          <p>
            Lockfile: <code>{surface.lockfilePath}</code><br />
            Lockfile SHA-256: <code className="break-all">{surface.lockfileSHA256}</code>
          </p>
          <p>
            License categories reserved for final legal review:{" "}
            {surface.legalReviewCategories.length > 0
              ? surface.legalReviewCategories.join(", ")
              : "None in this graph"}.
          </p>
          <ul>
            {surface.packages.map((entry) => (
              <li key={`${entry.name}@${entry.version}:${entry.license}`}>
                <code>{entry.name}@{entry.version}</code>: {entry.license}
              </li>
            ))}
          </ul>
        </details>
      ))}
      <h2>Runtime licences</h2>
      <p>
        Relay uses Hermes Agent and OpenClaw installations that the customer
        obtains, installs, authenticates, updates, and operates. Each runtime
        retains its own licence and dependency notices.
      </p>
    </PolicyPage>
  );
}
