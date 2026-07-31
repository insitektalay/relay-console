import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const threadPaneSource = readFileSync(
  new URL("../components/threads/thread-detail-pane.tsx", import.meta.url),
  "utf8"
)
const appSource = relayAppSource
const sdkSource = readFileSync(
  new URL("../../packages/web-sdk/src/index.ts", import.meta.url),
  "utf8"
)
const realtimeSource = readFileSync(
  new URL("../hooks/use-clawchat-realtime.ts", import.meta.url),
  "utf8"
)

test("runtime dispatch controls stay tied to safe runtime state", () => {
  assert.match(
    threadPaneSource,
    /runtimeParticipantHealth\?: RuntimeParticipantHealthUiState\[\]/
  )
  assert.match(
    threadPaneSource,
    /onCancelRuntimeDispatch\?: \(dispatch: RuntimeDispatchUiState\) => void/
  )
  assert.match(
    threadPaneSource,
    /onRetryRuntimeDispatch\?: \(dispatch: RuntimeDispatchUiState\) => void/
  )
  assert.match(threadPaneSource, /dispatch\.retryable === true/)
  assert.match(threadPaneSource, /Boolean\(dispatch\.messageId\)/)
  assert.match(threadPaneSource, /onCancelRuntimeDispatch\(dispatch\)/)
  assert.match(threadPaneSource, /onRetryRuntimeDispatch\?\.\(dispatch\)/)
})

test("runtime cancel and retry are wired through authorized app flows", () => {
  assert.match(sdkSource, /runtimeDispatches = \{/)
  assert.match(sdkSource, /\/dispatches\/\$\{dispatchId\}\/cancel/)
  assert.match(appSource, /sdk\.runtimeDispatches\.cancel\(dispatchId\)/)
  assert.match(appSource, /message\.id === dispatch\.messageId/)
  assert.match(appSource, /message\.isFromUser/)
  assert.match(appSource, /sendMessageMutation\.mutate\(\{/)
  assert.match(realtimeSource, /messageId\?: string \| null/)
  assert.match(
    realtimeSource,
    /messageId: payload\.messageId \?\? existing\?\.messageId \?\? null/
  )
})

test("composer exposes a multi-PNG SeeDance asset workflow", () => {
  assert.match(threadPaneSource, /SEEDANCE_PNG_ASSET_INSTRUCTION/)
  assert.match(threadPaneSource, /Use all attached PNG assets/)
  assert.match(
    threadPaneSource,
    /type="file"[\s\S]*multiple[\s\S]*accept="\.png,image\/png"/
  )
  assert.match(
    threadPaneSource,
    /aria-label="Attach PNG assets for SeeDance 2"/
  )
  assert.match(threadPaneSource, /handleSeedancePngAssetFileChange/)
  assert.match(threadPaneSource, /await uploadAttachmentFiles\(pngFiles\)/)
})

test("runtime replay hydrates persisted stream drafts", () => {
  assert.match(realtimeSource, /payload\.draftSeq/)
  assert.match(realtimeSource, /payload\.draftText/)
  assert.match(realtimeSource, /mergeRuntimeReplayDraftText/)
  assert.match(realtimeSource, /status: draftText \? "streaming" : "started"/)
})

test("runtime message sync uses one jittered polling path", () => {
  assert.match(realtimeSource, /hasSelectedThreadActiveRuntimeDispatches/)
  assert.match(realtimeSource, /scheduleNextRefresh/)
  assert.match(realtimeSource, /backoffMultiplier/)
  assert.match(realtimeSource, /Math\.random\(\) \* 1000/)
  assert.doesNotMatch(
    realtimeSource,
    /setInterval\(refreshLatestMessages, 5000\)/
  )
  assert.doesNotMatch(
    realtimeSource,
    /setInterval\(refreshSelectedThreadMessages, 7000\)/
  )
})
