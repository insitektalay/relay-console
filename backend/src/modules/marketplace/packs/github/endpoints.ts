export type GithubEndpointFamily = {
  id: string;
  label: string;
  guidance: string;
  representativeEndpoints: string[];
};

export const GITHUB_ENDPOINT_FAMILIES: GithubEndpointFamily[] = [
  {
    id: "repositories",
    label: "Repositories",
    guidance:
      "Use repository endpoints to inspect metadata, branches, labels, workflow runs, and collaboration state before changing anything.",
    representativeEndpoints: [
      "GET /repos/{owner}/{repo}",
      "GET /repos/{owner}/{repo}/branches",
      "GET /repos/{owner}/{repo}/labels",
    ],
  },
  {
    id: "issues",
    label: "Issues",
    guidance:
      "Use issue endpoints for triage, issue creation, assignee changes, labels, and issue comments.",
    representativeEndpoints: [
      "GET /repos/{owner}/{repo}/issues",
      "POST /repos/{owner}/{repo}/issues",
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
    ],
  },
  {
    id: "pull_requests",
    label: "Pull Requests",
    guidance:
      "Use pull request endpoints to inspect diff state, open PRs, update metadata, and merge only after approval.",
    representativeEndpoints: [
      "GET /repos/{owner}/{repo}/pulls",
      "POST /repos/{owner}/{repo}/pulls",
      "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
    ],
  },
  {
    id: "reviews",
    label: "Reviews and Review Requests",
    guidance:
      "Use review endpoints for review comments, review submissions, and reviewer assignment with explicit human approval where required.",
    representativeEndpoints: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers",
    ],
  },
  {
    id: "contents",
    label: "Repository Contents",
    guidance:
      "Use contents endpoints to read files safely. Create, update, or delete contents only when write capability is enabled and approval rules are satisfied.",
    representativeEndpoints: [
      "GET /repos/{owner}/{repo}/contents/{path}",
      "PUT /repos/{owner}/{repo}/contents/{path}",
      "DELETE /repos/{owner}/{repo}/contents/{path}",
    ],
  },
  {
    id: "webhooks",
    label: "Webhooks",
    guidance:
      "Use webhook endpoints to inspect or manage webhook subscriptions and delivery status only when connection permissions allow it.",
    representativeEndpoints: [
      "GET /repos/{owner}/{repo}/hooks",
      "POST /repos/{owner}/{repo}/hooks",
      "GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries",
    ],
  },
];
