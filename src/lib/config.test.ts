import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadConfig() {
  vi.resetModules()
  return import('./config')
}

async function loadApiBaseUrl(): Promise<string> {
  return (await loadConfig()).API_BASE_URL
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('API_BASE_URL', () => {
  it('defaults to same-origin /api when VITE_API_BASE_URL is absent', async () => {
    vi.stubEnv('VITE_API_BASE_URL', undefined)

    expect(await loadApiBaseUrl()).toBe('/api')
  })

  it('falls back to /api when VITE_API_BASE_URL is set but empty', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')

    expect(await loadApiBaseUrl()).toBe('/api')
  })

  it('uses VITE_API_BASE_URL when set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')

    expect(await loadApiBaseUrl()).toBe('http://localhost:8000')
  })
})

describe('USE_MOCK_API', () => {
  it('uses mock mode in development when no backend URL is configured', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_API_BASE_URL', undefined)
    vi.stubEnv('VITE_API_MODE', undefined)

    expect((await loadConfig()).USE_MOCK_API).toBe(true)
  })

  it('uses the real API when a local backend URL is configured', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    vi.stubEnv('VITE_API_MODE', undefined)

    expect((await loadConfig()).USE_MOCK_API).toBe(false)
  })

  it('allows an explicit mode to override the development default', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_API_MODE', 'real')

    expect((await loadConfig()).USE_MOCK_API).toBe(false)
  })
})
