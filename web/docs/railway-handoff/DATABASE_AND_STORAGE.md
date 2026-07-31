# Database And Storage

## Required: Postgres

The backend requires Postgres. Use Railway Postgres for an independent Railway deployment.

Backend database config supports either:

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

or individual variables:

```bash
DATABASE_HOST=${{Postgres.PGHOST}}
DATABASE_PORT=${{Postgres.PGPORT}}
DATABASE_NAME=${{Postgres.PGDATABASE}}
DATABASE_USER=${{Postgres.PGUSER}}
DATABASE_PASSWORD=${{Postgres.PGPASSWORD}}
```

The backend uses TypeORM. Entities live in `backend/src/entities/`. Migrations live in `backend/src/migrations/`.

## Migrations

Migration commands from `backend/package.json`:

```bash
npm run migration:run
npm run migration:run:prod
npm run migration:revert
```

Railway production start command:

```bash
pnpm run railway:start:prod
```

This runs:

```bash
node dist/scripts/run-migrations.js && node dist/main
```

The dedicated migration script is the single Railway startup migration runner.
`dist/main` starts the Nest app after that script completes and does not run a
second `dataSource.runMigrations()` pass.

## Seed Data

Seed command from `backend/package.json`:

```bash
npm run seed
```

Runtime startup seeding:

```bash
SEED_ON_START=true
```

Warning: the seed function clears application tables before inserting demo data.
Production-like startup rejects `SEED_ON_START=true`, and direct seed execution
refuses to run in production-like Railway environments. Keep
`SEED_ON_START=false` or unset for beta and production.

Optional seed password:

```bash
SEED_DEMO_PASSWORD=replace-with-demo-password
```

If `SEED_DEMO_PASSWORD` is not set, the seed script generates a random password.

## Historical Destructive Migration Verification

Migrations `003` through `008` are historical seed/demo cleanup migrations. In
production-like Railway environments they are guarded: if any protected target
table contains rows, startup fails before the destructive SQL can run.

Before deploying against an existing beta database, verify those migrations are
already present in the `migrations` table or prove the protected tables are
empty. Use the SQL in `backend/src/migrations/README.md` as the canonical
history check. Do not bypass the guard without an approved database baseline
plan.

## Required: Redis

The backend requires Redis for Bull queues.

Preferred Railway config:

```bash
REDIS_URL=${{Redis.REDIS_URL}}
```

Supported alternatives:

```bash
REDIS_PUBLIC_URL=${{Redis.REDIS_PUBLIC_URL}}
REDIS_HOST=${{Redis.REDISHOST}}
REDIS_PORT=${{Redis.REDISPORT}}
REDIS_USER=${{Redis.REDISUSER}}
REDIS_PASSWORD=${{Redis.REDISPASSWORD}}
```

The backend also reads Railway-style aliases `REDISHOST`, `REDISPORT`, `REDISUSER`, and `REDISPASSWORD`.

## File Storage And Volumes

No Railway volume requirement was found for the backend or web service.

The backend stores application state in Postgres and queue state in Redis. Marketplace credentials and connection secrets are stored in Postgres encrypted with `APP_ENCRYPTION_KEY`.

NEEDS CONFIRMATION:

- Whether any production bridge/plugin runtime from `clawchat-bridge-plugins` needs persistent local disk.
- Whether Hermes remote bridge deployments need a persistent `HERMES_HOME` volume on the machine running Hermes.
- Whether future attachment/file-upload storage should use object storage. The repo contains attachment-related bridge code, but no Railway volume or object storage service config was found.

## External Storage

Supabase is not required by the inspected backend setup. Supabase appears only as a marketplace/catalog integration concept, not as the app database.

External Postgres is supported only insofar as `DATABASE_URL` can point to a compatible Postgres database. For a Railway handoff, use Railway Postgres unless the operator deliberately chooses an external Postgres provider.
