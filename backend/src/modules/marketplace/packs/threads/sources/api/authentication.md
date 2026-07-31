# Threads API Authentication

Threads API OAuth/token model for a Threads user. Store long-lived tokens only in the connection vault and validate the Threads user/profile before reads or writes.

Permission/scopes model:
- threads_basic, threads_content_publish, threads_manage_replies, threads_read_replies, threads_manage_insights where approved and available to the app.

Token validation rules:
- Confirm the token maps to the intended native account/object before writes.
- Stop on missing scope/product access/product-access denial instead of attempting fallback behavior.
- Use the least privileged permission set for the workflow.

Official docs:
- https://developers.facebook.com/docs/threads/
- https://developers.facebook.com/docs/threads/get-started
- https://developers.facebook.com/docs/threads/threads-media
