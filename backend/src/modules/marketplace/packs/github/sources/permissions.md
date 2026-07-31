# GitHub Permissions Model

This document maps the selected marketplace capabilities to the GitHub permissions the connection should hold.

## Capability to permission guidance

- `repositories_read`
  - repository metadata read
  - contents read where repository file inspection is required
- `issues_write`
  - issues read/write
- `pull_requests_write`
  - pull requests read/write
- `reviews_write`
  - pull request review comment and review submission permissions
- `contents_read`
  - contents read
- `contents_write`
  - contents write and, if workflow files are edited, workflows write
- `webhooks_manage`
  - webhooks read/write as needed
- `releases_write`
  - contents or releases-related write permissions depending on the operation

## Practical rule

If the selected capability is not enabled in this install, the agent must stop and ask the user before attempting the related GitHub operation.

## Additional safeguards

- Use branch protections instead of trusting the agent to avoid dangerous writes.
- Restrict write-capable installs to non-production repositories unless the human has explicitly approved broader scope.
- Treat workflow files, Actions settings, and repository secrets as sensitive admin surfaces.

{{CAPABILITY_CONTEXT}}
