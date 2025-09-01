import { authMiddleware } from '@clerk/nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Check if Clerk is configured
const hasClerkKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY

export default function middleware(request: NextRequest) {
  if (!hasClerkKeys) {
    // Demo mode - allow all routes without authentication
    return NextResponse.next()
  }

  // Use Clerk authentication
  return authMiddleware({
    // Routes that can be accessed while signed out
    publicRoutes: ['/'],
    // Routes that can always be accessed, and have
    // no authentication information
    ignoredRoutes: ['/api/webhooks(.*)'],
  })(request, {} as any)
}

export const config = {
  // Protects all routes, including api/trpc.
  // See https://clerk.com/docs/references/nextjs/auth-middleware
  // for more information about configuring your Middleware
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}