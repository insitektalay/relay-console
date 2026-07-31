export type AudiomackOperation = {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  json?: boolean;
};

export const AUDIOMACK_OPERATIONS: AudiomackOperation[] = [
  { id: "music-get", method: "GET", path: "/v1/music/:musicId" },
  {
    id: "music-get-by-slug",
    method: "GET",
    path: "/v1/music/:type/:artistSlug/:musicSlug",
  },
  { id: "music-recent", method: "GET", path: "/v1/music/recent" },
  {
    id: "music-recent-by-genre",
    method: "GET",
    path: "/v1/music/:genre/recent",
  },
  { id: "music-trending", method: "GET", path: "/v1/music/trending" },
  {
    id: "music-trending-by-genre",
    method: "GET",
    path: "/v1/music/:genre/trending",
  },
  { id: "music-metrics", method: "GET", path: "/v1/music/:musicId/metrics" },
  { id: "artist-get", method: "GET", path: "/v1/artist/:artistSlug" },
  {
    id: "artist-uploads",
    method: "GET",
    path: "/v1/artist/:artistSlug/uploads",
  },
  {
    id: "artist-favorites",
    method: "GET",
    path: "/v1/artist/:artistSlug/favorites",
  },
  {
    id: "artist-favorites-search",
    method: "GET",
    path: "/v1/artist/:artistSlug/favorites/search",
  },
  {
    id: "artist-playlists",
    method: "GET",
    path: "/v1/artist/:artistSlug/playlists",
  },
  {
    id: "artist-following",
    method: "GET",
    path: "/v1/artist/:artistSlug/following",
  },
  {
    id: "artist-followers",
    method: "GET",
    path: "/v1/artist/:artistSlug/follows",
  },
  { id: "artist-feed", method: "GET", path: "/v1/artist/:artistSlug/feed" },
  { id: "artist-pinned", method: "GET", path: "/v1/artist/:artistSlug/pinned" },
  { id: "artist-metrics", method: "GET", path: "/v1/artist/:artistId/metrics" },
  { id: "chart", method: "GET", path: "/v1/chart/:type/:chartType" },
  {
    id: "chart-by-genre",
    method: "GET",
    path: "/v1/:genre/chart/:type/:chartType",
  },
  { id: "search", method: "GET", path: "/search" },
  { id: "search-autosuggest", method: "GET", path: "/search_autosuggest" },
  {
    id: "playlist-trending-by-genre",
    method: "GET",
    path: "/v1/playlist/:genre/trending",
  },
  { id: "playlist-get", method: "GET", path: "/v1/playlist/:playlistId" },
  {
    id: "playlist-get-by-slug",
    method: "GET",
    path: "/v1/playlist/:artistSlug/:playlistSlug",
  },
  {
    id: "playlist-metrics",
    method: "GET",
    path: "/v1/playlist/:playlistId/metrics",
  },
  { id: "user-get", method: "GET", path: "/v1/user" },
  { id: "user-playlists", method: "GET", path: "/v1/user/playlists" },
  { id: "user-favorites", method: "GET", path: "/v1/user/favorites" },
  { id: "user-feed", method: "GET", path: "/v1/user/feed" },
  { id: "user-uploads", method: "GET", path: "/v1/user/uploads" },
  {
    id: "user-notifications",
    method: "GET",
    path: "/v1/user/native-notifications",
  },
  { id: "music-favorite", method: "PUT", path: "/v1/music/:musicId/favorite" },
  {
    id: "music-unfavorite",
    method: "DELETE",
    path: "/v1/music/:musicId/favorite",
  },
  { id: "music-repost", method: "PUT", path: "/v1/music/:musicId/repost" },
  { id: "music-unrepost", method: "DELETE", path: "/v1/music/:musicId/repost" },
  { id: "artist-follow", method: "PUT", path: "/v1/artist/:artistSlug/follow" },
  {
    id: "artist-unfollow",
    method: "DELETE",
    path: "/v1/artist/:artistSlug/follow",
  },
  { id: "playlist-create", method: "POST", path: "/v1/playlist" },
  { id: "playlist-update", method: "PUT", path: "/v1/playlist/:playlistId" },
  { id: "playlist-delete", method: "DELETE", path: "/v1/playlist/:playlistId" },
  {
    id: "playlist-add-tracks",
    method: "POST",
    path: "/v1/playlist/:playlistId/track",
  },
  {
    id: "playlist-remove-track",
    method: "DELETE",
    path: "/v1/playlist/:playlistId/:musicId",
  },
  {
    id: "playlist-favorite",
    method: "PUT",
    path: "/v1/playlist/:playlistId/favorite",
  },
  {
    id: "playlist-unfavorite",
    method: "DELETE",
    path: "/v1/playlist/:playlistId/favorite",
  },
  {
    id: "notifications-mark-seen",
    method: "POST",
    path: "/v1/user/native-notifications/seen",
  },
  {
    id: "artist-pinned-add",
    method: "POST",
    path: "/v1/artist/:artistSlug/pinned",
    json: true,
  },
  {
    id: "artist-pinned-replace",
    method: "PUT",
    path: "/v1/artist/:artistSlug/pinned",
    json: true,
  },
  {
    id: "artist-pinned-remove",
    method: "DELETE",
    path: "/v1/artist/:artistSlug/pinned",
    json: true,
  },
];

export const audiomackOperation = (id: string) =>
  AUDIOMACK_OPERATIONS.find((operation) => operation.id === id) ?? null;
