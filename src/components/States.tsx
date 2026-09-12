import { AlertTriangle, LoaderCircle, Music2 } from 'lucide-react'

export function LoadingState({ label = 'Loading SHY...' }: { label?: string }) {
  return <div className="state"><LoaderCircle className="spin" aria-hidden="true" /><span>{label}</span></div>
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return <div className="state state-card"><Music2 aria-hidden="true" /><strong>{title}</strong>{text && <span>{text}</span>}</div>
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  return <div className="state state-card error-state"><AlertTriangle aria-hidden="true" /><strong>Could not load this page</strong><span>{message}</span>{retry && <button className="button secondary" onClick={retry}>Try again</button>}</div>
}

export function Cover({ src, alt, className = '' }: { src?: string | null; alt: string; className?: string }) {
  if (src) return <img className={`cover ${className}`} src={src} alt={alt} loading="lazy" />
  return <div className={`cover cover-fallback ${className}`} role="img" aria-label={`${alt} cover`}><span>SHY</span></div>
}
