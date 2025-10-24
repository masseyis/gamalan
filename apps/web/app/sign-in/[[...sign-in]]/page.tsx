import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Welcome to Salunga</h1>
          <p className="text-muted-foreground mt-2">AI-Enhanced Agile Project Management</p>
        </div>
        <SignIn />
      </div>
    </div>
  )
}
