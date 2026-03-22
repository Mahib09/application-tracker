import { prisma } from "@/server/lib/prisma"

interface SignInParams {
  email: string
  name: string | null | undefined
  image: string | null | undefined
  accessToken: string
  refreshToken: string | null | undefined
  expiresAt: number | null | undefined
  scope: string | null | undefined
}

/**
 * Upserts the User record and stores OAuth tokens in OauthToken.
 * Returns false (blocks sign-in) if no refresh token is present.
 * A missing refresh token means the user previously consented but didn't
 * re-consent — they must sign out and sign in again with prompt:'consent'.
 */
export async function handleSignIn(params: SignInParams): Promise<boolean> {
  if (!params.refreshToken) return false

  const dbUser = await prisma.user.upsert({
    where: { email: params.email },
    update: { name: params.name, image: params.image },
    create: { email: params.email, name: params.name, image: params.image },
  })

  await prisma.oauthToken.upsert({
    where: { userId: dbUser.id },
    update: {
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      expiresAt: params.expiresAt ? new Date(params.expiresAt * 1000) : null,
      scope: params.scope,
    },
    create: {
      userId: dbUser.id,
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      expiresAt: params.expiresAt ? new Date(params.expiresAt * 1000) : null,
      scope: params.scope,
    },
  })

  return true
}
