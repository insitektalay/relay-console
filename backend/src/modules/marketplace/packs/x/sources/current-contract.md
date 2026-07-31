# X current contract

Relay uses a Relay-owned X OAuth 2.0 authorization-code flow with S256 PKCE and exactly `tweet.read users.read tweet.write offline.access`. Client credentials remain on Railway; connection records contain only encrypted rotating user tokens and the bound account identity.

The active surface is exactly four actions: read the connected account through `/2/users/me`, list one page of at most ten bound-account original Posts through `/2/users/{id}/tweets` while excluding replies and reposts, create a local non-URL plain-text draft, and publish one approved non-URL plain-text Post through `POST /2/tweets` with `made_with_ai=true`.

Search, mentions, arbitrary or home timelines, replies, quotes, reposts, likes, DMs, follows, bookmarks, lists, blocks, mutes, media, polls, geo, communities, trends, analytics, edit/delete, scheduling, bulk posting, webhooks, raw requests, hidden pagination, polling, browser automation, and automatic ambiguous-write retries are blocked.
