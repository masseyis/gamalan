import { redirect } from 'next/navigation'

function getAuthSafe() {
  try {
    if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      const { auth } = require('@clerk/nextjs')
      return auth()
    }
    // Demo mode - simulate authenticated user
    return { userId: 'demo-user' }
  } catch {
    return { userId: 'demo-user' }
  }
}

export default function Home() {
  const { userId } = getAuthSafe()

  if (!userId && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    redirect('/sign-in')
  }

  // Redirect to AI-first Assistant interface
  redirect('/assistant')
}