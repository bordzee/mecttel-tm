import { useEffect, useRef, useState } from 'react'

/** Keep loading UI visible for at least `minMs` to avoid flash on fast fetches. */
export function useMinLoading(loading: boolean, minMs = 220): boolean {
  const [visible, setVisible] = useState(loading)
  const loadStartedAt = useRef<number | null>(loading ? Date.now() : null)

  useEffect(() => {
    if (loading) {
      loadStartedAt.current = Date.now()
      setVisible(true)
      return
    }

    if (loadStartedAt.current == null) {
      setVisible(false)
      return
    }

    const elapsed = Date.now() - loadStartedAt.current
    const remaining = minMs - elapsed

    if (remaining <= 0) {
      loadStartedAt.current = null
      setVisible(false)
      return
    }

    const timer = window.setTimeout(() => {
      loadStartedAt.current = null
      setVisible(false)
    }, remaining)

    return () => window.clearTimeout(timer)
  }, [loading, minMs])

  return visible
}
