# Relay Console domain glossary

This glossary defines the stable product terms used in the architecture report.
It does not describe implementation details.

| Term | Meaning |
| --- | --- |
| Account | The person or organisation identity that signs in to Relay Console. |
| Workspace | The shared Relay area that contains agents, chats, settings, and integrations. |
| Client | A user interface: macOS, web, or iPhone/iPad. |
| Runtime host | A computer or VPS that runs agent software for a workspace. |
| Harness | Agent software such as Hermes Agent or OpenClaw. |
| Bridge device | The enrolled Relay connection from a runtime host to Railway. |
| Runtime binding | The record that maps one Relay agent to one runtime type, host, and native agent identity. |
| Native agent | The Hermes profile or OpenClaw agent that exists on a runtime host. |
| Marketplace application | A provider definition that describes an external service or a supported local application. |
| Marketplace connection | A workspace's authenticated connection to a Marketplace application. |
| Marketplace install | The workspace and agent assignment that makes a connected application available to an agent. |
| Control plane | Railway's shared service for identity, permissions, data, dispatch coordination, realtime events, and Marketplace execution. |
