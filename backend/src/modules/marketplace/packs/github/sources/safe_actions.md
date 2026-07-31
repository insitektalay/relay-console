# GitHub Safe Actions

GitHub looks deceptively safe because many operations are collaborative rather than financial, but repository state changes can still be production-critical.

## Always do before acting

1. Confirm the target owner, repository, and branch.
2. Confirm the action is supported by the selected capabilities.
3. Check whether the operation changes repository state, reviewer state, workflow behavior, or release state.
4. Apply the approval profile rules below.

## High-risk surfaces

- default branch or protected branches
- workflow YAML under `.github/workflows`
- repository or environment secrets
- branch protection and rulesets
- releases and tags tied to deployment or customer delivery
- webhook configuration

## Conflict rule

If the user's request conflicts with branch protection, required checks, repository rulesets, or workspace policy, stop and escalate. Do not try to work around protections.

{{POLICY_CONTEXT}}
