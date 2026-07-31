# User-managed runtime migration

Relay Console no longer installs, authenticates, starts, stops, updates, rolls
back, or uninstalls Hermes Agent or OpenClaw. Existing users may keep a runtime
installed by an earlier Relay Console release temporarily, connect a separate
runtime they installed themselves, or explicitly remove the old managed source.

## What the removal action deletes

The in-app **Remove Old Relay-Managed Runtime** action deletes exactly one source
directory inside Relay Console's Application Support folder:

- `harnesses/hermes-agent`, for the old Hermes Agent installation; or
- `harnesses/openclaw`, for the old OpenClaw installation.

The action fails closed if the recorded source path is anywhere else. Relay
Console never follows that migration action into a path selected by the user.

## What the removal action retains

The action retains:

- the Relay Console SQLite database, conversations, messages, and settings;
- existing harness identity and agent bindings;
- Relay Console workspaces and artifacts;
- runtime-created state under `hermes-home` or `openclaw-home`;
- credentials, Keychain records, and cloud connection state; and
- any independently installed Hermes Agent or OpenClaw files.

Retaining runtime-created state allows recovery and deliberate export, but it
does not make Relay Console the owner or updater of that state. Users may remove
retained state separately after confirming that they no longer need it.

## Continuing after migration

Install and authenticate Hermes Agent or OpenClaw using its official
documentation. Then choose **Connect Existing** in Relay Console and select the
installation. Relay Console records a security-scoped bookmark and performs
read-only version, authentication-state, and health checks; it does not modify
the selected installation.

Relay Cloud users install the separately released Relay bridge beside their
runtime when they want web, iPhone, or iPad dispatch. Removing a legacy runtime
source does not revoke a bridge device; device revocation is a separate Relay
Cloud security action.

Railway never falls back to finding or changing a runtime on its own host.
Agent creation that needs runtime-side files or configuration is sent only to
an authenticated Relay bridge beside the user's running installation. Relay
Cloud exposes no Hermes/OpenClaw update or rollback API; users perform those
actions using the runtime's own documented process. This does not prevent Relay
from publishing installation, update, rollback, and uninstall instructions for
the separately released Relay bridge itself.
