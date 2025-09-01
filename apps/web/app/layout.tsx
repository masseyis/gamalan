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
  title: 'SpecMint - Salunga AI-Enhanced Agile Project Management',
  description: 'AI-enhanced agile project management tool that helps teams focus on delivering value',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  if (!publishableKey) {
    // Demo mode without authentication
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
    <ClerkProvider>
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