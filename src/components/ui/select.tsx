import type { ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Native <select> styled to match the design system. Reliable across
 * mobile/desktop and fully accessible without extra JS.
 *
 * The arrow is placed on the wrapper, so a select narrower than its parent
 * (outside a flex row) needs `containerClassName` (for example "w-fit") to
 * keep the arrow next to the text.
 */
function Select({
  className,
  containerClassName,
  children,
  ...props
}: ComponentProps<'select'> & { containerClassName?: string }) {
  return (
    <div className={cn('relative', containerClassName)}>
      <select
        data-slot="select"
        // 16px below md, so iOS doesn't zoom on focus (see input.tsx).
        className={cn(
          'flex h-9 w-full appearance-none rounded-lg border border-input bg-background pl-3 pr-8 text-base md:text-sm shadow-sm transition-colors outline-none',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export { Select }
