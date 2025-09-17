import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import { Providers } from './providers'
import { Navigation } from '@/components/navigation'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap'
})

export const metadata: Metadata = {
  title: 'Battra AI - AI-Enhanced Agile Project Management',
  description: 'AI-enhanced agile project management tool that brings powerful intelligence and bold design to modern development teams',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fixed middleware configuration
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      clerkJSUrl="https://clerk.battra.penchi.co.uk/npm/@clerk/clerk-js@4/dist/clerk.browser.js"
    >
      <html lang="en">
        <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans`}>
          <Providers>
            <Navigation />
            <main className="min-h-screen">
              {children}
            </main>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}

// Force dynamic rendering for the entire app to avoid Clerk context issues during SSR
export const dynamic = 'force-dynamic'