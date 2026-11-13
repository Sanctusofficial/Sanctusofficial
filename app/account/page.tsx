'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'

import { createBrowserAuthClient } from '@/lib/auth/browser'

export default function AccountPage() {
  const supabase = createBrowserAuthClient()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [matricNumber, setMatricNumber] = useState('')
  const [message, setMessage] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null))
  }, [supabase.auth])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    if (mode === 'sign-in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return setMessage(error.message)
      window.location.href = '/passport'
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) return setMessage(error.message)
      if (data.user) {
        const { error: profileError } = await supabase.from('member_profiles').upsert({
          id: data.user.id,
          name,
          email: email.toLowerCase(),
          matric_number: matricNumber.replace(/\s+/g, '').toUpperCase(),
        })
        if (profileError) return setMessage(profileError.message)
      }
      setMessage('Account created. Check your email to verify it, then sign in.')
      setMode('sign-in')
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUserEmail(null)
  }

  return (
    <main className="min-h-screen px-4 py-12">
      <section className="mx-auto max-w-md rounded-3xl border border-primary/30 bg-card p-6">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-secondary">SEES&apos;30 identity</p>
        <h1 className="mt-3 font-display text-3xl text-primary text-glow-pink">Your passport</h1>
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
