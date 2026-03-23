import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { prisma } from "@/server/lib/prisma"
import { handleSignIn } from "@/server/services/auth.service"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false
      return handleSignIn({
        email: user.email!,
        name: user.name,
        image: user.image,
        accessToken: account.access_token!,
        refreshToken: account.refresh_token,
        expiresAt: account.expires_at,
        scope: account.scope,
      })
    },
    async jwt({ token, user }) {
      // On first sign-in, user.email is available — resolve DB userId
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true },
        })
        if (dbUser) token.userId = dbUser.id
      }
      return token
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string
      return session
    },
  },
})
