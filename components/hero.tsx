import Image from 'next/image'
import { Countdown } from '@/components/countdown'

export function Hero({ src, alt, startsAt }: { src: string; alt: string; startsAt?: string }) {
  return (
    <section className="relative isolate overflow-hidden bg-background">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-xl">
        <Image src={src} alt={alt} fill priority className="object-cover" sizes="(min-width: 640px) 576px, 100vw" />
        <div aria-hidden="true" className="scanlines absolute inset-0" />
      </div>
      {startsAt && <Countdown startsAt={startsAt} />}
      <div aria-hidden="true" className="h-6 bg-gradient-to-b from-transparent to-background" />
    </section>
  )
}
