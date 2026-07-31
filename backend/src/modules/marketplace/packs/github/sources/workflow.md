# GitHub Workflow Router

Use this pack when the user asks to inspect repository state, triage or create issues, review pull requests, reason about repository contents, inspect webhook setup, or coordinate a software delivery workflow that clearly belongs in GitHub.

Do not use this pack for:

- chat or project-management work that belongs in Slack, Linear, or another app;
- code editing when the user only wants a local patch and no GitHub state needs to change;
- destructive repository administration;
- authentication troubleshooting that requires exposing secrets.

## Decision order

1. Identify the repository, organization, and target branch.
2. Identify whether the task is read-only, collaborative, or state-changing.
3. Read `permissions.md` to confirm the enabled capabilities for this install.
4. Read `safe_actions.md` before any operation that writes, requests review, merges, modifies contents, changes workflows, or changes webhook configuration.
5. Route into the most specific workflow:
   - issue triage or issue creation: `workflows/create_issue.md`
   - pull request inspection or creation: `workflows/open_pr.md`
   - review or review comments: `workflows/review_pr.md`
   - merge decisions: `workflows/merge_pr.md`
   - repository or branch inspection: `api/repositories.md`
   - file inspection or file writes: `api/repository_contents.md`
   - webhook investigation: `api/webhooks.md`
6. If the request exceeds documented capability, stop and use `workflows/escalate_to_user.md`.

## Required operating rules

- Prefer the least-privilege token model that supports the requested work.
- Treat the repository default branch and protected branches as high-risk surfaces.
- Never print, commit, or otherwise expose tokens, app private keys, secrets, or webhook secrets.
- Ask for approval before opening PRs, requesting reviewers, merging, releasing, modifying workflows, changing webhooks, changing branch protection, or editing repository contents when approval is required by policy.
