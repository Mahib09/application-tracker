import { ChevronDown } from "lucide-react"
import SectionHeader from "./SectionHeader"
import { FAQ_ITEMS } from "@/lib/landing/content"

export default function FAQSection() {
  return (
    <section id="faq" className="py-24 lg:py-32 bg-background">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <SectionHeader
          number="06"
          title="Questions"
          subtitle="Most of what people ask before signing in."
        />

        <div className="w-full divide-y divide-border">
          {FAQ_ITEMS.map(({ q, a }) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="text-base font-medium text-foreground">{q}</span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed pr-8">
                {a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
