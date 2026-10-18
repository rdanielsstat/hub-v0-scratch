import {
  Activity,
  Anchor,
  Archive,
  Aperture,
  ArrowUpRight,
  Award,
  Bike,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  CheckSquare,
  CloudSun,
  Compass,
  Dumbbell,
  FileText,
  Flower2,
  Gift,
  Globe2,
  Heart,
  House,
  Leaf,
  Lightbulb,
  Map,
  Mountain,
  Music,
  NotebookPen,
  Palette,
  PawPrint,
  Plane,
  Rocket,
  Scissors,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Sun,
  Tag,
  Target,
  TreePine,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export const areaIconOptions: Array<{ name: string; icon: LucideIcon }> = [
  { name: 'activity', icon: Activity },
  { name: 'anchor', icon: Anchor },
  { name: 'archive', icon: Archive },
  { name: 'aperture', icon: Aperture },
  { name: 'arrowUpRight', icon: ArrowUpRight },
  { name: 'award', icon: Award },
  { name: 'bike', icon: Bike },
  { name: 'bookOpen', icon: BookOpen },
  { name: 'briefcase', icon: BriefcaseBusiness },
  { name: 'calendar', icon: CalendarDays },
  { name: 'camera', icon: Camera },
  { name: 'checkSquare', icon: CheckSquare },
  { name: 'cloudSun', icon: CloudSun },
  { name: 'compass', icon: Compass },
  { name: 'dumbbell', icon: Dumbbell },
  { name: 'fileText', icon: FileText },
  { name: 'flower', icon: Flower2 },
  { name: 'gift', icon: Gift },
  { name: 'globe', icon: Globe2 },
  { name: 'heart', icon: Heart },
  { name: 'house', icon: House },
  { name: 'leaf', icon: Leaf },
  { name: 'lightbulb', icon: Lightbulb },
  { name: 'map', icon: Map },
  { name: 'mountain', icon: Mountain },
  { name: 'music', icon: Music },
  { name: 'notebook', icon: NotebookPen },
  { name: 'palette', icon: Palette },
  { name: 'pawPrint', icon: PawPrint },
  { name: 'plane', icon: Plane },
  { name: 'rocket', icon: Rocket },
  { name: 'scissors', icon: Scissors },
  { name: 'shield', icon: Shield },
  { name: 'shoppingBag', icon: ShoppingBag },
  { name: 'sparkles', icon: Sparkles },
  { name: 'star', icon: Star },
  { name: 'sun', icon: Sun },
  { name: 'tag', icon: Tag },
  { name: 'target', icon: Target },
  { name: 'tree', icon: TreePine },
  { name: 'wallet', icon: Wallet },
]

const iconMap = new Map(areaIconOptions.map((option) => [option.name, option.icon]))
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
  if (Icon) return <Icon aria-hidden="true" className={className} />
  if (emojiPattern.test(name))
    return (
      <span aria-hidden="true" className={className}>
        {name}
      </span>
    )
  return null
}
