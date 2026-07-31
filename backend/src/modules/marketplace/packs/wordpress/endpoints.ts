export const WORDPRESS_ENDPOINT_FAMILIES = [
  {
    id: "posts_pages",
    label: "Posts, Pages and Revisions",
    docsUrl: "https://developer.wordpress.org/rest-api/",
    guidance: "Draft and read freely within capability; publishing and deletion require approval.",
    representativeEndpoints: ["GET /wp-json/wp/v2/posts","POST /wp-json/wp/v2/posts","GET /wp-json/wp/v2/posts/{id}/revisions"],
  },
  {
    id: "media",
    label: "Media",
    docsUrl: "https://developer.wordpress.org/rest-api/",
    guidance: "Uploads and deletes can expose or remove public assets.",
    representativeEndpoints: ["GET /wp-json/wp/v2/media","POST /wp-json/wp/v2/media","DELETE /wp-json/wp/v2/media/{id}"],
  },
  {
    id: "comments",
    label: "Comments",
    docsUrl: "https://developer.wordpress.org/rest-api/",
    guidance: "Moderation writes require approval.",
    representativeEndpoints: ["GET /wp-json/wp/v2/comments","POST /wp-json/wp/v2/comments","PATCH /wp-json/wp/v2/comments/{id}"],
  },
  {
    id: "taxonomies",
    label: "Categories and Tags",
    docsUrl: "https://developer.wordpress.org/rest-api/",
    guidance: "Taxonomy changes affect public navigation and SEO.",
    representativeEndpoints: ["GET /wp-json/wp/v2/categories","GET /wp-json/wp/v2/tags","POST /wp-json/wp/v2/categories"],
  },
  {
    id: "users",
    label: "Users",
    docsUrl: "https://developer.wordpress.org/rest-api/",
    guidance: "User and role operations are admin/security sensitive.",
    representativeEndpoints: ["GET /wp-json/wp/v2/users","GET /wp-json/wp/v2/users/me","POST/PATCH /wp-json/wp/v2/users"],
  },
  {
    id: "custom_types",
    label: "Custom Post Types",
    docsUrl: "https://developer.wordpress.org/rest-api/",
    guidance: "Only operate custom types exposed through show_in_rest after schema inspection.",
    representativeEndpoints: ["GET /wp-json/wp/v2/types","GET /wp-json/wp/v2/{custom_type}"],
  },
];
