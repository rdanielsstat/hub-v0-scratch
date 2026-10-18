import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loader2, WifiOff } from 'lucide-react'
import { useAuth } from '@/use-auth'
import { StoreProvider } from '@/store'
import { AppHeader } from '@/components/layout/app-header'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { ErrorBoundary } from '@/components/error-boundary'
import { QuickCaptureDialog } from '@/components/quick-capture-dialog'
import { Toaster } from '@/components/ui/toaster'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { DashboardPage } from '@/pages/dashboard'
import { ProjectDetailPage } from '@/pages/project-detail'
import { NotFoundPage } from '@/pages/not-found'
import { LoginPage } from '@/pages/login'
import { SignupPage } from '@/pages/signup'

const AreaPage = lazy(() =>
  import('@/pages/area-page').then((module) => ({ default: module.AreaPage })),
)
const CollectionPage = lazy(() =>
  import('@/pages/collection-page').then((module) => ({
    default: module.CollectionPage,
  })),
)
const AreasDashboardPage = lazy(() =>
  import('@/pages/areas-dashboard').then((module) => ({
    default: module.AreasDashboardPage,
  })),
)

export function App() {
  const { status, retry } = useAuth()
  return (
    <ErrorBoundary>
      {status === 'loading' ? (
        <div className="grid min-h-dvh place-items-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : status === 'unreachable' ? (
        <div className="grid min-h-dvh place-items-center px-4">
          <EmptyState
            variant="page"
            icon={WifiOff}
            tone="danger"
            title="Can’t reach the server"
            message="Hub couldn’t check your session. Check your connection, then try again."
            action={
              <Button size="lg" onClick={retry}>
                Try again
              </Button>
            }
          />
        </div>
      ) : status === 'unauthenticated' ? (
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="*" element={<LoginPage />} />
        </Routes>
      ) : (
        <StoreProvider>
          <AuthenticatedApp />
        </StoreProvider>
      )}
      <Toaster />
    </ErrorBoundary>
  )
}

function readSidebarPreference() {
  try {
    return localStorage.getItem('hub-sidebar-hidden') !== 'true'
  } catch {
    return true
  }
}

function AuthenticatedApp() {
  const [captureOpen, setCaptureOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarPreference)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    try {
      localStorage.setItem('hub-sidebar-hidden', sidebarOpen ? 'false' : 'true')
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
  }, [sidebarOpen])
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        setSidebarOpen((open) => !open)
      }
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  const areaMatch = location.pathname.match(/^\/area\/([^/]+)/)
  const defaultAreaId = areaMatch?.[1]

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader
        onCapture={() => setCaptureOpen(true)}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onOpenMobileMenu={() => setMobileOpen(true)}
      />
      {mobileOpen ? (
        <AppSidebar mobile open onClose={() => setMobileOpen(false)} />
      ) : null}
      <div className="flex min-h-[calc(100dvh-3.5rem)]">
        <div className="hidden md:block">
          <AppSidebar open={sidebarOpen} />
        </div>
        <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <Suspense
              fallback={
                <div className="grid min-h-56 place-items-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  <span className="sr-only">Loading area</span>
                </div>
              }
            >
              <Routes>
                <Route
                  path="/"
                  element={
                    <DashboardPage onCapture={() => setCaptureOpen(true)} />
                  }
                />
                <Route path="/areas" element={<AreasDashboardPage />} />
                <Route
                  path="/area/:areaId/collection/:collectionId"
                  element={<CollectionPage />}
                />
                <Route
                  path="/area/:areaId"
                  element={<AreaPage onCapture={() => setCaptureOpen(true)} />}
                />
                <Route path="/project/:id" element={<ProjectDetailPage />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/signup" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
      <QuickCaptureDialog
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        defaultAreaId={defaultAreaId}
      />
    </div>
  )
}
