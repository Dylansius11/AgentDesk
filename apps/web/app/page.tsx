import CategoriesScroll from '@/components/landing/categories-scroll'
import ClosingCta from '@/components/landing/closing-cta'
import FinalReveal from '@/components/landing/final-reveal'
import HowItWorks from '@/components/landing/how-it-works'
import LandingHero from '@/components/landing/landing-hero'
import LiveCounters from '@/components/landing/live-counters'
import ProofBand from '@/components/landing/proof-band'
import SiteFooter from '@/components/landing/site-footer'

export default function Home() {
  return (
    <main>
      <LandingHero />
      <LiveCounters />
      <CategoriesScroll />
      <ProofBand />
      <HowItWorks />
      <FinalReveal>
        <ClosingCta />
        <SiteFooter />
      </FinalReveal>
    </main>
  )
}
