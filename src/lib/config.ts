/**
 * Backend base URL, in one place so the api layer never hardcodes it.
 * Defaults to same-origin `/api`: in AWS, CloudFront serves the site and
 * forwards /api/* to the API, so one build works in every environment.
 * Set VITE_API_BASE_URL (see .env.example) to talk to a local uvicorn
 * directly. An empty value counts as unset.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api'

/**
 * Use in-memory demo data in Vite development previews unless a backend URL
 * is configured. VITE_API_MODE can explicitly select either implementation.
 */
export const USE_MOCK_API: boolean = import.meta.env.VITE_API_MODE
  ? import.meta.env.VITE_API_MODE === 'mock'
  : import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL
