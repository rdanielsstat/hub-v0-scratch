import { useCallback, useEffect, useState } from 'react'

export function useApiResource<T>(loader: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | undefined>()
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await loader())
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error('Unable to load data'))
    } finally {
      setLoading(false)
    }
  }, [loader])
  useEffect(() => {
    let active = true
    void loader()
      .then((result) => {
        if (active) {
          setData(result)
          setError(null)
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught : new Error('Unable to load data'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [loader, key])
  return { data, error, loading, refresh, setData }
}
