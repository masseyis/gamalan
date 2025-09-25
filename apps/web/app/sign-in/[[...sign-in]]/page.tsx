'use client'

import { SignIn } from '@clerk/nextjs'

export default function Page() {
  const isTestMode = process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Welcome to Salunga</h1>
          <p className="text-muted-foreground mt-2">
            AI-Enhanced Agile Project Management
          </p>
        </div>
        {isTestMode ? (
          <div data-testid="sign-in-form" className="bg-card p-6 rounded-lg border">
            <h2 className="text-xl font-semibold mb-4">Sign In (Test Mode)</h2>
            <form onSubmit={(e) => {
              e.preventDefault()
              // In test mode, just redirect to dashboard
              window.location.href = '/dashboard'
            }}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    defaultValue="test@example.com"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    readOnly
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    defaultValue="testpassword123"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    readOnly
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90"
                >
                  Sign In
                </button>
              </div>
            </form>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Test mode - authentication is mocked
            </p>
          </div>
        ) : (
          <SignIn />
        )}
      </div>
    </div>
  )
}