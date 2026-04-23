"use client"
import LandingNav from "./LandingNav"
import Hero from "./Hero"
import ScrollProgress from "./ScrollProgress"
import TrustStrip from "./TrustStrip"
import ProblemStatement from "./ProblemStatement"

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md"
      >
        Skip to content
      </a>
      <ScrollProgress />
      <LandingNav />
      <main id="main">
        <Hero />
        <TrustStrip />
        <ProblemStatement />
        {/* HowItWorks, FeatureSection, PrivacyDeepDive, NotesFromBuild, FAQSection, FinalCTA, LandingFooter */}
      </main>
    </div>
  )
}
