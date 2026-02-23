'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../lib/auth'
import aimlApi from '../../../lib/aiml/api'
import dsaApi from '../../../lib/dsa/api'

export default function TestEditResolverPage() {
  const router = useRouter()
  const { id } = router.query
  const testId = typeof id === 'string' ? id : null
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!testId) return

    let cancelled = false

    const resolve = async () => {
      try {
        // Prefer AIML if it exists
        await aimlApi.get(`/tests/${testId}`)
        if (!cancelled) router.replace(`/aiml/tests/${testId}/edit`)
        return
      } catch (e) {
        // ignore and try DSA
      }

      try {
        await dsaApi.get(`/tests/${testId}`)
        if (!cancelled) router.replace(`/dsa/tests/${testId}/edit`)
        return
      } catch (e) {
        // fall through
      }

      if (!cancelled) setError('Test not found or you do not have access.')
    }

    resolve()

    return () => {
      cancelled = true
    }
  }, [router, testId])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          {error ? 'Unable to open test editor' : 'Opening editor...'}
        </div>
        {error && <div style={{ color: '#64748b' }}>{error}</div>}
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = requireAuth


