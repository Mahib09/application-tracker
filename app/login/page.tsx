"use client"
import { signIn } from "next-auth/react"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded-xl border bg-white p-10 shadow-sm text-center space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Application Tracker</h1>
        <p className="text-gray-500 text-sm">
          Automatically import and track job applications from Gmail.
        </p>
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  )
}
