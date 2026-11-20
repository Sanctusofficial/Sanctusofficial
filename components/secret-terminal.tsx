'use client'

import { useState } from 'react'

export function SecretTerminal() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('Awaiting command...')
  function run(event: React.FormEvent) {
    event.preventDefault()
    const command = input.trim().toLowerCase()
    setOutput(command === 'hello sees' ? 'ACCESS GRANTED // the circuit remembers you.' : command === 'help' ? 'Try: hello sees' : 'Unknown command.')
    setInput('')
  }
  return (
    <div className="rounded-2xl border border-secondary/30 bg-black p-5 font-mono text-sm text-secondary">
      <p>&gt; SEES&apos;30 hidden terminal</p>
      <p className="mt-3 min-h-6">{output}</p>
      <form onSubmit={run} className="mt-3 flex gap-2">
        <span>&gt;</span><input aria-label="Terminal command" value={input} onChange={(e) => setInput(e.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" autoComplete="off" />
      </form>
    </div>
  )
}
