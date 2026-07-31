# Common Jotform Tasks

For form creation:

1. Resolve the user's title, questions, types, required flags, and ordering.
2. Build one `create_form` call from its live schema.
3. Request approval for that exact call.
4. Execute it unchanged after approval.
5. Verify the returned form ID with `form_list`.

For submissions, identify the form and live field structure before preparing `create_submission`.
