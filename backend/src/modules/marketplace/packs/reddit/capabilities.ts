import { capability } from "../../catalog/marketplace-catalog.types";

export const REDDIT_CAPABILITIES = [
  capability("read", "Read Reddit", "Read subreddit rules, posts, comments, reports, modqueue, and message context where scopes and permissions allow.", true),
  capability("draft", "Draft Reddit", "Draft posts, comments, moderation decisions, rule explanations, and modmail responses.", true),
  capability("write", "Write Reddit", "Submit posts/comments, edit/delete content, vote, send messages, or moderate communities only with approval.", false),
  capability("admin", "Admin Reddit", "Change subreddit settings, rules, moderators, automoderator, bans, flair schemas, or scheduled posts only with approval.", false),
];
