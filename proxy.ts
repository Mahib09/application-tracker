import NextAuth from "next-auth"
import { authConfig } from "./server/auth.config"
import { NextResponse } from "next/server"

// proxy.ts is the Next.js 16 replacement for middleware.ts.
// Must only import edge-compatible modules — no Prisma, no Node.js built-ins.
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isAuthenticated = !!req.auth
  if (req.nextUrl.pathname.startsWith("/dashboard") && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.url))
  }
  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
