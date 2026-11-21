'use client'

import { useEffect, useRef } from 'react'

// Polls `fn` every `intervalMs`, but gently: it pauses while the tab is hidden
// (phone locked / app switched), spreads requests out with jitter so a room of
// phones on one Wi-Fi doesn't fire in lockstep, and backs off after failures
// (2x, 4x ... up to 30s) instead of hammering a struggling network.
// `fn` returns true on success.
export function usePoll(fn: () => Promise<boolean>, intervalMs: number, key: unknown = null) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let alive = true
    let failures = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const schedule = (ms: number) => {
      clearTimeout(timer)
      timer = setTimeout(run, ms)
    }

    async function run() {
      if (!alive) return
      if (typeof document !== 'undefined' && document.hidden) return // resumes on visibilitychange
      let ok = false
      try {
        ok = await fnRef.current()
      } catch {
        ok = false
      }
      if (!alive) return
      failures = ok ? 0 : Math.min(failures + 1, 5)
      const base = intervalMs * (ok ? 1 : 2 ** failures)
      schedule(Math.min(base, 30000) * (0.8 + Math.random() * 0.4))
    }

    const onVisible = () => {
      if (!document.hidden) schedule(Math.random() * 500)
    }

    void run()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs, key])
}
