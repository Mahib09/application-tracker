import LandingNav from "./LandingNav"
import LandingFooter from "./LandingFooter"

export default function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />

      <main className="mx-auto max-w-2xl px-6 pt-36 pb-24">
        <div className="mb-10">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/50 mb-3">
            Legal
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated {lastUpdated}</p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-foreground">
          {children}
        </div>
      </main>

      <LandingFooter />
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground border-b border-border pb-2">
        {title}
      </h2>
      <div className="space-y-3 text-muted-foreground">{children}</div>
    </section>
  )
}

export function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 pl-4">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="mt-2 size-1 rounded-full bg-muted-foreground/40 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
