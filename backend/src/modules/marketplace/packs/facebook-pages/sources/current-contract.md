# Facebook Pages current contract

Relay uses Relay-owned Meta OAuth with exactly `pages_show_list pages_read_engagement pages_manage_posts`. Connection setup enumerates eligible Pages, requires the provider tasks needed to read and publish, and immutably binds one user-selected Page id/name plus a separate encrypted Page-token reference.

The active surface is exactly four actions: read bounded selected-Page metadata, list one page of at most ten Page-authored posts through the selected Page's `/posts` edge, create a local plain-text draft, and publish one approved plain-text post through the selected Page's `/feed` edge with a request body containing only `message`.

Visitor feeds, arbitrary Page ids, comments, replies, reactions, messages, insights, ads, leads, events, roles, webhooks, media, stories, reels, search, edit/delete, scheduling, bulk actions, pagination, automatic ambiguous-write retries, raw Graph access, and browser automation are blocked.
