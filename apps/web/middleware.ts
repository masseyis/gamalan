import { NextResponse, NextRequest } from 'next/server'

// Check if we're in test mode
const isTestMode = () => {
  return process.env.NODE_ENV === 'test' ||
         process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'
}

// Test mode: simple middleware that bypasses all authentication
if (isTestMode()) {
  // Export a simple pass-through middleware for test mode
  const middleware = (request: NextRequest) => {
    return NextResponse.next()
  }
  export default middleware
} else {
  // Production mode: use Clerk middleware
  const { clerkMiddleware, createRouteMatcher } = require('@clerk/nextjs/server')
  const isPublicRoute = createRouteMatcher(['/'])

  const middleware = clerkMiddleware(async (auth: any, request: NextRequest) => {
    if (!isPublicRoute(request)) {
      await auth.protect()
    }
  })

  export default middleware
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}