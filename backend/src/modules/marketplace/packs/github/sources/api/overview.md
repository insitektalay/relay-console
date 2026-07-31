# GitHub API Overview

This operating pack is written against GitHub's REST API model and GitHub's documented permission system.

Primary surfaces:

- repositories and branches
- issues
- pull requests
- pull request reviews and review comments
- repository contents
- webhooks and deliveries
- releases and workflow-adjacent state when explicitly enabled

## Request basics

- Use `Accept: application/vnd.github+json`.
- Use the current GitHub API version header expected by the integration.
- Read endpoint-specific permission requirements before assuming a token can call an endpoint.

## Routing rule

Prefer a narrow endpoint family and the smallest state change that satisfies the task.
