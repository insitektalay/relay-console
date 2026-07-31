# Marketplace provider acceptance records

Copy `provider.template.json` to `<provider-slug>.json` after the provider passes
staging acceptance. Replace each pending field and keep credentials, account
identifiers, provider object identifiers, customer content, and raw command
output outside the record.

Hash the completed file with SHA-256. Add this reference to the provider entry
in `../marketplace-release-manifest.json`:

```json
{
  "acceptance": {
    "recordPath": "packages/marketplace-catalog/release/acceptance/<provider-slug>.json",
    "recordSHA256": "<64-character-file-SHA-256>"
  }
}
```

Set `liveVerified` to `true` only after
`pnpm run marketplace:provider-acceptance` passes. The candidate gate compares
the record to the exact staging deployment in the Railway topology snapshot.
The final launch journey repeats one bounded provider action against the release
deployment before publication.
