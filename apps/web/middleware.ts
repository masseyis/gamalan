import { NextResponse, NextRequest } from 'next/server'

// Check if we're in test mode
const isTestMode = process.env.NODE_ENV === 'test' || process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'

let middleware: (request: NextRequest) => Promise<Response> | Response

if (isTestMode) {
  // Test mode: simple middleware that bypasses all authentication
  middleware = (request: NextRequest) => {
    return NextResponse.next()
  }
} else {
  // Production mode: use Clerk middleware
  const { clerkMiddleware, createRouteMatcher } = require('@clerk/nextjs/server')
  const isPublicRoute = createRouteMatcher(['/'])

  middleware = clerkMiddleware(async (auth: any, request: NextRequest) => {
    if (!isPublicRoute(request)) {
      await auth.protect()
    }
  })
}

export default middleware

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}