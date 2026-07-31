# YouTube Data API Read Workflows

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.google.com/youtube/v3/getting-started
- https://developers.google.com/youtube/v3/guides/authentication
- https://developers.google.com/youtube/v3/docs/videos/list
- https://developers.google.com/youtube/v3/docs/errors
- https://developers.google.com/youtube/v3/guides/push_notifications
- https://developers.google.com/youtube/v3/guides/implementation/partial

## Read Workflow

1. Confirm connection, scope and resource boundary.
2. Resolve target IDs from official endpoints.
3. Fetch only fields/items needed for the user request.
4. Summarize state without exposing secrets or unnecessary personal/private content.

## Good Read Requests

- List my channel videos with status, privacy and comment count using youtube.readonly.
- Summarize top-level comment threads on video abc123 without replying or moderating.
- Check whether playlist PL123 contains video abc123.
