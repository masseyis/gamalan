export type DisplayNameOptions = {
  name?: string | null
  email?: string | null
  role?: string | null
  id?: string | null
}

const ROLE_BASE_NAMES: Record<string, string> = {
  product_owner: 'Pat Product Owner',
  managing_contributor: 'Morgan Mentor',
  contributor: 'Casey Contributor',
  sponsor: 'Alex Sponsor',
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function deriveFromEmail(email?: string | null): string | undefined {
  if (!email) return undefined
  const localPart = email.split('@')[0]
  if (!localPart) return undefined
  const cleaned = localPart.replace(/[._\-+]+/g, ' ').trim()
  if (!cleaned) return undefined
  return titleCase(cleaned)
}

function suffixFromIdentifier(identifier?: string | null): string | undefined {
  if (!identifier) return undefined
  const alphanumeric = identifier.replace(/[^0-9a-zA-Z]/g, '')
  if (!alphanumeric) return undefined
  const suffix = alphanumeric.slice(-4).toUpperCase()
  return suffix || undefined
}

export function formatUserDisplayName({ name, email, role, id }: DisplayNameOptions): string {
  let base = name?.trim()

  if (!base || base.length === 0) {
    base = deriveFromEmail(email)
  }

  if (!base || base.length === 0) {
    base = ROLE_BASE_NAMES[role ?? ''] ?? 'Team Member'
  }

  const suffix = suffixFromIdentifier(id ?? email)
  if (suffix) {
    return `${base} · ${suffix}`
  }

  return base
}

export function getInitials(displayName: string): string {
  const tokens = displayName
    .split(/\s+|·/)
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length === 0) {
    return 'U'
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase()
  }

  return (tokens[0][0] + tokens[1][0]).toUpperCase()
}
