# Security Policy

## Supported versions

Relay Console is an early alpha. The maintainer applies security fixes to the
default branch and the newest tagged alpha release. Older alpha releases do not
receive security updates.

| Version | Security support |
| --- | --- |
| Default branch | Yes |
| Newest tagged alpha | Yes |
| Older releases | No |

Self-hosters must update their own Railway deployment, web application, Apple
clients, and bridge plugins when a security fix ships.

## Report a vulnerability

Use the repository's **Security** tab and select **Report a vulnerability**.
GitHub will open a private report with the maintainer.

Do not disclose vulnerability details in a public issue, discussion, pull
request, or social-media post. If private reporting is unavailable, open a
public issue that asks the maintainer to arrange a private contact method.
Include no security details in that issue.

Include the following in a private report:

- The affected release or commit.
- Reproduction steps or a proof of concept.
- The expected impact and required attacker access.
- Any suggested mitigation or fix, if you have one.

Remove credentials, personal data, private conversations, and third-party data
from reports and attachments.

## Response and disclosure

The project has no response-time service-level agreement during alpha. The
maintainer will review private reports, confirm the affected components, and
coordinate disclosure with the reporter. Please allow time for self-hosted
backend, web, Apple-client, and bridge fixes to reach users before publishing
technical details.

## Self-hosted deployments

Each operator controls their Railway project, databases, domains, OAuth apps,
provider credentials, signing identities, and runtime hosts. If a credential
appears in a report or public repository, revoke or rotate it before sharing
diagnostic material.
