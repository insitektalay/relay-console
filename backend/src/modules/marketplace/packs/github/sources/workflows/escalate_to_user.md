# Workflow: Escalate to the User

Escalate when:

- credentials are missing or insufficient;
- the repository or branch is ambiguous;
- the request requires approval and approval is not present;
- the request conflicts with branch protection, repository rulesets, or workspace policy;
- the request would delete resources, disable security controls, or expose secrets;
- webhook or integration behavior is unclear;
- rate limiting or permission errors suggest a policy problem rather than a transient failure.

Escalation report format:

- objective
- repository and branch
- attempted read-only checks
- blocker
- exact decision needed
