import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const reviewedLicenseCategories = new Set([
  "0BSD",
  "Apache-2.0",
  "BlueOak-1.0.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC-BY-4.0",
  "FSL-1.1-MIT",
  "ISC",
  "LGPL-3.0-or-later",
  "MIT",
  "MPL-2.0",
  "(MIT AND BSD-3-Clause)",
  "(Apache-2.0 AND MIT)",
  "(MIT OR CC0-1.0)",
  "(MPL-2.0 OR Apache-2.0)",
  "Python-2.0",
  "Remix Icon License 1.0",
  "Unknown",
]);

export const legalReviewCategories = new Set([
  "CC-BY-4.0",
  "FSL-1.1-MIT",
  "LGPL-3.0-or-later",
  "MPL-2.0",
  "(MPL-2.0 OR Apache-2.0)",
  "Remix Icon License 1.0",
  "Unknown",
]);

export const reviewedLicenseMetadataOverrides = new Map([
  ["evernote@2.0.5", "BSD-2-Clause"],
  ["pause@0.0.1", "MIT"],
]);

const surfaceCommands = {
  backend: [
    "--dir",
    "backend",
    "licenses",
    "list",
    "--prod",
    "--json",
    "--ignore-workspace",
  ],
  web: [
    "--filter",
    "@clawchat/web",
    "licenses",
    "list",
    "--prod",
    "--json",
  ],
  landing: [
    "--dir",
    "Relay Console landing page",
    "licenses",
    "list",
    "--prod",
    "--json",
  ],
};

function packageVersionKeys(entry) {
  const name = typeof entry?.name === "string" ? entry.name : "<missing-name>";
  const versions = Array.isArray(entry?.versions) ? entry.versions : [];
  return versions.map((version) => `${name}@${version}`);
}

export function normalizeLicenseInventory(inventory) {
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory)) {
    return inventory;
  }

  const normalized = {};
  const add = (license, name, version) => {
    normalized[license] ??= [];
    let entry = normalized[license].find((candidate) => candidate.name === name);
    if (!entry) {
      entry = { name, versions: [] };
      normalized[license].push(entry);
    }
    if (!entry.versions.includes(version)) entry.versions.push(version);
  };

  for (const [license, packages] of Object.entries(inventory)) {
    if (!Array.isArray(packages)) {
      normalized[license] = packages;
      continue;
    }
    for (const entry of packages) {
      const name = typeof entry?.name === "string" ? entry.name : "<missing-name>";
      const versions = Array.isArray(entry?.versions) ? entry.versions : [];
      if (versions.length === 0) {
        normalized[license] ??= [];
        normalized[license].push(entry);
        continue;
      }
      for (const version of versions) {
        const override = license === "Unknown"
          ? reviewedLicenseMetadataOverrides.get(`${name}@${version}`)
          : null;
        add(override ?? license, name, version);
      }
    }
  }
  return normalized;
}

export function evaluateLicenseInventory(inventory) {
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory)) {
    return {
      issues: ["licence inventory is not a JSON object"],
      licenseCategoryCount: 0,
      packageEntryCount: 0,
      reviewCategoriesPresent: [],
    };
  }

  const entries = Object.entries(normalizeLicenseInventory(inventory));
  const issues = [];
  let packageEntryCount = 0;

  for (const [license, packages] of entries) {
    if (!reviewedLicenseCategories.has(license)) {
      issues.push(`unreviewed licence category: ${license}`);
    }
    if (!Array.isArray(packages)) {
      issues.push(`licence category ${license} does not contain a package list`);
      continue;
    }
    packageEntryCount += packages.length;

    if (license === "Unknown") {
      for (const entry of packages) {
        const keys = packageVersionKeys(entry);
        if (keys.length === 0) {
          issues.push("Unknown licence entry is missing an exact package version");
          continue;
        }
        for (const key of keys) issues.push(`unreviewed missing licence metadata: ${key}`);
      }
    }
  }

  if (entries.length === 0 || packageEntryCount === 0) {
    issues.push("licence inventory contains no production packages");
  }

  return {
    issues,
    licenseCategoryCount: entries.length,
    packageEntryCount,
    reviewCategoriesPresent: entries
      .map(([license]) => license)
      .filter((license) => legalReviewCategories.has(license))
      .sort(),
  };
}

export function collectLicenseInventory(surface) {
  const args = surfaceCommands[surface];
  if (!args) {
    throw new Error(
      `Unknown surface ${surface}; expected ${Object.keys(surfaceCommands).join(", ")}`,
    );
  }

  const result = spawnSync("pnpm", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `${surface} licence inventory command failed: ${result.stderr || result.stdout}`,
    );
  }

  let inventory;
  try {
    inventory = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${surface} licence inventory was not valid JSON: ${error}`);
  }

  return inventory;
}

export function runLicenseGate(surface) {
  const result = evaluateLicenseInventory(collectLicenseInventory(surface));
  if (result.issues.length > 0) {
    throw new Error(
      `${surface} production licence inventory failed:\n- ${result.issues.join("\n- ")}`,
    );
  }

  const legalReview = result.reviewCategoriesPresent.length
    ? result.reviewCategoriesPresent.join(", ")
    : "none";
  console.log(
    `${surface}: ${result.packageEntryCount} package entries across ${result.licenseCategoryCount} reviewed licence categories; final legal review categories: ${legalReview}`,
  );
}

function main() {
  const surface = process.argv[2];
  if (!surface) {
    throw new Error("Pass one surface: backend, web, or landing");
  }
  runLicenseGate(surface);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
