import { ArrowRight, Banknote, ChevronLeft, ChevronRight, Handshake, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { cn } from '@/utils/cn'

interface Slide {
  eyebrow: string
  title: string
  text: string
  cta: { label: string; to: string }
  icon: typeof Handshake
  className: string
}

const slides: Slide[] = [
  { eyebrow: 'Only on NegoMarket', title: 'Found it? Name your price.', text: 'Send an offer, chat with the seller and lock in the price you agree on.', cta: { label: 'Shop products open to offers', to: '/products?negotiable=1' }, icon: Handshake, className: 'from-brand-800 via-brand-700 to-brand-600' },
  { eyebrow: 'Support local', title: 'Independent stores, one marketplace.', text: 'Electronics, fashion, crafts and home goods from approved Moroccan sellers.', cta: { label: 'Explore stores', to: '/stores' }, icon: Store, className: 'from-[#1d3557] via-[#264a73] to-[#2f5f8f]' },
  { eyebrow: 'Pay at your door', title: 'Cash on Delivery. Always.', text: 'No card needed. Pay the courier when your order arrives.', cta: { label: 'Start shopping', to: '/products?sort=popular' }, icon: Banknote, className: 'from-accent-700 via-accent-600 to-accent-500' },
]

/** Promotional hero carousel (copy only; every CTA opens a real, filtered listing). */
export function HeroCarousel() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000)
    return () => clearInterval(t)
  }, [paused])

  const go = (d: number) => setIndex((i) => (i + d + slides.length) % slides.length)

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      className="relative h-full min-h-72 overflow-hidden rounded-2xl"
    >
      {slides.map((s, i) => {
        const Icon = s.icon
        return (
          <div
            key={s.title}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            aria-hidden={i !== index}
            className={cn('absolute inset-0 flex items-center bg-linear-to-br p-8 text-white transition-opacity duration-700 sm:p-12', s.className, i === index ? 'opacity-100' : 'pointer-events-none opacity-0')}
          >
            <div className="pattern-grid absolute inset-0" aria-hidden />
            <Icon className="absolute -bottom-8 -right-8 size-64 text-white/10" aria-hidden />
            <div className="relative max-w-lg">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">{s.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-[2.6rem]">{s.title}</h2>
              <p className="mt-3 text-base text-white/85 sm:text-lg">{s.text}</p>
              <Link to={s.cta.to} tabIndex={i === index ? 0 : -1} className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-ink shadow-sm hover:bg-accent-50">
                {s.cta.label} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        )
      })}
      <div className="absolute bottom-5 left-8 flex gap-1.5 sm:left-12">
        {slides.map((s, i) => (
          <button key={s.title} type="button" onClick={() => setIndex(i)} aria-label={`Show slide ${i + 1}`} aria-current={i === index} className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-8 bg-white' : 'w-3 bg-white/50 hover:bg-white/80')} />
        ))}
      </div>
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button type="button" onClick={() => go(-1)} aria-label="Previous slide" className="grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"><ChevronLeft className="size-5" /></button>
        <button type="button" onClick={() => go(1)} aria-label="Next slide" className="grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"><ChevronRight className="size-5" /></button>
      </div>
    </section>
  )
}
