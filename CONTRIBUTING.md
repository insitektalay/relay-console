# Contributing to Relay Console

Relay Console welcomes focused fixes, documentation improvements, tests, and
self-hosting improvements. Read `PUBLIC_RELEASE_SCOPE.md` before changing the
repository structure.

## Product directories

- `RelayConsoleSwift/`: macOS application.
- `ios/`: iPhone and iPad application.
- `web/`: browser application.
- `backend/`: Railway API and websocket service.
- `packages/`: shared contracts, web SDK, and Marketplace catalog.
- `claude-runtime/` and `hermes-runtime/`: user-operated runtimes.

The root `ClawChat/`, root `ClawChat.xcodeproj/`, and `relay-console/`
directories are superseded applications. Do not add product behavior to them.

## Prerequisites

- Node.js 20 or newer and pnpm 10.
- Python 3.11 or newer for Hermes work.
- Xcode 16 or newer for macOS, iPhone, and iPad work.

Install JavaScript dependencies from the repository root:

```bash
pnpm install --frozen-lockfile
```

## Make a change

1. Create a branch from the current default branch.
2. Keep the change within one feature, fix, or documentation topic.
3. Add or update the smallest test that proves the behavior.
4. Run checks for the affected surface.
5. Describe the behavior, validation, and remaining manual test work in the
   pull request.

Do not commit secrets, environment files, signing material, pairing codes,
private conversations, customer data, or local runtime state. Use obvious
placeholders in examples.

## Validation

Choose the smallest command that covers your change. Common checks include:

```bash
pnpm --dir backend build
pnpm --dir web typecheck
pnpm --dir claude-runtime test
swift build --package-path RelayConsoleSwift
```

Compile iOS changes without installing or launching the app:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild \
  -project ios/ClawChat.xcodeproj \
  -scheme ClawChat \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Run focused tests for the code you changed. A pull request does not need the
full repository suite unless it changes shared contracts or release tooling.

## Railway boundary

The Railway backend remains the source of truth for browser and mobile data.
Keep browser API traffic on `/api/v1` and configure its Railway rewrite with
`CLAWCHAT_RAILWAY_ORIGIN`. Configure websocket traffic with
`NEXT_PUBLIC_RAILWAY_WS_BASE_URL`.

Contributors must not deploy to a maintainer-owned Railway project. A maintainer
will handle any shared deployment after review. State whether a backend change
requires migrations or a Railway deployment in the pull request.

## Security reports

Follow `SECURITY.md`. Do not place vulnerability details in a public issue or
pull request.
