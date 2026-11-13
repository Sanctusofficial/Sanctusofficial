'use client'

import { createBrowserClient } from '@supabase/ssr'

export function hasBrowserAuthConfig() {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

export function createBrowserAuthClient() {
  if (!hasBrowserAuthConfig()) {
    throw new Error('Supabase browser authentication is not configured.')
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
