import Link from "next/link"
import { FOOTER_LINKS } from "@/lib/landing/content"

export default function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-[#0A0A0B] text-white border-t border-white/6">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16">
        {/* Main grid */}
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <p className="text-base font-semibold tracking-tight text-white">Paila</p>
            <p className="mt-2 text-sm text-white/40 leading-relaxed max-w-xs">
              The application tracker that tracks itself.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/40">
              <span className="size-1.5 rounded-full bg-amber-400" />
              Google OAuth testing — invite only
            </span>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
              Product
            </p>
            <ul className="space-y-2.5">
              {FOOTER_LINKS.product.map(({ label, href }) => (
                <li key={href}>
                  <a
                    href={href}
                    className="text-sm text-white/50 hover:text-white/80 transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
              Legal
            </p>
            <ul className="space-y-2.5">
              {FOOTER_LINKS.legal.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-white/50 hover:text-white/80 transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* More */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
              More
            </p>
            <ul className="space-y-2.5">
              {FOOTER_LINKS.more.map(({ label, href }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/50 hover:text-white/80 transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-6 border-t border-white/6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-white/25">
            © {year} Paila. Built by{" "}
            <a
              href="https://github.com/Mahib09"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white/50 transition-colors"
            >
              @Mahib09
            </a>
            .
          </p>
          <p className="text-xs text-white/20">
            Personal project · Not affiliated with Google, Anthropic, or Supabase
          </p>
        </div>
      </div>
    </footer>
  )
}
