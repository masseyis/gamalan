import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 - Page Not Found',
  description: 'The page you are looking for could not be found.',
}

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Page Not Found</h2>
      <p style={{ marginBottom: '2rem' }}>Sorry, we could not find the page you are looking for.</p>
      <Link
        href="/"
        style={{
          padding: '10px 20px',
          backgroundColor: '#4f46e5',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '5px',
        }}
      >
        Go Home
      </Link>
    </div>
  )
}
