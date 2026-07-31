# Manual Evidence Manifest - Source Hygiene Default State Cleanup

id: `fix-manual-source-hygiene-default-state-cleanup-001`

layer: `manual-evidence`

productArea: `source-hygiene`

requirementIds: `RCSPR-0086`, `RCSPR-0106`, `RCSPR-0140`

sourceMapIds: `SM-0135`, `SM-0137`, `SM-0153`

featureIds: `FI-0100`, `FI-0131`

gapOrDecisionIds: `G-0040`, `G-0045`

fixtureKind: `manual-note`

owner: `QA evidence`

status: `verified`

secretsPolicy: `redacted`

artifactClass: `manual-evidence`

branch: `codex/itc-0010-source-hygiene`

commit: `working-tree`

appVersion: `0.1.0`

capturedAt: `2026-06-22T00:00:00Z`

reviewer: `Codex`

reviewerRole: `source hygiene and redaction reviewer`

sourceBaseline: `AppViewModel.swift`, `Views.swift`, `UIComponents.swift`,
`LocalDataService.swift`, `Migrations.swift`, `HarnessInstallManager.swift`,
`HarnessInstallUtilities.swift`, `RelayConsoleSourceHygieneTests`

files:

- `manual-evidence/source-hygiene/default-state-cleanup-001/manifest.md`
- `../RelayConsoleSourceHygieneTests/SourceHygieneTests.swift`

expectedChecks:

- `VC-0108`
- `swift run RelayConsoleSourceHygieneTests`
- `swift run RelayConsoleCoreSmokeTests`
- `git diff --check -- .`

implementationTaskIds: `ITC-0010`

validationCommandIds: `VC-0108`, `VC-0001`, `VC-0002`, `VC-0003`

demoIds: `Demo 0`, `Demo 1`

branchPacket:
`evidence/branches/codex-itc-0010-source-hygiene/evidence-packet.md`

reportIds:
`loop-runs/001-baseline-and-first-implementation-slice/reports/CODE-001-011-itc-0010-source-hygiene.md`

determinism: `The consuming source-hygiene test reads fixed source paths and checks stable forbidden fragment and durable-default assertions.`

noFakeProductSeed: `The manifest does not seed product-visible sample data, conversations, agents, harnesses, runtime output, or screenshots.`

noSimulatedRuntimeOutput: `The manifest contains no runtime output.`

noGeneratedWelcome: `No generated welcome content is included; the smoke executable remains the generated-welcome guard.`

privateStateExclusions: `Private names, private account values, private machine paths, raw credentials, and screenshot artifacts are excluded.`

redactionReview: `RelayConsoleSourceHygieneTests plus branch-local scoped scans verify the cleaned source paths and this manifest contain no private defaults or machine-specific path placeholders.`

failureHandling: `Any source-hygiene, smoke, build, diff-hygiene, manual manifest, or redaction failure blocks ITC-0010 closeout.`

riskInventory: `Private profile defaults were replaced by empty user-owned fields and durable profile migration; the machine-specific workspace placeholder was replaced by a safe path-class prompt; fixed Account toggles were replaced by durable profile fields; the create-agent model prefill was cleared to a user-owned field.`

replacementEvidence: `The linked source-hygiene test asserts the replacements in current source.`

notParityStatement: `This manual note proves source hygiene for scoped defaults only; it does not prove full Settings, visual, accessibility, support/legal, cloud, lifecycle, or release parity.`

activationRequirement: `Later shell/settings cards must cite this packet with current command evidence before using it as source-hygiene dependency proof.`

releaseImpact: `Source hygiene cleanup can unblock later shell/settings evidence only while SmokePreflight and scoped redaction evidence remain green.`
