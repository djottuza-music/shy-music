import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, type ReactNode } from 'react'

export function Shelf({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (direction: number) => ref.current?.scrollBy({ left: direction * Math.max(280, ref.current.clientWidth * 0.75), behavior: 'smooth' })
  return <section className={`shelf-section ${className}`.trim()}>
    <div className="section-heading"><h2>{title}</h2>{action}</div>
    <div className="shelf-frame">
      <button className="shelf-arrow shelf-arrow-left" onClick={() => move(-1)} aria-label={`Scroll ${title} left`}><ChevronLeft /></button>
      <div className="shelf" ref={ref}>{children}</div>
      <button className="shelf-arrow shelf-arrow-right" onClick={() => move(1)} aria-label={`Scroll ${title} right`}><ChevronRight /></button>
    </div>
  </section>
}
