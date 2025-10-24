'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LegacyTeamPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/teams')
  }, [router])

  return null
}
