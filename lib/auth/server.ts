import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createAuthServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server components cannot always mutate cookies; proxy refreshes them.
          }
        },
      },
    },
  )
}

export async function getAuthenticatedUser() {
  const client = await createAuthServerClient()
  const { data, error } = await client.auth.getUser()
  if (error) return null
  return data.user
}
