import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/'])

// Check if we're in test mode
const isTestMode = () => {
  return process.env.NODE_ENV === 'test' ||
         process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'
}

export default clerkMiddleware(async (auth, request) => {
  // In test mode, bypass Clerk authentication
  if (isTestMode()) {
    return NextResponse.next()
  }

  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}