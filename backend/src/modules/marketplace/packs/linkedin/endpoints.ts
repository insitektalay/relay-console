export const LINKEDIN_ENDPOINT_FAMILIES = [
  { id: "oauth", label: "LinkedIn OAuth 2.0", docsUrl: "https://learn.microsoft.com/linkedin/shared/authentication/authorization-code-flow", guidance: "Use only approved products and scopes; validate member or organization author before writes." },
  { id: "posts", label: "Posts API", docsUrl: "https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api", guidance: "Create and read member or organization posts with versioned LinkedIn REST headers." },
  { id: "social_actions", label: "Network update social actions", docsUrl: "https://learn.microsoft.com/linkedin/marketing/community-management/shares/network-update-social-actions", guidance: "Read and create comments/likes only within approved scopes and approval gates." },
  { id: "assets", label: "Images and videos", docsUrl: "https://learn.microsoft.com/linkedin/marketing/community-management/shares/vector-asset-api", guidance: "Upload/register media assets only after media ownership and approval checks." },
];
