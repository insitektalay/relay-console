# GitHub Repositories

Use repository endpoints to inspect current state before proposing or performing work.

Recommended first reads:

- repository metadata
- default branch
- branch protection or ruleset status if available through your integration layer
- open pull requests related to the task
- open issues related to the task

Operational guidance:

- Read repository metadata before making assumptions about branch names.
- Do not assume `main`; inspect the default branch.
- Check whether a branch already exists before proposing a new one.
- Check for existing open PRs or issues before creating duplicates.
