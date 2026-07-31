# Mastodon Read Actions

- Confirm the authenticated account and requested native object.
- Use bounded reads only; do not scrape or export private data.
- Prefer provider IDs over names when correlating records.
- Stop if the requested object requires a missing permission or is outside the account's authorized scope.
