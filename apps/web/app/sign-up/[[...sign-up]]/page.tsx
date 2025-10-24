import { SignUp } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Join Salunga</h1>
          <p className="text-muted-foreground mt-2">
            Get started with AI-enhanced agile project management
          </p>
        </div>
        <SignUp />
      </div>
    </div>
  )
}
