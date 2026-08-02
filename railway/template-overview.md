# Deploy and Host Relay Console with Railway

Relay Console is an MIT-licensed, self-hosted AI console for native Apple and
web clients. This template creates its public NestJS backend, a private
PostgreSQL database and a private Redis service with installation-specific
credentials, verified database TLS, startup migrations and health checking.

## About Hosting Relay Console

Railway builds the backend from the public Relay Console repository and gives
it a generated HTTPS domain. PostgreSQL and Redis communicate with it over
Railway's private network and retain their data on volumes. Railway template
functions create independent secrets for each installation. A private,
challenge-authenticated bootstrap transfers the installation CA; PostgreSQL
connections continue to require a valid chain and the exact `localhost`
certificate identity.

## Common Use Cases

- Run the Relay Console Swift app against your own backend.
- Connect an existing same-Mac Hermes or OpenClaw installation from Settings.
- Use the iPhone, iPad and browser clients with one self-hosted source of truth.
- Evaluate Relay Console without managing database or cache services manually.

## Dependencies for Relay Console Hosting

- Relay Console NestJS backend
- Railway PostgreSQL with persistent storage
- Railway Redis with persistent storage

### Deployment Dependencies

- [Relay Console source](https://github.com/insitektalay/clawchat)
- [Railway template documentation](https://docs.railway.com/templates)
- [Relay Console self-hosting guide](https://github.com/insitektalay/clawchat/blob/main/SELF_HOSTING.md)

### Implementation Details

The backend runs its production secret audit, serializes startup with a
PostgreSQL advisory lock, applies migrations, then serves the API. The public
health check is `/api/v1/health/live`. PostgreSQL and Redis do not expose public
TCP proxies.

### Why Deploy Relay Console on Railway?

The template turns the backend, database, cache, private references, secrets,
volumes, networking and health check into one reviewed deployment flow. After
the three services become healthy, copy the backend HTTPS domain into Relay
Console Swift.
