# Visual Fixture Manifest - Runtime Activity Panel Snapshot

id: `fix-visual-chat-runtime-activity-panel-snapshot-001`

layer: `visual`

productArea: `chat-runtime`

requirementIds: `HRE-002-004`, `RCSPR-0069`, `RCSPR-0070`

sourceMapIds: `HRE-RUNTIME-ACTIVITY-UI`

featureIds: `HRE-002`, `HRE-004`, `HRE-006`

gapOrDecisionIds: `HRE-002-004`

fixtureKind: `runtime-activity-snapshot-evidence`

owner: `runtime-ui`

status: `verified`

secretsPolicy: `no-secrets`

artifactClass: `offscreen-app-window-snapshot`

branch: `codex/hermes-runtime-experience`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-26T00:00:00Z`

reviewer: `Codex`

reviewerRole: `visual evidence`

sourceBaseline: `AppVisualSnapshotHarness.swift`, `Views.swift`, `RuntimeActivityProjector.swift`

files:

- `visual/chat/runtime-activity-panel-snapshot-001/manifest.md`
- `../RelayConsoleAppVisualSnapshotHarness/AppVisualSnapshotHarness.swift`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`
- `agent-loop-hermes-runtime-experience/loop-runs/002-runtime-confirmation-visual-hardening/evidence/HRE-002-004-runtime-activity-snapshot/runtime-activity-visual-snapshots.json`
- `agent-loop-hermes-runtime-experience/loop-runs/002-runtime-confirmation-visual-hardening/evidence/HRE-002-004-runtime-accessibility-metadata.json`
- `agent-loop-hermes-runtime-experience/loop-runs/002-runtime-confirmation-visual-hardening/evidence/HRE-002-004-runtime-activity-snapshot/runtime-activity-standard-window.png`
- `agent-loop-hermes-runtime-experience/loop-runs/002-runtime-confirmation-visual-hardening/evidence/HRE-002-004-runtime-activity-snapshot/runtime-activity-minimum-window.png`

expectedChecks:

- `swift run RelayConsoleAppVisualSnapshotHarness --runtime-activity-scenario`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0008`, `HRE-002-004`

validationCommandIds: `HRE-VC-002-004`

demoIds: `Demo 8`

branchPacket:
`agent-loop-hermes-runtime-experience/loop-runs/002-runtime-confirmation-visual-hardening/reports/HRE-002-004-runtime-activity-visual-evidence.md`

reportIds:
`agent-loop-hermes-runtime-experience/loop-runs/002-runtime-confirmation-visual-hardening/reports/HRE-002-004-runtime-activity-visual-evidence.md`

surface: `Chat runtime activity panel with pending Run confirmation`

stateKind: `seeded-temporary-ui-state`

reasonCode: `runtime-activity-panel-snapshot`

decisionIds: `Do Not Adopt Hermes Backend Approval Model`

missingPrerequisites: `Manual keyboard traversal, VoiceOver review, contrast measurement, real runtime transcript proof, and human visual signoff remain outside this automated snapshot.`

currentState: `The runtime activity snapshot harness seeds a temporary no-private-state chat with a pending Hermes runtime confirmation, structured task-list/status/thinking/tool rows, and Relay-owned Run and Reject controls, then captures standard and minimum app-window PNGs.`

notParityStatement: `This fixture is not real runtime transcript proof, not Hermes backend approval proof, not manual accessibility proof, and not release readiness.`

activationRequirement: `Any final Demo 8 visual claim must cite the generated metadata and retain the non-proof residuals unless manual review is completed.`

releaseImpact: `Provides automated branch-local visual evidence for the Hermes-style runtime panel while keeping manual and real-runtime proof residuals explicit.`

determinism: `The harness uses a temporary local database, fixed redacted prompt text, fixed runtime activity events, and standard/minimum window sizes.`

noFakeProductSeed: `The seed is isolated to a temporary harness data directory used only by the snapshot command and does not write product-visible user state.`

noSimulatedRuntimeOutput: `The seeded activity is UI-state evidence only; it is not claimed as real runtime transcript output or a real tool execution.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Default Application Support data, credentials, account values, private paths, live runtime logs, auth/session data, and user prompts are excluded.`

redactionReview: `Snapshot metadata and seeded strings contain no secrets; the harness uses MemorySecretStore and a temporary user data path.`

failureHandling: `If the snapshot command stops producing captured standard/minimum runtime activity PNGs or loses Run/Reject/task-list visibility, HRE-002-004 evidence must be downgraded to source-only residual evidence.`
