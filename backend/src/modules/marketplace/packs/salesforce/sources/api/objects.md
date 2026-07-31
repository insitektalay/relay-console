# Salesforce Object Model

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

- sObjects: records addressed by object API name and record id.
- Accounts: companies/accounts and related Contacts, Opportunities, Cases, Tasks, and Events.
- Contacts and Leads: people/prospects with owner, status, source, and activity relationships.
- Opportunities: sales records with StageName, Amount, CloseDate, OwnerId, AccountId, ContactRoles, and record type.
- Cases: support records with Status, Priority, Origin, Owner/Queue, Contact/Account, comments, and customer-visible risk.
- Tasks/Events: activity records associated with WhoId/WhatId and ownership.
- Fields and record types: validate via describe before queries or writes.
- Platform Events and Change Data Capture: event streams for org changes; publishing/subscription changes are approval-gated.
