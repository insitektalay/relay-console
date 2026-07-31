id: settings-navigation-preferences-001
layer: services
productArea: settings
requirementIds: ITC-0047
sourceMapIds: VC-0102, CODE-001-046, Demo 6, Demo 7
fixtureKind: service-contract
owner: Relay Console Swift
status: active
secretsPolicy: `Settings panel preference records must not persist private profile values, credentials, local paths, cloud session tokens, or account lifecycle payloads.`
files: `Sources/RelayConsoleApp/AppViewModel.swift`, `Sources/RelayConsoleApp/Views.swift`, `Sources/RelayConsoleCore/LocalDataService.swift`, `Tests/RelayConsoleProfileSettingsTests/ProfileSettingsTests.swift`
expectedChecks: `RelayConsoleProfileSettingsTests verifies selected Settings panel persistence for account, appearance, workspace, team, integrations, notifications, security, and harnesses; it also rejects standalone_approvals as unsupported retained Settings navigation state.`
determinism: `The test uses isolated temporary stores, fixed panel raw values, and relaunch reads from the local settings store.`
noFakeProductSeed: `No product-visible chats, agents, harnesses, notifications, cloud sessions, or account lifecycle rows are seeded.`
noSimulatedRuntimeOutput: `No runtime transcript output, notification delivery output, support/legal action output, or cloud account lifecycle output is generated.`
noGeneratedWelcome: `No generated welcome messages are inserted.`
privateStateExclusions: `Cloud account linking, browser-session authority, email/mobile delivery controls, support/legal/status actions, destructive local lifecycle actions, standalone Approvals, Paperclip settings, and Mission Control host-control remain excluded or unavailable.`
redactionReview: `The fixture persists panel keys only; profile, workspace, credential, and session values remain outside this fixture.`
failureHandling: `If a retained panel key fails to persist across relaunch, or standalone_approvals is accepted, ITC-0047 service evidence fails.`
