import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="text-center space-y-8 max-w-4xl mx-auto">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
            Welcome to <span className="text-primary">Battra AI</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI-Enhanced Agile Project Management. Transform your development workflow with
            intelligent story management, automated readiness checks, and smart prompt generation.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/assistant" prefetch={false}>
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3">
              Start with AI Assistant
            </Button>
          </Link>
          <Link href="/dashboard" prefetch={false}>
            <Button variant="outline" size="lg" className="px-8 py-3">
              Go to Dashboard
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Story Management</h3>
            <p className="text-gray-600">
              Create, organize, and track user stories with AI-powered assistance and automated
              readiness validation.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Intelligent Prompts</h3>
            <p className="text-gray-600">
              Generate contextual prompts for development tasks with our AI-powered prompt builder.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Seamless Integration</h3>
            <p className="text-gray-600">
              Connect your development workflow with GitHub integration and automated CI/CD
              insights.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
