# Salesforce Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- Read specific Accounts, Contacts, Leads, Opportunities, Cases, Tasks, Events, and allowed custom objects.
- Run bounded SOQL or SOSL with selective filters and LIMIT.
- Inspect sObject describes, fields, picklists, record types, and relationship metadata.
- Draft record updates, Case replies, Opportunity stage changes, owner changes, Composite requests, and export plans without executing them.

## Approval Required

- Customer-visible Case replies or support communications.
- Opportunity stage, Case status, owner, queue, assignment, escalation, or record-type changes.
- Bulk API, Composite writes, merges, deletes, exports, and mass owner changes.
- Connected apps, scopes, profiles, permission sets, field permissions, automation, Platform Events, CDC, webhooks, or metadata changes.

## Blocked

- Expose OAuth tokens, session ids, connected-app secrets, certificates, or private keys.
- Bypass sharing, CRUD, FLS, profiles, permission sets, validation rules, or audit controls.
- Delete orgs, disable security/compliance settings, impersonate users, or perform destructive bulk actions.
