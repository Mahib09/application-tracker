import { auth } from "@/server/auth"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-gray-500 mt-1">Welcome, {session.user.name}</p>
      <p className="text-xs text-gray-400 mt-1">User ID: {session.user.id}</p>
    </main>
  )
}
