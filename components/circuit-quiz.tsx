'use client'

import { useState } from 'react'

import { CIRCUIT_QUESTIONS, getCircuitResult } from '@/lib/circuit-quiz'

export function CircuitQuiz() {
  const [step, setStep] = useState(0)
  const [scores, setScores] = useState<number[]>([])
  const [result, setResult] = useState<ReturnType<typeof getCircuitResult> | null>(null)
  if (result) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-secondary">Circuit identity</p>
        <h2 className="mt-3 font-display text-3xl text-primary">{result.title}</h2>
        <p className="mt-3 text-muted-foreground">{result.text}</p>
        <button type="button" onClick={() => { setStep(0); setScores([]); setResult(null) }} className="mt-6 text-primary underline">Run it again</button>
      </div>
    )
  }
  const question = CIRCUIT_QUESTIONS[step]
  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-6">
      <p className="text-sm text-muted-foreground">Question {step + 1} of {CIRCUIT_QUESTIONS.length}</p>
      <h2 className="mt-3 font-display text-2xl text-primary">{question.question}</h2>
      <div className="mt-6 grid gap-3">
        {question.options.map((option, index) => (
          <button key={option} type="button" onClick={() => {
            const next = [...scores, index]
            if (step === CIRCUIT_QUESTIONS.length - 1) setResult(getCircuitResult(next))
            else { setScores(next); setStep(step + 1) }
          }} className="rounded-xl border border-border p-4 text-left transition hover:border-secondary hover:bg-secondary/10">{option}</button>
        ))}
      </div>
    </div>
  )
}
