import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Navigation } from '@/components/navigation'
import { NavigationTest } from '@/components/navigation-test'
import { AuthProviderWrapper } from './auth-provider-wrapper'

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
  // Always use regular Navigation now that we have ClerkProvider available
  const NavigationComponent = Navigation

  return (
    <AuthProviderWrapper>
      <html lang="en">
        <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans`}>
          <Providers>
            <NavigationComponent />
            <main className="min-h-screen">
              {children}
            </main>
          </Providers>
        </body>
      </html>
    </AuthProviderWrapper>
  )
}

// Force dynamic rendering for the entire app to avoid Clerk context issues during SSR
export const dynamic = 'force-dynamic'