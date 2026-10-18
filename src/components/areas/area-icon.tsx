import { createElement } from 'react'
import { areaIconOptions } from './area-icon-options'

const iconMap = new Map(
  areaIconOptions.map((option) => [option.name, option.icon]),
)
const emojiPattern = /\p{Extended_Pictographic}/u

export function AreaIcon({
  name,
  className,
}: {
  name?: string | null
  className?: string
}) {
  if (!name) return null
  const Icon = iconMap.get(name)
  if (Icon) return createElement(Icon, { 'aria-hidden': true, className })
  if (emojiPattern.test(name))
    return (
      <span aria-hidden="true" className={className}>
        {name}
      </span>
    )
  return null
}
