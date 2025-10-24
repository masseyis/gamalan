export function SalungaNavigation() {
  return (
    <nav className="bg-salunga-bg border-b border-salunga-border shadow-salunga-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src="/logo-icon.png" alt="Salunga" className="h-8 w-8" />
            <span className="text-xl font-salunga-heading font-bold text-salunga-fg">Salunga</span>
          </div>

          {/* Navigation Menu */}
          <div className="hidden md:flex items-center gap-6">
            <a
              href="#"
              className="text-salunga-fg-secondary hover:text-salunga-primary font-medium transition-colors"
            >
              Dashboard
            </a>
            <a
              href="#"
              className="text-salunga-fg-secondary hover:text-salunga-primary font-medium transition-colors"
            >
              Projects
            </a>
            <a
              href="#"
              className="text-salunga-fg-secondary hover:text-salunga-primary font-medium transition-colors"
            >
              Team
            </a>
            <a
              href="#"
              className="text-salunga-fg-secondary hover:text-salunga-primary font-medium transition-colors"
            >
              Reports
            </a>
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-3">
            <button className="p-2 text-salunga-fg-muted hover:text-salunga-fg hover:bg-salunga-bg-muted rounded-salunga-md transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-5 5-5-5h5v-12h5v12z"
                />
              </svg>
            </button>
            <button className="p-2 text-salunga-fg-muted hover:text-salunga-fg hover:bg-salunga-bg-muted rounded-salunga-md transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-5 5-5-5h5v-12h5v12z"
                />
              </svg>
            </button>

            {/* User Avatar */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-salunga-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
                JD
              </div>
              <span className="hidden sm:block text-sm font-medium text-salunga-fg">John Doe</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
