import { authMiddleware } from '@clerk/nextjs'
import { NextResponse } from 'next/server'

export default authMiddleware({
  publicRoutes: ['/'],
  ignoredRoutes: ['/((?!api|trpc))(_next.*|.+\\.[\\w]+$)'],
  
  beforeAuth: (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 })
      
      // Add CORS headers
      response.headers.set('Access-Control-Allow-Origin', req.headers.get('origin') || '*')
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin')
      response.headers.set('Access-Control-Allow-Credentials', 'true')
      response.headers.set('Access-Control-Max-Age', '86400')
      
      return response
    }
  },
  
  afterAuth: (auth, req) => {
    const response = NextResponse.next()
    
    // Add CORS headers to all responses
    response.headers.set('Access-Control-Allow-Origin', req.headers.get('origin') || '*')
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    
    return response
  }
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}