export const CIRCUIT_QUESTIONS = [
  {
    question: 'The event is losing power. What do you check first?',
    options: ['The supply path', 'The vibes', 'The snacks'],
    answers: ['The supply path', 'The vibes', 'The snacks'],
  },
  {
    question: 'Your ideal debugging tool is...',
    options: ['A logic analyser', 'A whiteboard', 'A friend who asks why'],
    answers: ['A logic analyser', 'A whiteboard', 'A friend who asks why'],
  },
  {
    question: 'Choose a signal:',
    options: ['Clean square wave', 'Warm sine wave', 'Chaotic noise'],
    answers: ['Clean square wave', 'Warm sine wave', 'Chaotic noise'],
  },
] as const

export function getCircuitResult(scores: number[]) {
  const total = scores.reduce((sum, score) => sum + score, 0)
  if (total >= 6) return { title: 'The Power Architect', text: 'You bring systems online and keep the whole room moving.' }
  if (total >= 3) return { title: 'The Signal Shaper', text: 'You find the useful pattern inside every noisy room.' }
  return { title: 'The Chaos Oscillator', text: 'Unpredictable, bright, and somehow always part of the best story.' }
}
