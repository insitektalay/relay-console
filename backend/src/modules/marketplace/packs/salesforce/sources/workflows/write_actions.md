# Salesforce Write Workflows

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

1. Describe the object and validate CRUD, FLS, record type, picklist values, owner/queue ids, and validation-rule risk.
2. Read current record state unless the operation is create-only.
3. Draft the exact REST or Composite payload and classify approval requirements.
4. Execute only approved payloads; preserve allOrNone behavior and dependency ordering for Composite.
5. Record object API name, record ids, changed fields, approval id, and safe provider response.
