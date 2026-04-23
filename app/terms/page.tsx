import type { Metadata } from "next"
import LegalLayout, { Section, List } from "@/components/landing/LegalLayout"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of use for Paila.",
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="April 2026">
      <Section title="What Paila is">
        <p>
          Paila is a personal project, not a commercial product or registered
          business. It is provided free of charge, without warranty, and without
          any guarantee of uptime, data retention, or continued availability.
          Use it at your own discretion.
        </p>
      </Section>

      <Section title="Acceptance">
        <p>
          By signing in with your Google account, you agree to these terms and
          to our{" "}
          <a
            href="/privacy"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Privacy Policy
          </a>
          . If you do not agree, do not sign in.
        </p>
      </Section>

      <Section title="What you can do">
        <List
          items={[
            "Use Paila to track your own job applications",
            "Export your data at any time",
            "Disconnect Gmail or delete your account at any time",
            "Share the landing page with others who might find it useful",
          ]}
        />
      </Section>

      <Section title="What you cannot do">
        <List
          items={[
            "Use Paila to track applications on behalf of other people without their knowledge",
            "Attempt to reverse-engineer, scrape, or abuse the service",
            "Use automated tools to create multiple accounts",
            "Share your account with others",
          ]}
        />
      </Section>

      <Section title="No warranty">
        <p>
          Paila is provided &ldquo;as is&rdquo;, without warranty of any kind,
          express or implied. We make no guarantees about accuracy of
          classification results, uptime, data integrity, or fitness for any
          particular purpose.
        </p>
        <p>
          AI classification is imperfect. Always verify important application
          statuses directly with the employer.
        </p>
      </Section>

      <Section title="Availability and termination">
        <p>
          Because Paila is in Google&apos;s OAuth testing program, access is
          currently limited to approved test users. We may add or remove users
          from the testing group at any time.
        </p>
        <p>
          We reserve the right to suspend or terminate access for any user who
          violates these terms, or to shut down the service entirely, with or
          without notice.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the maximum extent permitted by applicable law, Paila and its
          creator shall not be liable for any indirect, incidental, or
          consequential damages arising from your use of the service, including
          loss of data.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          These terms may be updated from time to time. The &ldquo;last
          updated&rdquo; date at the top of this page reflects when changes were
          last made. Continued use of Paila after changes constitutes acceptance
          of the updated terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions?{" "}
          <a
            href="mailto:magarmahib@gmail.com"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            magarmahib@gmail.com
          </a>
        </p>
      </Section>
    </LegalLayout>
  )
}
