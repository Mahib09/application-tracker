import type { Metadata } from "next"
import LegalLayout, { Section, List } from "@/components/landing/LegalLayout"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Paila handles your data and Gmail access.",
  robots: { index: true, follow: true },
}

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="April 2026">
      <Section title="Overview">
        <p>
          Paila is a personal project that connects to your Gmail to automatically
          track job applications. This page explains exactly what data we access,
          what we store, and what we never touch. We believe you should be able
          to read this and understand it in under five minutes.
        </p>
      </Section>

      <Section title="What we collect">
        <p>When you sign in with Google, we receive and store:</p>
        <List
          items={[
            "Your Google profile: name, email address, and profile photo",
            "An OAuth refresh token, so Paila can sync your Gmail periodically without requiring you to sign in again",
            "Email subjects and sender addresses — fetched using Gmail's minimal format to identify job application replies",
            "Classified application data: company name, inferred status (Applied / Interview / Offer / Rejected / Ghosted), confidence score, and the date of each status change",
          ]}
        />
      </Section>

      <Section title="What we discard immediately">
        <p>
          Email subjects and snippets are used only for classification. Once
          Claude has returned a result, the raw subject and snippet are
          discarded — we do not store them in our database.
        </p>
        <p>
          We never store full email bodies, attachments, or any content beyond
          what is described above.
        </p>
      </Section>

      <Section title="What we never access">
        <List
          items={[
            "Full email bodies or message content",
            "Attachments of any kind",
            "Emails you have sent or drafted",
            "Your contacts or address book",
            "Any email unrelated to job applications (filtered before classification)",
            "Emails older than your configured sync window",
          ]}
        />
        <p>
          This is enforced at the API level. We request the{" "}
          <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
            gmail.readonly
          </code>{" "}
          scope with{" "}
          <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
            format: minimal
          </code>
          , which returns only headers (subject, sender, date) and a short
          snippet — it is structurally impossible to retrieve full email bodies
          through this API call.
        </p>
      </Section>

      <Section title="How long we keep data">
        <List
          items={[
            "Application records — stored until you delete your account or remove individual entries",
            "OAuth tokens — stored until you disconnect Gmail or delete your account",
            "Email subjects and snippets — discarded immediately after classification, never persisted",
            "Profile data (name, email, photo) — stored until you delete your account",
          ]}
        />
      </Section>

      <Section title="Third parties">
        <p>Your data passes through the following services:</p>
        <List
          items={[
            "Anthropic (Claude API) — email subjects and snippets are sent for classification. Anthropic does not train models on data submitted through the API.",
            "Supabase — our Postgres database host. Application data and OAuth tokens are stored here.",
            "Vercel — our hosting provider. Serves the application, does not have access to your data.",
            "Google — the OAuth provider. We use your Google account for authentication and Gmail access.",
          ]}
        />
        <p>
          We do not sell, rent, or share your data with any other third parties.
        </p>
      </Section>

      <Section title="Your rights">
        <p>You can do all of the following from the Settings page:</p>
        <List
          items={[
            "Export your data as CSV or JSON at any time",
            "Disconnect Gmail — revokes our access token and stops future syncing",
            "Delete your account — permanently removes all stored data immediately",
          ]}
        />
        <p>
          You can also revoke access directly from your Google Account at{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </Section>

      <Section title="Gmail scope justification">
        <p>
          We request{" "}
          <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
            https://www.googleapis.com/auth/gmail.readonly
          </code>{" "}
          because it is the minimum scope that allows us to list and read
          message metadata. We use{" "}
          <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
            format: minimal
          </code>{" "}
          on every request, which means Google only returns headers and a
          snippet — never the full message body.
        </p>
        <p>
          We do not request write access, send-on-behalf-of access, or any
          scope beyond read-only metadata.
        </p>
      </Section>

      <Section title="Testing mode notice">
        <p>
          Paila is currently in Google&apos;s OAuth testing program. This means
          access is limited to approved test users. Your data is handled
          identically to how it would be handled in a verified production app —
          the testing status affects who can sign in, not how data is stored or
          processed.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy or your data? Email{" "}
          <a
            href="mailto:magarmahib@gmail.com"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            magarmahib@gmail.com
          </a>
          .
        </p>
      </Section>
    </LegalLayout>
  )
}
