import assert from "node:assert/strict"
import test from "node:test"
import {
  artifactPresentationCopy,
  type ArtifactPresentationState,
} from "../lib/artifacts"

const states: Array<[ArtifactPresentationState, string, string]> = [
  ["available", "Available", "Stored on Test Mac"],
  ["unavailable", "Unavailable", "Artifact unavailable"],
  ["moved", "Moved", "Artifact moved"],
  ["expired", "Expired", "Artifact expired"],
  ["deleted", "Deleted", "Artifact deleted"],
  ["permission_denied", "Permission denied", "Permission denied"],
]

for (const [state, label, title] of states) {
  test(`artifact state ${state} has explicit presentation copy`, () => {
    assert.deepEqual(
      {
        label: artifactPresentationCopy(state, "Test Mac").label,
        title: artifactPresentationCopy(state, "Test Mac").title,
      },
      { label, title }
    )
  })
}

test("server reason overrides only the artifact state body", () => {
  assert.deepEqual(
    artifactPresentationCopy(
      "expired",
      "Test Mac",
      "The provider retired this link."
    ),
    {
      label: "Expired",
      title: "Artifact expired",
      body: "The provider retired this link.",
    }
  )
})
