# OpenClaw ClawChat Extension Install Prompt

Use this prompt with an AI coder working inside a fresh OpenClaw repo/install on
a new machine.

This is a manual preview path. Read
`docs/openclaw-bridge-beta-preview.md` first, then replace every placeholder
below with the values from the tester's ClawChat workspace and Railway backend.

```text
You are in a fresh OpenClaw repo/install. Install and configure the ClawChat OpenClaw channel extension end to end.

Extension repo:
https://github.com/insitektalay/openclaw-clawchat-extension-backup

Use these ClawChat backend details. Do not switch to a local backend:
- ClawChat Railway origin: https://<your-railway-backend>
- ClawChat API base path: /api/v1
- ClawChat websocket origin is derived from the Railway origin: wss://<your-railway-backend>
- Workspace ID: <WORKSPACE_ID>
- One-time pairing code: <ONE_TIME_PAIRING_CODE_FROM_CLAWCHAT>

Important terminology:
This is the ClawChat OpenClaw channel extension/plugin. It runs a bridge client/gateway inside OpenClaw and connects OpenClaw agents to ClawChat via Railway.

Tasks:

1. Inspect the OpenClaw plugin docs/CLI in this repo before changing anything. Use the repo's supported plugin install flow, usually:
   openclaw plugins install <local-extension-path>
   openclaw plugins enable clawchat
   openclaw plugins inspect clawchat --json
   openclaw plugins doctor

2. Clone the extension repo into a sensible location, preferably:
   extensions/clawchat
   If that path already exists, compare it with the GitHub backup and replace/update it only if the backup is newer or more complete.

3. Install dependencies for the extension if needed. The extension package is `@openclaw/clawchat` and has an `openclaw.plugin.json`, `package.json`, `index.ts`, and source files under `src/`.

4. Install and enable the extension in OpenClaw. Verify OpenClaw can discover it as plugin id `clawchat` and channel id `clawchat`.

5. Pair this new OpenClaw machine with ClawChat. Do not use localhost or a local backend for ClawChat API or websocket traffic. Use only the Railway origin above.
   The ClawChat bridge enrollment flow is:
   - A ClawChat admin creates a one-time bridge enrollment code for workspace `<WORKSPACE_ID>`.
   - Redeem it against:
     POST https://<your-railway-backend>/api/v1/bridge/enroll
   - Request body:
     {
       "code": "<ONE_TIME_PAIRING_CODE>",
       "deviceLabel": "OpenClaw <hostname>",
       "pluginVersion": "2026.3.21",
       "openCoreVersion": "v2026.6.11",
       "runtimeType": "openclaw",
       "hostType": "macos-launchd",
       "apiContractVersion": "v2",
       "websocketContractVersion": "bridge.v1",
       "capabilities": [
         "clawchat.bridge.rotating_credentials.v1",
         "claude.cli.structured_prompt",
         "clawchat.attachments.local_media"
       ]
     }
   - Save the returned `credentials.devicePublicId` and `credentials.deviceToken` into the OpenClaw config. These are new-machine credentials.
   - On every later `/bridge/device/auth` response, atomically replace the
     configured device token with the returned `credentials.deviceToken`
     before using `tokens.accessToken` or `tokens.wsToken`. Never retry a
     consumed token: replay revokes the device.
   - Use the 15-minute access token only for HTTP and the 5-minute websocket
     token only for websocket authentication; refresh before expiry.

6. Configure `channels.clawchat` in OpenClaw config with this shape:
   {
     "channels": {
       "clawchat": {
         "enabled": true,
         "apiUrl": "https://<your-railway-backend>",
         "apiPrefix": "/api/v1",
         "workspaceId": "<WORKSPACE_ID>",
         "devicePublicId": "<NEW_DEVICE_PUBLIC_ID_FROM_ENROLLMENT>",
         "deviceToken": "<NEW_DEVICE_TOKEN_FROM_ENROLLMENT>",
         "structuredPromptCommand": "codex exec --sandbox workspace-write --ask-for-approval on-request",
         "repoMappings": []
       }
     }
   }

   Do not use `--sandbox danger-full-access`, `--ask-for-approval never`, or
   Claude `--dangerously-skip-permissions` as beta defaults. If this specific
   private runtime needs unattended bypass mode, stop and record explicit owner
   risk acceptance for that machine before configuring those flags.

   Preserve any existing OpenClaw config fields. Do not wipe provider, model, agent, session, or plugin config.

7. If this OpenClaw install has local project repos that should be reachable from ClawChat structured-prompt actions, add repo mappings like:
   "repoMappings": [
     { "repoKey": "clawchat", "repoPath": "/absolute/path/to/ClawChat" }
   ]
   Only add mappings for paths that actually exist on this machine.

8. Restart the OpenClaw gateway/service using the repo's normal command for this install. Then verify:
   - `openclaw plugins list` shows `clawchat`
   - `openclaw plugins inspect clawchat --json` has no load errors
   - the gateway logs show ClawChat websocket authentication succeeded
   - the gateway subscribes to workspace `<WORKSPACE_ID>`
   - it registers configured OpenClaw agent IDs as bridge agents
   - ClawChat shows the OpenClaw bridge device online

9. If auth fails, debug Railway bridge credentials, enrollment, workspace ID, websocket auth, and plugin config. Do not switch to any local backend or localhost URL.

10. Final output should include:
   - where the extension was installed
   - what OpenClaw config file was updated
   - whether a new bridge device was paired
   - verification commands run and their results
   - any remaining manual step, but only if unavoidable
```

The unavoidable credential boundary is the one-time pairing code or an authenticated ClawChat admin session that can create it. A brand-new machine should get new bridge credentials; do not copy device credentials from an old OpenClaw machine.
