# Publish the official Relay Console Railway template

Railway currently creates and publishes multi-service templates through its
dashboard. It does not import a template manifest from a repository. The
repository-owned [`railway/template-spec.json`](../railway/template-spec.json)
is therefore the exact, reviewable source for the dashboard fields; it is not
presented as a Railway-importable file.

An owner of the public `insitektalay/relay-console` repository must perform this one
publishing action:

1. In the authorised Railway workspace, open **Templates**, choose **New
   Template**, and name it `Relay Console`.
2. Reproduce all three services, settings, variables and references from
   `railway/template-spec.json`. Variable function expressions must be entered
   as expressions, not evaluated values.
3. Confirm the backend source uses the public repository's `main` branch,
   `/backend` root, `/backend/railway.json` config and an HTTP public domain.
4. Confirm Postgres uses `/railway/postgres`, has a volume mounted at
   `/var/lib/postgresql/data`, and has no public TCP proxy. Add Railway's Redis
   database with its persistent volume and no public TCP proxy.
5. Deploy the template once in a disposable project, complete the acceptance
   checks below, then use **Create Template**. Publish it if marketplace listing
   is desired.
6. Copy Railway's actual template URL. Only then replace the unpublished notice
   in `README.md` and `SELF_HOSTING.md` with Railway's standard badge linked to
   that exact URL. Never guess a template code.

The Postgres Dockerfile is a small, digest-pinned extension of Railway's
official `postgres-ssl:17` image. The extension adds only the private CA handoff
and stable-root certificate lifecycle that zero-input verified TLS requires;
the database itself remains Railway's PostgreSQL image and volume layout.

## Fresh-account acceptance

Use a Railway account that has not deployed Relay Console before:

1. Open the real template URL, sign in and click **Deploy** without editing any
   variable.
2. Confirm Postgres and Redis have persistent volumes and only private
   networking; confirm the backend receives a generated public domain.
3. Confirm the backend log reports a passed production secret audit, completed
   migrations and a listening API. Confirm Railway's backend health check turns
   healthy at `/api/v1/health/live`.
4. Restart each service, then redeploy the backend source. Confirm the same
   account data, invite value, Ed25519 public key and lifecycle record remain.
5. Start two backend replicas temporarily. Confirm migrations serialize and
   both replicas become healthy, then return to one replica for the baseline
   template.
6. Confirm a renewed PostgreSQL leaf certificate chains to the unchanged root
   CA. The image renews the leaf under the installation-specific CA; it refuses
   an unattended root-CA replacement inside its final 180 days so an operator
   cannot silently strand existing backend trust.
7. Copy `https://<backend-domain>` into Relay Console Swift, create the initial
   account with the generated `CLAWCHAT_BETA_INVITE_CODES` value from the
   backend Variables view, and connect the existing Hermes/OpenClaw installation
   in **Settings**. Do not install a bridge plugin for same-Mac Swift use.

After the actual URL is committed, the end-user flow is: click **Deploy on
Railway**, sign in, click **Deploy**, wait for three healthy services, copy the
backend URL into Relay Console Swift.

## Railway sources reviewed

This design follows Railway's current official documentation for
[creating templates](https://docs.railway.com/templates/create),
[template best practices](https://docs.railway.com/templates/best-practices),
[reference and generated variables](https://docs.railway.com/variables/reference),
[config as code](https://docs.railway.com/config-as-code/reference),
[PostgreSQL](https://docs.railway.com/databases/postgresql),
[persistent volumes](https://docs.railway.com/volumes), and the
[deployment lifecycle](https://docs.railway.com/deployments/reference).
Railway variables persist across service restarts and redeployments; database
files and the installation CA persist on the PostgreSQL volume. Volumes are not
available during pre-deploy commands, which is why certificate bootstrap and
migrations happen in the backend start command. Railway has no service
`depends_on` primitive, so the bootstrap retries private CA and database access
until the database is ready.

The secret lifecycle registry is not regenerated on restart. Its initial
review date is 60 days after installation and the unchanged production audit
will reject a stale record. Operators must review or rotate the corresponding
Railway variables and deliberately update the persisted registry; treating a
restart as a review would weaken the audit and is intentionally unsupported.
