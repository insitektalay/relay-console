# Manual Evidence Manifest - Demo 5 Runtime Applications Safety Overlap

id: `fix-manual-applications-demo-05-runtime-applications-safety-overlap-001`

layer: `manual-evidence`

productArea: `runtime-applications-slice-signoff`

requirementIds: `RCSPR-0005`, `RCSPR-0006`, `RCSPR-0095`,
`RCSPR-0109`, `RCSPR-0124`, `RCSPR-0126`, `RCSPR-0135`,
`RCSPR-0175`, `RCSPR-0176`, `RCSPR-0177`, `RCSPR-0178`,
`RCSPR-0179`, `RCSPR-0180`, `RCSPR-0181`, `RCSPR-0182`,
`RCSPR-0183`, `ITC-0008`, `ITC-0037`

sourceMapIds: `SM-0055`, `SM-0056`, `SM-0057`, `SM-0058`,
`SM-0059`, `SM-0060`, `SM-0138`, `SM-0139`, `SM-0153`,
`SM-0154`, `SM-0155`, `SM-0159`

featureIds: `FI-0041`, `FI-0042`, `FI-0043`, `FI-0044`,
`FI-0045`, `FI-0046`, `FI-0047`, `FI-0048`, `FI-0049`,
`FI-0050`, `FI-0051`, `FI-0052`, `FI-0053`, `FI-0054`,
`FI-0055`, `FI-0056`, `FI-0102`, `FI-0138`, `FI-0139`,
`FI-0165`, `FI-0166`, `FI-0167`, `FI-0168`, `FI-0169`,
`FI-0170`, `FI-0171`, `FI-0172`, `FI-0173`

gapOrDecisionIds: `ITC-0035-excluded`, `ITC-0038`, `ITC-0039`,
`ITC-0040`, `ITC-0041`, `ITC-0042`, `ITC-0043`, `ITC-0045`,
`ITC-0046`, `PAPERCLIP-EXCLUDED-001`

fixtureKind: `manual-review-placeholder`

owner: `QA evidence`

status: `planned`

secretsPolicy: `redacted`

artifactClass: `manual-evidence`

branch: `codex/itc-0029-0037-runtime-applications`

commit: `pending`

appVersion: `0.1.0`

capturedAt: `2026-06-23T00:00:00Z`

reviewer: `Codex`

reviewerRole: `QA evidence`

sourceBaseline: `RuntimeActionService.swift`, `MarketplaceInstallService.swift`,
`ToolRequestService.swift`, `implementation-task-cards.md`,
`itc-0037-runtime-applications-visual-accessibility-evidence-packet-dry-run.md`

files:

- `manual-evidence/applications/demo-05-runtime-applications-safety-overlap-001/manifest.md`
- `../RelayConsoleVisualEvidenceTests/VisualEvidenceTests.swift`

expectedChecks:

- `VC-0108`
- `swift run RelayConsoleVisualEvidenceTests`

implementationTaskIds: `ITC-0030`, `ITC-0034`, `ITC-0036`,
`ITC-0037`, `CODE-001-037`

validationCommandIds: `VC-0108`, `ITC-0008`

demoIds: `Demo 5`, `Demo 4`, `Demo 7`, `Demo 8`

branchPacket:
`evidence/branches/codex-itc-0029-0037-runtime-applications/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-037-itc-0037-runtime-applications-evidence-packet.md`

surface: `Demo 5 safety and approval overlap for runtime and Applications rows`

stateKind: `pending`

reasonCode: `manual-demo-05-overlap-pending`

decisionIds: `Demo 4 is primary for ITC-0037 runtime/Applications acceptance; Demo 5 is recorded as safety/tool overlap.`

disposition: `partial`

evidenceType: `manual-demo-review`

missingPrerequisites: `Manual reviewer notes are required before consuming task-card Demo 5 wording as anything beyond safety, approval, tool grant, command execution, and controlled-write overlap.`

currentState: `Automated source-backed evidence keeps unsafe writes, command execution, file access, automatic grants, and provider install writes unavailable until later safety cards. Demo 5 manual observations are not yet claimed.`

notParityStatement: `This planned manifest is not completed Demo 5 proof, approval proof, tool grant proof, controlled write proof, file access proof, local app/source-host/generated-pack parity, Paperclip proof, or release readiness.`

activationRequirement: `Reviewer must update status and attach redacted overlap notes before this manifest can be cited as completed Demo 5 evidence.`

releaseImpact: `Keeps the Demo 4 versus Demo 5 wording mismatch visible for downstream safety and release aggregation.`

determinism: `The placeholder uses fixed ids and contains no environment-specific values.`

noFakeProductSeed: `No product-visible runtime, provider, install, tool, local app, generated pack, or Paperclip rows are seeded.`

noSimulatedRuntimeOutput: `No runtime output, provider callback, install result, command output, approval result, or generated pack content is included or simulated.`

noGeneratedWelcome: `No generated welcome content is included.`

privateStateExclusions: `Private paths, account values, credentials, provider tokens, screenshots, prompts, runtime logs, auth/session data, source-host data, and local filesystem roots are excluded until reviewed evidence is captured.`

redactionReview: `Placeholder text contains no secrets; future manual observations must be redacted before status changes.`

failureHandling: `If this planned manifest is cited as verified safety or controlled-write proof, ITC-0037 closeout must be downgraded to partial-proof or no-go.`
