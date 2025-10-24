'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function SpecMintHero() {
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    const code = `@Test
public void testCreateUser_ValidInput() {
    User user = new User("john.doe@example.com", "John Doe");
    
    given()
        .contentType(ContentType.JSON)
        .body(user)
    .when()
        .post("/api/users")
    .then()
        .statusCode(201)
        .body("email", equalTo("john.doe@example.com"));
}`

    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white relative overflow-hidden">
      {/* Subtle spotlight effect */}
      <div className="absolute inset-0 bg-gradient-radial from-teal-500/10 via-transparent to-transparent opacity-50 blur-3xl"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            {/* Eyebrow */}
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20">
              <span className="text-teal-400 text-sm font-medium">OpenAPI → Runnable Tests</span>
            </div>

            {/* Headline */}
            <div className="space-y-6">
              <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-white via-gray-100 to-teal-200 bg-clip-text text-transparent">
                  Mint test cases
                </span>
                <br />
                <span className="text-white">from your API spec.</span>
              </h1>

              {/* Subhead */}
              <p className="text-xl lg:text-2xl text-gray-300 leading-relaxed max-w-2xl">
                SpecMint turns OpenAPI into valid, boundary, and negative cases plus JUnit, Postman,
                WireMock, and CSV/SQL artifacts.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-4 text-lg font-semibold rounded-2xl shadow-lg hover:shadow-teal-500/25 transition-all duration-200 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-gray-950"
                aria-label="Generate test data from your OpenAPI specification"
              >
                Generate test data
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent px-8 py-4 text-lg font-semibold rounded-2xl hover:border-gray-500 transition-all duration-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-950"
                aria-label="View SpecMint documentation"
              >
                View docs
              </Button>
            </div>

            {/* Support text */}
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
              Works with OpenAPI 3.0/3.1 · Exports JUnit/REST Assured, Postman, WireMock
            </p>
          </div>

          {/* Right Content - Code Block */}
          <div className="lg:pl-8">
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
              {/* Code header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/50">
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <span className="text-sm text-gray-400 font-mono">UserApiTest.java</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyCode}
                  className="text-gray-400 hover:text-white hover:bg-gray-800 p-2 rounded-lg transition-colors focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                  aria-label="Copy code to clipboard"
                >
                  {copied ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </Button>
              </div>

              {/* Code content */}
              <div className="p-6 font-mono text-sm leading-relaxed overflow-x-auto">
                <pre className="text-gray-300">
                  <span className="text-purple-400">@Test</span>
                  {'\n'}
                  <span className="text-blue-400">public void</span>{' '}
                  <span className="text-yellow-400">testCreateUser_ValidInput</span>() {'{'}
                  {'\n    '}
                  <span className="text-blue-400">User</span> user ={' '}
                  <span className="text-blue-400">new</span>{' '}
                  <span className="text-yellow-400">User</span>(
                  <span className="text-green-400">"john.doe@example.com"</span>,{' '}
                  <span className="text-green-400">"John Doe"</span>);
                  {'\n    '}
                  {'\n    '}
                  <span className="text-yellow-400">given</span>()
                  {'\n        '}.<span className="text-yellow-400">contentType</span>(
                  <span className="text-blue-400">ContentType</span>.
                  <span className="text-teal-400">JSON</span>){'\n        '}.
                  <span className="text-yellow-400">body</span>(user)
                  {'\n    '}.<span className="text-yellow-400">when</span>()
                  {'\n        '}.<span className="text-yellow-400">post</span>(
                  <span className="text-green-400">"/api/users"</span>){'\n    '}.
                  <span className="text-yellow-400">then</span>()
                  {'\n        '}.<span className="text-yellow-400">statusCode</span>(
                  <span className="text-orange-400">201</span>){'\n        '}.
                  <span className="text-yellow-400">body</span>(
                  <span className="text-green-400">"email"</span>,{' '}
                  <span className="text-yellow-400">equalTo</span>(
                  <span className="text-green-400">"john.doe@example.com"</span>));
                  {'\n'}
                  {'}'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
