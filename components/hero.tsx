import Image from 'next/image'
import { Countdown } from '@/components/countdown'

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-background">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-xl">
        <Image
          src="/images/hero-banner.jpg"
          alt="SEES'30 MIXER poster: a UFO beaming green light onto the glitchy SEES'30 MIXER title, set against neon pink vaporwave graphics. Tags read Fun & Games, Unwind After Shege, Pull Up W Your Gang, and Pure Vibes. Event details: 31st August, 12PM. Featuring picnic, outdoor games, good music, and meet & greet."
          fill
          priority
          className="object-cover"
          sizes="(min-width: 640px) 576px, 100vw"
        />
        <div aria-hidden="true" className="scanlines absolute inset-0" />
      </div>
      <Countdown />
      <div
        aria-hidden="true"
        className="h-6 bg-gradient-to-b from-transparent to-background"
      />
    </section>
  )
}
