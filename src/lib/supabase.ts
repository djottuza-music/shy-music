import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const isSupabaseConfigured = Boolean(url && key)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('SHY is not connected to Supabase yet.')
  return supabase
}

export function publicStorageUrl(bucket: string, path?: string | null): string | null {
  if (!path || !supabase) return null
  if (/^https?:\/\//i.test(path)) return path
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}
