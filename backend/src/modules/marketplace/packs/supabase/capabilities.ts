import { capability } from "../../catalog/marketplace-catalog.types";

export const SUPABASE_CAPABILITIES = [
  capability("read", "Read Supabase", "Read Supabase project refs, PostgREST tables/views, Auth users, Storage buckets/objects, Edge Functions, Realtime/database webhooks, and troubleshooting status with bounded queries.", true),
  capability("draft", "Draft Supabase", "Prepare exact Supabase PostgREST mutations, SQL, Storage, Auth Admin, Edge Function, RLS/policy, secret, or database-webhook payloads without side effects.", true),
  capability("write", "Write Supabase", "Perform approved Supabase PostgREST writes, Storage changes, Auth Admin updates, Edge Function invocations, and webhook changes inside the selected project/RLS boundary.", false),
  capability("admin", "Admin Supabase", "Operate Supabase service_role, Management API, SQL/schema/RLS/policy, edge-function secrets/deploys, backups, billing, database webhooks, and destructive production workflows under explicit approval.", false),
];
