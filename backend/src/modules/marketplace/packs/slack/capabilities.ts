import { capability } from "../../catalog/marketplace-catalog.types";

export const SLACK_CAPABILITIES = [
  capability("read", "Read Slack", "Read Slack workspace/team, public/private/IM/MPIM/Slack Connect conversations, message timestamps, thread_ts replies, users, files, and reactions with bounded Web API queries.", true),
  capability("draft", "Draft Slack", "Prepare exact Slack chat.postMessage, chat.update, Block Kit, thread reply, reaction, file upload, or Event API response plans without side effects.", true),
  capability("write", "Write Slack", "Post messages, replies, reactions, or file references only after Slack scope checks and approval-policy checks for the target conversation.", false),
  capability("admin", "Admin Slack", "Operate Slack app installation, scopes, Events API, incoming webhooks, channel membership/topic/pin/bookmark, Slack Connect, or destructive message workflows under explicit approval.", false),
];
