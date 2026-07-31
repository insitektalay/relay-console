# Jotform Permissions

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

- `jotform_read` permits only `form_list` and `get_submissions`.
- `jotform_manage` permits only `create_form`, `edit_form`, and `create_submission`.
- Safe mode requires exact-payload approval for every manage call.
- Provider OAuth scope, selected Relay capability, connection ownership, and approval must all permit the action.
