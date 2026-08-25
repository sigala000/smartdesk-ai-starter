import { parsePublicEnvironment } from "@/lib/config/env-schema";

export const publicEnvironment = parsePublicEnvironment({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_META_APP_ID: process.env.NEXT_PUBLIC_META_APP_ID,
  NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID:
    process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID,
});
