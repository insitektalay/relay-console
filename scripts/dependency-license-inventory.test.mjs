import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDependencyInventory,
  normalizeDependencySurface,
  portablePackageName,
  surfaceDefinitions,
} from "./dependency-license-inventory.mjs";

function input(name, license = "MIT") {
  return {
    inventory: {
      [license]: [
        { name: `${name}-z`, versions: ["2.0.0", "1.0.0"], paths: ["private/path"] },
        { name: `${name}-a`, versions: ["1.0.0"] },
      ],
    },
    lockfileBytes: Buffer.from(`${name}-lockfile`),
  };
}

test("builds a deterministic, path-free inventory for all three surfaces", () => {
  const value = buildDependencyInventory({
    backend: input("backend"),
    web: input("web"),
    landing: input("landing"),
  });

  assert.equal(value.schemaVersion, "relay.third-party-dependency-inventory.v1");
  assert.deepEqual(value.surfaces.map((surface) => surface.id), ["backend", "web", "landing"]);
  for (const surface of value.surfaces) {
    assert.equal(surface.packageVersionCount, 3);
    assert.equal(surface.packages[0].name.endsWith("-a"), true);
    assert.equal(JSON.stringify(surface).includes("private/path"), false);
    assert.match(surface.lockfileSHA256, /^[a-f0-9]{64}$/);
  }
});

test("deduplicates exact package versions and retains legal-review categories", () => {
  const definition = surfaceDefinitions[0];
  const value = normalizeDependencySurface(definition, {
    "LGPL-3.0-or-later": [
      { name: "binary", versions: ["1.0.0", "1.0.0"] },
    ],
  }, Buffer.from("lock"));

  assert.equal(value.packageVersionCount, 1);
  assert.deepEqual(value.legalReviewCategories, ["LGPL-3.0-or-later"]);
  assert.deepEqual(value.packages, [{
    name: "binary",
    version: "1.0.0",
    license: "LGPL-3.0-or-later",
  }]);
});

test("publishes reviewed licenses instead of Unknown metadata", () => {
  const definition = surfaceDefinitions[0];
  const value = normalizeDependencySurface(definition, {
    Unknown: [
      { name: "evernote", versions: ["2.0.5"] },
      { name: "pause", versions: ["0.0.1"] },
    ],
  }, Buffer.from("lock"));

  assert.deepEqual(value.legalReviewCategories, []);
  assert.deepEqual(value.packages, [
    { name: "evernote", version: "2.0.5", license: "BSD-2-Clause" },
    { name: "pause", version: "0.0.1", license: "MIT" },
  ]);
});

test("normalizes host-specific optional binaries into portable package families", () => {
  assert.equal(
    portablePackageName("@next/swc-darwin-arm64"),
    "@next/swc (platform binary)",
  );
  assert.equal(
    portablePackageName("@next/swc-linux-x64-gnu"),
    "@next/swc (platform binary)",
  );
  assert.equal(
    portablePackageName("@img/sharp-libvips-linux-x64"),
    "@img/sharp-libvips (platform binary)",
  );
  assert.equal(portablePackageName("react"), "react");

  const definition = surfaceDefinitions[1];
  const darwin = normalizeDependencySurface(definition, {
    MIT: [{ name: "@next/swc-darwin-arm64", versions: ["16.2.6"] }],
  }, Buffer.from("shared-lock"));
  const linux = normalizeDependencySurface(definition, {
    MIT: [{ name: "@next/swc-linux-x64-gnu", versions: ["16.2.6"] }],
  }, Buffer.from("shared-lock"));
  assert.deepEqual(darwin, linux);
});

test("fails closed on a new license category or malformed package entry", () => {
  const definition = surfaceDefinitions[0];
  assert.throws(
    () => normalizeDependencySurface(definition, {
      "GPL-3.0-only": [{ name: "new", versions: ["1.0.0"] }],
    }, Buffer.from("lock")),
    /unreviewed licence category/,
  );
  assert.throws(
    () => normalizeDependencySurface(definition, {
      MIT: [{ name: "broken" }],
    }, Buffer.from("lock")),
    /missing a package name or versions/,
  );
});
