# Salesforce Auth Setup

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Salesforce REST API access is normally granted through an OAuth connected app. Store client secrets, access tokens, refresh tokens, session ids, certificates, JWT keys, and instance URLs only in ClawChat connection storage.

Confirm the connected app, org, instance URL, user, OAuth scopes, and API version before any API call. If OAuth expires or scopes are missing, stop and repair the connection rather than asking for credentials in chat.

Official docs:

- https://help.salesforce.com/s/articleView?id=sf.connected_app_create_api_integration.htm&type=5
- https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_flows.htm&type=5
- https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_scopes.htm&type=5
