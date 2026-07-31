# Backend Migrations

Production migrations run once before the API starts through
`pnpm run railway:start:prod`, which executes
`node dist/scripts/run-migrations.js && node dist/main`.

Do not add a second migration pass to application bootstrap. `dist/main` starts
the API after the dedicated migration script has completed.

Historical duplicate filename prefixes `036` and `038` are already part of the
migration history. Do not rename applied migration classes or timestamp suffixes
to tidy those up; TypeORM would treat renamed classes as new migrations. New
migrations must use the next unused numeric prefix and a unique class
timestamp/name suffix.

Several historical class timestamps do not follow their filename/dependency
order. On a completely blank database, the Railway startup runner detects the
absence of application state and applies the migration files by their numeric
filename prefix before starting the ordinary TypeORM migration pass. A temporary
bootstrap marker makes this process resumable after interruption. Existing
databases never enter this path, and their recorded TypeORM history remains
unchanged.

## Historical Destructive Migrations

Migrations `003` through `008` remove seed/demo data with `DELETE` or
`TRUNCATE`. They are historical migrations and must not be renamed after they
have been applied.

Each destructive historical migration now calls the production-like guard in
`src/infrastructure/database/destructive-migration-guard.ts`. In local
development the migrations behave as before. In production-like Railway
environments, a pending destructive migration is allowed only when every table it
would touch is absent or empty. If any protected table contains rows, migration
startup fails closed before destructive SQL runs.

Before marking a beta backend deploy safe, verify the Railway migration history
without exposing credentials:

```sql
SELECT name, timestamp
FROM migrations
WHERE name IN (
  'RemoveSeedAgents1774172000000',
  'WipeSeedData1774174000000',
  'ForceWipeAllSeedData1774175000000',
  'WipeAllDemoData1774176000000',
  'FinalWipeFakeAgents1774177000000',
  'WipeBridgeInjectedAgents1774178000000'
)
ORDER BY timestamp;
```

If any of those rows are missing on an existing beta database, do not bypass the
guard. Either prove the protected tables are empty before deployment or baseline
the migration history through an approved database change plan.
