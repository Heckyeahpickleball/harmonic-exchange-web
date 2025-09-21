// /lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, anonKey, {
  auth: {
    flowType: 'pkce',            // we’re using the PKCE flow via /auth/callback
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,   // we handle the URL ourselves in the callback page
  },
})
