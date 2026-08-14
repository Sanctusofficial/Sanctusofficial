import { EventDetails } from '@/components/event-details'
import { Hero } from '@/components/hero'
import { RegistrationForm } from '@/components/registration-form'

export default function Page() {
  return (
    <main className="min-h-screen bg-background">
      <Hero />
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
