import { capability } from "../../catalog/marketplace-catalog.types";

export const TWILIO_CAPABILITIES = [
  capability("read", "Read Twilio", "Read Twilio Account/Subaccount, Message, Call, Conversation, Messaging Service, phone-number, delivery-status, error-code, participant, and callback metadata with bounded API queries.", true),
  capability("draft", "Draft Twilio", "Prepare exact Twilio SMS/MMS/WhatsApp Message, Call, Conversation, participant, phone-number, Messaging Service, status-callback, or webhook payloads without side effects.", true),
  capability("write", "Write Twilio", "Send approved Twilio messages/calls and update selected Conversations, participants, phone numbers, callbacks, or Messaging Services after account/subaccount and approval checks.", false),
  capability("admin", "Admin Twilio", "Operate Twilio API keys/auth tokens, sender pools, phone-number purchase/release/configuration, compliance bundles, webhooks/status callbacks, and account/subaccount settings under explicit approval.", false),
];
