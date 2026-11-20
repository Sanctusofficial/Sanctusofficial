'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'

import { createBrowserAuthClient, hasBrowserAuthConfig } from '@/lib/auth/browser'

export default function AccountPage() {
  const authConfigured = hasBrowserAuthConfig()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [matricNumber, setMatricNumber] = useState('')
  const [message, setMessage] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!authConfigured) return
    const supabase = createBrowserAuthClient()
    void supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null))
  }, [authConfigured])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!authConfigured) {
      setMessage('Account sign-in is not configured yet. Ask the organizer to enable Supabase Auth.')
      return
    }
    const supabase = createBrowserAuthClient()
    setMessage('')
    if (mode === 'sign-in') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return setMessage(error.message)
      // Fallback for logins whose profile the sign-up trigger could not create.
      const { data: profile } = await supabase
        .from('member_profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()
      if (!profile) {
        const meta = data.user.user_metadata ?? {}
        const metaName = typeof meta.name === 'string' ? meta.name.trim() : ''
        const metaMatric = typeof meta.matric_number === 'string' ? meta.matric_number : ''
        if (!metaName || !metaMatric) {
          return setMessage('Your account has no name or matric number. Contact the organizers to link it.')
        }
        const { error: profileError } = await supabase.from('member_profiles').insert({
          id: data.user.id,
          name: metaName,
          email: (data.user.email ?? email).toLowerCase(),
          matric_number: metaMatric.replace(/\s+/g, '').toUpperCase(),
        })
        if (profileError) {
          return setMessage(
            profileError.code === '23505'
              ? 'That matric number is already linked to another account. Contact the organizers.'
              : profileError.message,
          )
        }
      }
      window.location.href = '/passport'
    } else {
      // Profile is created server-side from this metadata (see the
      // create_member_profile_from_signup trigger); there is no session yet.
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name.trim(),
            matric_number: matricNumber.replace(/\s+/g, '').toUpperCase(),
          },
          emailRedirectTo: `${window.location.origin}/account`,
        },
      })
      if (error) return setMessage(error.message)
      setMessage('Account created. Check your email to verify it, then sign in.')
      setMode('sign-in')
    }
  }

  async function signOut() {
    if (!authConfigured) return
    const supabase = createBrowserAuthClient()
    await supabase.auth.signOut()
    setUserEmail(null)
  }

  return (
    <main className="min-h-screen px-4 py-12">
      <section className="mx-auto max-w-md rounded-3xl border border-primary/30 bg-card p-6">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-secondary">SEES&apos;30 identity</p>
        <h1 className="mt-3 font-display text-3xl text-primary text-glow-pink">Your passport</h1>
        {!authConfigured && (
          <p className="mt-6 rounded-lg border border-secondary/30 p-3 text-sm text-muted-foreground">
            Passport sign-in is awaiting Supabase Auth configuration.
          </p>
        )}
        {userEmail ? (
          <div className="mt-6 space-y-4">
            <p>Signed in as {userEmail}.</p>
            <Link href="/passport" className="block text-primary underline">Open passport</Link>
            <button type="button" onClick={signOut} className="text-sm text-muted-foreground underline">Sign out</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'sign-up' && (
              <>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full rounded-lg border bg-background p-3" />
                <input required value={matricNumber} onChange={(e) => setMatricNumber(e.target.value)} placeholder="Matric number" className="w-full rounded-lg border bg-background p-3" />
              </>
            )}
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border bg-background p-3" />
            <input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ characters)" className="w-full rounded-lg border bg-background p-3" />
            {message && <p role="status" className="text-sm text-secondary">{message}</p>}
            <button className="w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground" type="submit">
              {mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
            <button type="button" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} className="w-full text-sm text-muted-foreground underline">
              {mode === 'sign-in' ? 'Create an account' : 'I already have an account'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
