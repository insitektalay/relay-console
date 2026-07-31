# HubSpot Endpoint Families

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

- CRM objects: `GET/POST/PATCH /crm/v3/objects/{objectType}`, `GET/PATCH /crm/v3/objects/{objectType}/{recordId}`, and archive/delete where enabled.
- Search: `POST /crm/v3/objects/{contacts|companies|deals|tickets}/search` with filters, sorts, properties, limit, and after cursor.
- Batch: `/crm/v3/objects/{objectType}/batch/read`, `/batch/create`, `/batch/update`, `/batch/archive`; batch writes require approval.
- Properties: `/crm/v3/properties/{objectType}` to resolve internal property names and options.
- Associations: CRM v3/v4 association endpoints and labels/type ids for contact-company-deal-ticket-activity links.
- Pipelines and owners: pipeline/stage/status and owner endpoints for validated assignment and routing.
- Lists and webhooks: read segmentation and event configuration; modifications require approval.

## Read Doctrine

Use explicit ids or narrow filters. Request only required properties. Include associations only when needed.

## Write Doctrine

Validate object type, record id, property internal names, owner ids, pipeline/stage/status ids, and association type ids. Show the exact payload and approval status before execution.
