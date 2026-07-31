import { capability } from "../../catalog/marketplace-catalog.types";

export const GITLAB_CAPABILITIES = [
  capability("read", "Read GitLab", "Read GitLab groups, projects, repositories, branches, commits, issues, merge requests, pipelines, jobs, environments, releases, variable metadata, and webhooks with bounded queries.", true),
  capability("draft", "Draft GitLab", "Prepare exact GitLab issue, merge request, branch/tag, repository file, pipeline/job, environment, CI/CD variable, member, or webhook payloads without side effects.", true),
  capability("write", "Write GitLab", "Create/update GitLab issues, merge requests, comments, branches/tags, pipeline actions, and limited repository file changes after token scope and approval checks.", false),
  capability("admin", "Admin GitLab", "Operate GitLab protected refs, CI/CD variables/secrets, project/group membership, webhooks, deploy tokens/keys, project deletion/archive, pipeline cancellation, and production operations under approval.", false),
];
