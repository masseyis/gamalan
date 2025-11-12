import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-salunga-bg flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-salunga-fg mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-salunga-fg-secondary mb-4">Page Not Found</h2>
        <p className="text-salunga-fg-muted mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-salunga-primary text-white rounded-salunga-md hover:bg-salunga-primary-hover transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
