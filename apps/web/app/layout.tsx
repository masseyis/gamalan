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
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const isTestMode = process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'

  // In test mode, don't use ClerkProvider to avoid validation errors
  if (isTestMode) {
    return (
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
    )
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      domain={undefined}
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