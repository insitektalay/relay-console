#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

import {
  collectLicenseInventory,
  evaluateLicenseInventory,
  normalizeLicenseInventory,
} from "./dependency-license-gate.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(
  repoRoot,
  "Relay Console landing page/lib/third-party-dependency-inventory.json",
);
const schemaPath = resolve(
  repoRoot,
  "RelayConsoleSwift/Release/third-party-dependency-inventory.schema.json",
);

export const surfaceDefinitions = [
  {
    id: "backend",
    label: "Relay Cloud backend",
    lockfilePath: "backend/pnpm-lock.yaml",
  },
  {
    id: "web",
    label: "Relay Console browser application",
    lockfilePath: "pnpm-lock.yaml",
  },
  {
    id: "landing",
    label: "Relay Console public website",
    lockfilePath: "Relay Console landing page/pnpm-lock.yaml",
  },
];

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function packageSort(left, right) {
  return left.name.localeCompare(right.name)
    || left.version.localeCompare(right.version)
    || left.license.localeCompare(right.license);
}

// pnpm reports only the native optional package for the host running
// `licenses list`. Publish the package family instead of a host-specific
// Darwin/Linux/Windows binary so the lockfile-bound notice is reproducible in
// development and CI while retaining the exact version and licence.
export function portablePackageName(name) {
  const families = [
    [/^@img\/sharp-libvips-.+$/, "@img/sharp-libvips (platform binary)"],
    [/^@img\/sharp-.+$/, "@img/sharp (platform binary)"],
    [/^@next\/swc-.+$/, "@next/swc (platform binary)"],
    [/^@tailwindcss\/oxide-.+$/, "@tailwindcss/oxide (platform binary)"],
    [/^lightningcss-.+$/, "lightningcss (platform binary)"],
    [/^@msgpackr-extract\/msgpackr-extract-.+$/, "@msgpackr-extract/msgpackr-extract (platform binary)"],
    [/^@unrs\/resolver-binding-.+$/, "@unrs/resolver-binding (platform binary)"],
    [/^@rollup\/rollup-.+$/, "@rollup/rollup (platform binary)"],
    [/^@esbuild\/.+$/, "@esbuild (platform binary)"],
  ];
  return families.find(([pattern]) => pattern.test(name))?.[1] ?? name;
}

export function normalizeDependencySurface(definition, inventory, lockfileBytes) {
  const normalizedInventory = normalizeLicenseInventory(inventory);
  const evaluated = evaluateLicenseInventory(normalizedInventory);
  if (evaluated.issues.length > 0) {
    throw new Error(
      `${definition.id} licence inventory failed:\n- ${evaluated.issues.join("\n- ")}`,
    );
  }

  const uniquePackages = new Map();
  for (const [license, entries] of Object.entries(normalizedInventory)) {
    for (const entry of entries) {
      if (typeof entry?.name !== "string" || !Array.isArray(entry.versions)) {
        throw new Error(`${definition.id} licence entry is missing a package name or versions.`);
      }
      for (const version of entry.versions) {
        if (typeof version !== "string" || !version) {
          throw new Error(`${definition.id} licence entry contains an invalid package version.`);
        }
        const value = { name: portablePackageName(entry.name), version, license };
        uniquePackages.set(`${entry.name}\u0000${version}\u0000${license}`, value);
      }
    }
  }
  const packages = [...uniquePackages.values()].sort(packageSort);

  return {
    id: definition.id,
    label: definition.label,
    lockfilePath: definition.lockfilePath,
    lockfileSHA256: hash(lockfileBytes),
    packageVersionCount: packages.length,
    legalReviewCategories: evaluated.reviewCategoriesPresent,
    packages,
  };
}

export function buildDependencyInventory(inputs) {
  return {
    schemaVersion: "relay.third-party-dependency-inventory.v1",
    surfaces: surfaceDefinitions.map((definition) => {
      const input = inputs[definition.id];
      if (!input) throw new Error(`Missing ${definition.id} dependency inventory input.`);
      return normalizeDependencySurface(definition, input.inventory, input.lockfileBytes);
    }),
  };
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function validateSchema(value) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(JSON.parse(readFileSync(schemaPath, "utf8")));
  if (!validate(value)) {
    const details = (validate.errors ?? [])
      .map((error) => `${error.instancePath || "/"} ${error.message}`)
      .join("; ");
    throw new Error(`Dependency notice inventory failed schema validation: ${details}`);
  }
  for (const surface of value.surfaces) {
    if (surface.packageVersionCount !== surface.packages.length) {
      throw new Error(`${surface.id} packageVersionCount differs from its package list.`);
    }
  }
  if (new Set(value.surfaces.map((surface) => surface.id)).size !== surfaceDefinitions.length) {
    throw new Error("Dependency notice inventory contains duplicate surfaces.");
  }
}

function collectSurface(definition) {
  return {
    inventory: collectLicenseInventory(definition.id),
    lockfileBytes: readFileSync(resolve(repoRoot, definition.lockfilePath)),
  };
}

function currentInventory() {
  return buildDependencyInventory(Object.fromEntries(
    surfaceDefinitions.map((definition) => [definition.id, collectSurface(definition)]),
  ));
}

function checkSurface(surfaceId) {
  const definition = surfaceDefinitions.find((candidate) => candidate.id === surfaceId);
  if (!definition) throw new Error(`Unknown dependency inventory surface: ${surfaceId}`);
  const saved = JSON.parse(readFileSync(outputPath, "utf8"));
  validateSchema(saved);
  const expected = normalizeDependencySurface(
    definition,
    collectLicenseInventory(definition.id),
    readFileSync(resolve(repoRoot, definition.lockfilePath)),
  );
  const actual = saved.surfaces.find((surface) => surface.id === surfaceId);
  if (serialize(actual) !== serialize(expected)) {
    throw new Error(
      `${surfaceId} public dependency inventory is stale; run pnpm dependency:licenses:inventory:sync.`,
    );
  }
  console.log(`${surfaceId}: public dependency inventory matches ${expected.packageVersionCount} locked package versions.`);
}

function main() {
  const [mode = "--check", surfaceId] = process.argv.slice(2);
  if (mode === "--check-surface") {
    if (!surfaceId) throw new Error("--check-surface needs backend, web, or landing.");
    checkSurface(surfaceId);
    return;
  }

  const inventory = currentInventory();
  validateSchema(inventory);
  const content = serialize(inventory);
  if (mode === "--write") {
    writeFileSync(outputPath, content);
    console.log(`Wrote ${outputPath}`);
    return;
  }
  if (mode !== "--check") throw new Error(`Unexpected mode: ${mode}`);
  if (readFileSync(outputPath, "utf8") !== content) {
    throw new Error("Public dependency inventory is stale; run pnpm dependency:licenses:inventory:sync.");
  }
  console.log("Public dependency inventory matches all locked production graphs.");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
