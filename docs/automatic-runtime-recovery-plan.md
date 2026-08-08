# Automatic runtime and connection recovery plan

Date: 2026-08-08

Status: the automatic runtime recovery baseline was integrated in commit `9d6f3e96bf5fb98005d442f8628ae0db6f3eec1a`. This document also contains later requirements that can still need separate work. It does not claim that every item below is deployed or verified.

## Relay Host compatibility note

The Relay Host architecture builds on the integrated recovery baseline. It does not replace that recovery code. The background service reuses `CloudRuntimeDeviceTransport`, including token renewal, credential rotation, WebSocket reconnect, registration acknowledgement, registration retry, and automatic agent-link repair.

The application keeps the embedded transport as a fallback when the background service cannot start. The source contract checks the original recovery rules and the new service ownership rules in one test. See `docs/RELAY_HOST_ARCHITECTURE.md` for the stable host identity, runtime-adapter routing, rollout, and rollback design.

## 1. Purpose

Relay Console must keep agent and application access available after a normal token expiry, bridge restart, Mac restart, network interruption, or Railway deployment.

A user must not need to understand JWTs, bridge credentials, runtime bindings, execution brokers, or authority records. These are internal product details.

The normal user flow must contain only these actions:

1. Relay Console finds the installed Hermes Agent or OpenClaw runtime.
2. The user confirms that Relay Console can connect to it.
3. The user adds an application connection.
4. The user selects the agents that can use the application.

For the standard hosted product, the user must not select a Railway origin. The production build and deployment configuration must supply the Railway API and WebSocket origins. The web application must continue to use `/api/v1`, rewritten to Railway. It must use `CLAWCHAT_RAILWAY_ORIGIN` and `NEXT_PUBLIC_RAILWAY_WS_BASE_URL`.

## 2. Problem statement

The current product exposes several independent states as separate user tasks:

- Relay account authentication;
- bridge enrollment and bridge credential rotation;
- bridge WebSocket presence;
- live registration of external Hermes or OpenClaw agents;
- canonical agent-to-runtime authority;
- remote execution availability;
- Marketplace connection health;
- Marketplace assignment and tool publication.

One layer can report `Connected` or `Ready` while a later layer cannot run a tool. The user then sees internal controls such as **Refresh bridge status**, **Use this Mac**, and runtime-authority repair. The user cannot know which control is applicable.

The Jotform test showed this problem. Jotform was not necessarily the cause. Luca's request stopped at the OpenClaw bridge authorization check before normal provider execution. Hugo used a different Hermes route, so his request passed the bridge check. **Use this Mac** changed Luca's Relay execution link; it did not repair Jotform itself.

## 3. Confirmed source findings

These findings come from the source at the starting commit for this plan.

### 3.1 macOS can use an expired cached token for bridge refresh

`RelayConsoleSwift/Sources/RelayConsoleApp/CloudRelaySettingsView.swift` stores an `accessToken`. Its `loadBridgeDevices()` function sends that stored value directly to `GET bridge/workspaces/:id/devices`.

Other functions on the same screen call `CloudConnectionService.validAccessToken()` before a request. That service refreshes an access token when its recorded expiry is near. The bridge refresh path does not use this service. Thus, the server can return `jwt expired` even when a valid refresh token exists.

### 3.2 macOS removes valid visible state after a refresh failure

The same `loadBridgeDevices()` function sets `bridgeDevices = []` after any error. The UI then says that no bridge is paired. This message is false when the request failed and the previous list was valid.

### 3.3 Railway returns historical bridge records

`backend/src/modules/bridge/bridge.service.ts` loads all bridge devices for a workspace in `listBridgeDevices()`. It does not exclude revoked devices. The macOS diagnostics UI also displays all returned devices. This produces a long list of active, offline, and revoked records.

The iOS Settings screen and the web bridge pairing screen also display the device collection from the same API. This is a shared backend and cross-platform presentation problem.

### 3.4 External-agent authorization uses live bridge registration

`BridgeService.assertBridgeDeviceExternalAgentBinding()` asks the bridge events gateway if one bridge device is registered for one external agent. If this live registration is absent, Railway returns `Bridge device is not authorized for this external agent`.

This security check is correct. However, the product does not complete automatic recovery when a valid bridge reconnects and the live registration is missing or stale.

### 3.5 iOS already retries an expired account session once

`ios/ClawChat/Infrastructure/Network/APIClient.swift` refreshes tokens after one HTTP 401 response and repeats the request once. The macOS Relay Settings paths do not consistently provide the same behaviour.

## 4. Product requirements

### 4.1 One automatic recovery coordinator

Relay must have one recovery coordinator for the complete execution route. It must evaluate these stages in order:

1. user session;
2. Railway API and WebSocket reachability;
3. active bridge credential;
4. bridge presence and compatibility;
5. live external-agent registration;
6. canonical runtime binding;
7. Marketplace connection health;
8. agent assignment and published tool set;
9. one bounded provider read.

The coordinator must return one product state:

- `ready`: the complete route passed;
- `recovering`: Relay is applying a safe automatic repair;
- `temporarily_offline`: the route is valid, but a host or network is offline;
- `user_action_required`: Relay cannot repair the route without a new trust decision or credential;
- `unsupported`: the bridge or runtime must be updated.

Clients must not combine independent raw states to invent a different answer.

### 4.2 Account JWT recovery

All authenticated client requests must use one request layer.

That layer must:

1. refresh before known expiry;
2. refresh after the first 401 response;
3. serialize simultaneous refresh requests;
4. repeat the original request one time;
5. keep the last valid screen data during recovery;
6. request sign-in only when the refresh credential is absent, expired, or revoked.

It must never replace valid cached data with an empty state because authentication failed.

### 4.3 Bridge reconnect after Railway or network interruption

Each bridge must reconnect with bounded exponential backoff and jitter. After each new WebSocket session, it must send a complete registration snapshot for its runtime and external agents. Railway must acknowledge the snapshot and record a registration generation.

A Railway deployment can remove live in-memory presence. The bridge must restore that presence without a user action. A missed acknowledgement must cause another bounded registration attempt.

### 4.4 Safe automatic binding repair

Railway can repair a binding automatically only when all of these facts match:

- workspace ID;
- stable installation ID;
- runtime type;
- external agent ID;
- current, active bridge credential;
- no competing active host or identity;
- no quarantine or replay condition.

The repair must create a new assignment epoch and invalidate the old live route. It must not transfer ownership when two hosts are eligible or when identities conflict. That case must show one clear review action.

The rule must apply equally to Hermes and OpenClaw. Jotform, Exa, Craft, and all other Marketplace applications must not have separate runtime repair logic.

### 4.5 Bridge credential recovery

Relay must distinguish a normal expiry from a security revocation.

- If a short-lived bridge access token expires, the bridge must renew it with its valid rotation credential.
- If a credential is revoked because of replay, Railway must not trust that revoked credential to create a new key.
- If the bridge still has a separate valid installation recovery key, it can complete a signed recovery challenge and receive a new bridge credential.
- If no valid trust anchor remains, Relay Console must use the user's authenticated session to approve a new enrollment. The UI must show one action named **Reconnect runtime**.

This restriction prevents an attacker with a copied revoked credential from creating another valid credential.

### 4.6 Bridge list lifecycle

The normal Settings page must show one current card for each active runtime installation. It must hide revoked and replaced records.

Advanced diagnostics can show history, but it must:

- group records by stable installation ID and runtime type;
- show the current record first;
- collapse revoked and replaced records under **History**;
- retain the last valid list when refresh fails;
- show `Status could not refresh` instead of `No bridge` after a request error.

The backend list API should support an active-only default and an explicit history option. macOS, web, and iOS must use the same contract.

### 4.7 Complete application readiness

An application page must not show `Ready` only because a secret exists or a provider lists tools.

For each assigned agent, readiness must prove:

1. the Railway Marketplace connection is valid;
2. the selected policy permits the expected read or manage tools;
3. the agent has a valid runtime binding;
4. the correct live bridge has registered that external agent;
5. the runtime snapshot contains the expected wrapper tools;
6. one small, non-destructive provider read succeeds when the provider supports it.

The UI can then show `Ready for Hugo` or `Needs repair for Luca`. It must not show one global green state when agent routes differ.

### 4.8 One repair action

If automatic recovery cannot finish, the application page must show the failure at the point where the user sees it. The primary action must be **Repair connection**.

This action must run the recovery coordinator. It can request a specific user action only when necessary:

- sign in again;
- start the Mac or runtime host;
- update the bridge;
- approve a new runtime enrollment after a security revocation;
- review an identity conflict;
- reconnect an expired provider account.

The user must not need to open Advanced diagnostics for normal recovery.

## 5. Implementation plan

### Phase 1: freeze the recovery contract and add failure fixtures

Backend and shared contract work:

- define the five product states and stable error codes;
- define a route-readiness response for one agent and one application;
- add captured fixtures for expired account JWT, Railway restart, bridge reconnect, missing external-agent registration, revoked replay credential, offline host, and expired provider credential;
- add a deterministic test that proves each observed failure and the required recovery result.

Exit condition: one fast automated test can detect each failure without a manual click path.

### Phase 2: correct account-session handling and stale UI state

macOS:

- route `loadBridgeDevices()` and all other authenticated Relay requests through `validAccessToken()`;
- add one automatic 401 refresh and request replay at the transport boundary;
- do not clear `bridgeDevices` after a request error;
- distinguish `not loaded`, `loaded empty`, `loaded`, and `refresh failed`.

iOS:

- keep its current one-time 401 refresh;
- add tests that confirm bridge data remains visible after refresh failure.

Web:

- confirm that the shared SDK refreshes once and that query errors keep previous TanStack Query data;
- add the same visible-state test.

Exit condition: an expired JWT does not create a false empty bridge screen on any client.

### Phase 3: make bridge presence self-restoring

Bridge plugins and Railway:

- add a connection generation and registration snapshot acknowledgement;
- require every reconnect to resend all live external-agent registrations;
- add bounded retry when Railway does not acknowledge the snapshot;
- make registration idempotent for one device, runtime, and external agent;
- expose the last acknowledged generation and time in diagnostics;
- add a restart test that removes Railway live state, reconnects the bridge, and proves dispatch without user action.

Exit condition: a Railway deployment or temporary network loss does not require **Refresh bridge status** or **Use this Mac**.

### Phase 4: add safe runtime-binding recovery

Railway runtime authority:

- detect a valid current bridge registration that matches a stale binding;
- apply an automatic rebind only when the strict identity rules in section 4.4 pass;
- use the existing reconciliation service for safe, checksum-verified changes;
- refuse automatic transfer when more than one host is eligible;
- return one action-required state for a real conflict;
- make Hermes and OpenClaw use the same recovery contract.

Exit condition: a replaced valid bridge can resume the same agent route without manual relinking, while ambiguous ownership remains blocked.

### Phase 5: separate current bridges from history

Railway:

- make the standard device list active-only;
- add an explicit history query or endpoint;
- group replacement generations by stable installation identity;
- define retention for revoked records and audit data.

macOS, web, and iOS:

- show only current installations in normal Settings;
- place historical records in a collapsed diagnostics group;
- use the same status labels and ordering.

Exit condition: a user sees one current Hermes card and one current OpenClaw card for one Mac, not a list of old credentials.

### Phase 6: add route readiness and automatic repair to Marketplace

Railway Marketplace and runtime services:

- add a bounded readiness endpoint for one application assignment;
- check connection, policy, binding, live registration, wrapper publication, and provider read;
- run safe recovery before returning a failure;
- refresh runtime snapshots after application create, update, delete, select, or assignment changes;
- ensure read-only assignment publishes only read tools;
- record a correlation ID across all readiness stages.

macOS, web, and iOS:

- replace global `Connected` claims with per-agent route status;
- show automatic recovery progress;
- show **Repair connection** only when automatic recovery stops;
- link advanced evidence by correlation ID, without showing credentials.

Exit condition: the application page identifies whether the failure is the provider, policy, runtime, bridge, or tool snapshot. A user does not navigate through Settings to find it.

### Phase 7: simplify setup and Railway configuration

macOS:

- make the production Railway origin part of the signed release configuration;
- remove the normal backend URL field from the standard setup path;
- retain a separate administrator-only self-hosted flow when the product supports it;
- find supported local Hermes and OpenClaw installations;
- install or update the correct bridge and complete enrollment in one guided action.

Web and iOS:

- use only the workspace Railway authority established by deployment and account state;
- do not offer a second backend selection.

Exit condition: the standard hosted setup asks the user to confirm a runtime, not configure backend infrastructure.

### 5.8 Initial source map

The implementer must confirm the final call graph before each change. The first expected source areas are:

- macOS account and bridge state: `RelayConsoleSwift/Sources/RelayConsoleCore/CloudRelaySync.swift` and `RelayConsoleSwift/Sources/RelayConsoleApp/CloudRelaySettingsView.swift`;
- macOS setup: `RelayConsoleSwift/Sources/RelayConsoleApp/SetupAssistantView.swift` and `RelayConsoleSwift/Sources/RelayConsoleApp/Features/Settings/AppViewModel+SetupAssistant.swift`;
- iOS request retry and Settings state: `ios/ClawChat/Infrastructure/Network/APIClient.swift` and `ios/ClawChat/Features/Operations/SettingsView.swift`;
- web bridge queries and UI: `web/components/app-shell/relay-console-controller/phase-03-workspace-queries.tsx` and `web/components/app-shell/views/bridge-pairing-panel.tsx`;
- Railway bridge lifecycle and authorization: `backend/src/modules/bridge/bridge.service.ts`, `backend/src/modules/bridge/bridge.controller.ts`, and the bridge events gateway;
- Railway runtime repair: `backend/src/modules/runtime/runtime-reconciliation.service.ts`, `backend/src/modules/runtime/runtime-authority.service.ts`, and `backend/src/modules/runtime/runtime-provisioning-target.service.ts`;
- Railway runtime dispatch: `backend/src/modules/runtime/runtime-dispatch-coordinator.service.ts` and the Hermes and OpenClaw runtime adapters;
- Marketplace readiness: `backend/src/modules/marketplace/marketplace.service.ts` and Marketplace execution services;
- bridge reconnect logic: the supported Hermes and OpenClaw bridge plugin repositories and protocol fixtures.

Each implementation work package must include focused tests beside the changed service or client. It must not use one broad suite as proof for this recovery path.

## 6. Cross-platform work matrix

| Area | macOS | Web | iPhone and iPad | Railway and bridges |
| --- | --- | --- | --- | --- |
| Account JWT refresh | Change required | Inspect and add parity tests | Existing retry; add state-retention tests | Keep stable refresh error codes |
| Failed refresh keeps old data | Change required | Change if query data is cleared | Change if view model data is cleared | Not applicable |
| Current bridge list | Change required | Change required | Change required | Active-only API and history API |
| Reconnect registration | Display only | Display only | Display only | Main implementation in bridges and Railway |
| Safe binding repair | Show result | Show result | Show result | Main implementation in runtime authority |
| Application route readiness | Change required | Change required | Change required | Main readiness and recovery coordinator |
| Railway origin setup | Simplify hosted flow | Keep `/api/v1` Railway rewrite | No user selection | Deployment-owned configuration |

## 7. Test and acceptance plan

### 7.1 Required automated tests

- access token expires while the bridge list is visible;
- refresh succeeds and the original request repeats once;
- refresh fails and the previous bridge list stays visible;
- Railway restarts while Hermes and OpenClaw bridges remain running;
- each bridge reconnects and republishes all external agents;
- an agent with a stale live registration repairs automatically;
- a competing host does not cause an automatic ownership transfer;
- a replay-revoked credential cannot mint a new credential;
- a valid installation recovery challenge can rotate a bridge credential;
- active device list excludes revoked history;
- Jotform and another application use the same generic route readiness logic;
- read-only assignment does not publish manage tools;
- provider failure is distinct from bridge and binding failure.

### 7.2 Required live acceptance

Use one Hermes agent and one OpenClaw agent. Assign the same safe test application to both.

1. Prove a bounded provider read for both agents.
2. restart the Railway deployment;
3. do not press a recovery control;
4. wait for both bridges to reconnect;
5. prove the same provider read for both agents;
6. stop and restart each local runtime;
7. prove the same provider read again;
8. expire a test account JWT and repeat the bridge-list refresh;
9. confirm that no false empty state appears;
10. revoke a test bridge credential and confirm that automatic recovery does not bypass the security boundary.

This acceptance must run on the integrated release builds. A compile, app launch, login screen, or green provider-secret check is not sufficient.

## 8. Rollout and observability

Deliver the plan in separate bounded worker changes. Integrate and deploy them in dependency order.

Recommended order:

1. session refresh and stale-state protection;
2. bridge active/history API and client cleanup;
3. reconnect registration handshake;
4. safe binding recovery;
5. route readiness and Marketplace UI;
6. simplified hosted setup.

Railway changes require deployment from `backend/`. Bridge protocol changes require compatible Hermes and OpenClaw bridge releases before the related client behaviour becomes live.

Record these metrics without credentials or message content:

- account refresh attempts, success, and terminal reauthentication;
- bridge reconnect time;
- registration generation and acknowledgement delay;
- automatic binding repairs and refused conflicts;
- readiness failures by stage and stable error code;
- automatic recovery success rate;
- user action required rate;
- time from Railway deployment to restored agent dispatch.

Alert when a Railway deployment causes bridge registrations to remain absent beyond the reconnect limit, or when one runtime type has a higher authorization failure rate than the other.

## 9. Security rules

- Do not weaken `Bridge device is not authorized for this external agent` checks.
- Do not use agent display names to repair identity.
- Do not let a revoked or replayed credential authorize its own replacement.
- Do not move execution ownership when more than one valid host exists.
- Do not expose account, bridge, or provider credentials in logs, UI, tool results, or agent prompts.
- Do not add a local or loopback backend authority for the web application.
- Keep Railway as the source of truth for shared state and Marketplace execution.

## 10. Definition of done

This programme is complete only when all of these statements are true:

- A normal JWT expiry recovers without a user action.
- A Railway restart does not require bridge refresh or agent relinking.
- A valid bridge restart restores all external-agent registrations.
- A safe stale binding repairs automatically.
- A security revocation cannot self-authorize a new credential.
- Normal Settings shows only current runtime installations.
- Application readiness proves the complete route for each assigned agent.
- Hermes and OpenClaw have the same recovery behaviour.
- macOS, web, iPhone, and iPad show the same product state.
- The standard hosted setup does not ask the user for a Railway URL.
- Live acceptance proves application use before and after Railway and runtime restarts.
