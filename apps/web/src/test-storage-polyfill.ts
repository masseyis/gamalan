// Ensure test environment provides a functional Storage implementation before other modules run
if (typeof window !== 'undefined') {
  const createStorage = () => {
    let store: Record<string, string> = {}

    return {
      getItem: (key: string) => (key in store ? store[key] : null),
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        store = {}
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
      get length() {
        return Object.keys(store).length
      },
    }
  }

  const ensureStorage = (property: 'localStorage' | 'sessionStorage') => {
    const current = window[property] as Storage | undefined

    if (!current || typeof current.getItem !== 'function') {
      Object.defineProperty(window, property, {
        value: createStorage(),
        configurable: true,
      })
    }
  }

  ensureStorage('localStorage')
  ensureStorage('sessionStorage')
}

export {}
