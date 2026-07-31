# Slack Approval-Required Examples

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

- Send this approved outage notice to #status and #support with @here.
- Upload the incident RCA file to the customer Slack Connect channel.
- Remove an inaccurate message already posted by the agent.
- Update the #incidents channel topic to point at the active SEV-1 bridge.
- Reinstall the Slack app with `files:write` and `reactions:write` so it can upload the approved RCA and add acknowledgements.
- Change the Events API subscription callback URL for message and reaction events.
