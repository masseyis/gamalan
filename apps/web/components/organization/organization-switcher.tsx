'use client'

import { OrganizationSwitcher as ClerkOrganizationSwitcher } from '@clerk/nextjs'

export function OrganizationSwitcher() {
  return (
    <ClerkOrganizationSwitcher
      appearance={{
        elements: {
          organizationSwitcherTrigger:
            'border border-border/60 bg-card hover:bg-card/80 transition-colors',
        },
      }}
      hidePersonal={false}
      afterCreateOrganizationUrl="/team"
      afterLeaveOrganizationUrl="/assistant"
    />
  )
}
