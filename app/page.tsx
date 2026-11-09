import { EventDetails } from '@/components/event-details'
import { Hero } from '@/components/hero'
import { EventWhenWhere } from '@/components/event-when-where'
import { RegistrationForm } from '@/components/registration-form'

export const revalidate = 60
export default function Page() {
  return (
    <main className="min-h-screen bg-background">
  <Hero />
  <EventWhenWhere />
      <EventDetails />
      <section className="px-6 pb-16">
        <h2 className="mb-6 text-center font-display text-2xl text-primary text-glow-pink">
          Register Now
        </h2>
        <RegistrationForm />
      </section>
    </main>
  )
}
