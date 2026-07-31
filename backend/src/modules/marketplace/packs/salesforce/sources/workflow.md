# Salesforce Workflow Router

Use Salesforce for enterprise CRM/support work involving REST API resources, sObjects, Accounts, Contacts, Leads, Opportunities, Cases, Tasks, Events, record types, fields, SOQL, SOSL, Composite APIs, Platform Events, and Change Data Capture.

Do not use Salesforce to bypass sharing, object CRUD, field-level security, profiles, permission sets, role hierarchy, audit/compliance settings, or connected-app scope controls.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_rest.htm
- https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_sobject_describe.htm
- https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_query.htm
- https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_search.htm
- https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite.htm
- https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/headers_api_usage.htm
- https://help.salesforce.com/s/articleView?id=sf.connected_app_create_api_integration.htm&type=5
- https://developer.salesforce.com/docs/atlas.en-us.change_data_capture.meta/change_data_capture/cdc_intro.htm

## Routing Doctrine

1. Confirm org, environment, instance URL, connected app, OAuth scopes, API version, and user context.
2. Use describe resources to validate sObject availability, fields, record types, picklist values, updateability, and field-level security before constructing payloads.
3. Use SOQL for structured object queries and SOSL only for cross-object text search; keep filters selective and include LIMIT.
4. Draft record changes first, including target ids, object API names, fields, old/new values, record type, owner, assignment, and approval status.
5. Require approval for customer-visible Case communication, Opportunity stage changes, Case status/owner/queue changes, Composite/Bulk writes, exports, deletes/merges, connected-app/profile/permission-set/security changes, automation, Platform Events, CDC, and metadata changes.
