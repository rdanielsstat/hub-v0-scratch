import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Menu, Moon, PanelLeft, Sun } from 'lucide-react'
import { useAuth } from '@/use-auth'
import { Button } from '@/components/ui/button'
import { setStoredTheme, updateThemeColorMeta } from '@/lib/theme'

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); updateThemeColorMeta() }, [dark])
  function toggle() { setDark((previous) => { const next = !previous; setStoredTheme(next ? 'dark' : 'light'); return next }) }
  return { dark, toggle }
}

export function AppHeader({ onCapture, onToggleSidebar = () => {}, onOpenMobileMenu = () => {} }: { onCapture: () => void; onToggleSidebar?: () => void; onOpenMobileMenu?: () => void }) {
  const { dark, toggle } = useTheme()
  const { user, logout } = useAuth()
  return <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-md">
    <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
      <Button variant="ghost" size="icon-sm" onClick={onToggleSidebar} aria-label="Toggle sidebar" className="hidden md:inline-flex"><PanelLeft /></Button>
      <Button variant="ghost" size="icon-sm" onClick={onOpenMobileMenu} aria-label="Open navigation" className="md:hidden"><Menu /></Button>
      <Link to="/" className="text-base font-semibold tracking-tight">hub</Link>
      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>{dark ? <Sun /> : <Moon />}</Button>
        <Button size="sm" onClick={onCapture}>Quick capture</Button>
        <details className="relative ml-1 border-l border-border pl-2">
          <summary className="max-w-32 cursor-pointer list-none truncate rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{user?.displayName || user?.email || 'Account'}</summary>
          <div className="absolute right-0 top-full z-40 mt-2 min-w-40 rounded-lg border border-border bg-popover p-1 shadow-lg">
            <button onClick={logout} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted"><LogOut className="size-4" />Sign out</button>
          </div>
        </details>
      </div>
    </div>
  </header>
}
