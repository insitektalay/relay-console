const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isExternalArtifactPointerFileName,
  normalizeExternalArtifactUrl,
} = require("../dist/artifact-security.js");

test("external artifact URLs are canonical HTTPS without user-info", () => {
  assert.equal(
    normalizeExternalArtifactUrl(
      "HTTPS://Docs.Example.test:443/brief?q=1#section",
    ),
    "https://docs.example.test/brief?q=1#section",
  );

  for (const value of [
    "http://docs.example.test/brief",
    "//docs.example.test/brief",
    "https:docs.example.test/brief",
    " https://docs.example.test/brief",
    "https://user:secret@docs.example.test/brief",
    "https://docs.example.test\\@attacker.test/brief",
    "https://docs.example.test/\nattacker",
    "javascript:alert(1)",
  ]) {
    assert.equal(normalizeExternalArtifactUrl(value), null);
  }
});

test("the catalogue recognizes the canonical and historical pointer suffixes", () => {
  assert.equal(
    isExternalArtifactPointerFileName("brief.artifact.json"),
    true,
  );
  assert.equal(
    isExternalArtifactPointerFileName("brief.relay-artifact.json"),
    true,
  );
  assert.equal(isExternalArtifactPointerFileName("brief.json"), false);
});
