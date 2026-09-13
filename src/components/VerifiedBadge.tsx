import { BadgeCheck } from 'lucide-react'

export function VerifiedBadge({ large = false }: { large?: boolean }) {
  return <span className={`verified${large ? ' large' : ''}`} role="img" aria-label="Verified by SHY Music" title="Verified by SHY Music"><BadgeCheck /></span>
}
