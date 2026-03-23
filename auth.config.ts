import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

// Edge-safe config — no Prisma, no Node.js-only modules.
// Used by proxy.ts (runs in Edge Runtime) and spread into auth.ts (Node.js).
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
}
