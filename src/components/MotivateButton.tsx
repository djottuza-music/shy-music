import { Check, Copy, Gift, Smartphone, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'

export function MotivateButton({ artistName, phone, artistId }: { artistName: string; phone: string; artistId?: string }) {
  const auth = useAuth()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)
  const copy = async () => {
    await navigator.clipboard.writeText(phone)
    setCopied(true)
    showToast('Mobile money number copied.', 'success')
    window.setTimeout(() => setCopied(false), 2000)
  }
  const show = () => {
    setOpen(true)
    if (artistId && auth.user && supabase) void supabase.rpc('record_motivation_click', { p_artist_id: artistId })
  }
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const opener = openerRef.current
    const dialog = dialogRef.current
    dialog?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); (previous ?? opener)?.focus() }
  }, [open])
  return <>
    <button ref={openerRef} className="button gradient motivate-button" onClick={show}><Gift />Motivate Artist</button>
    {open && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="motivate-title">
        <span className="modal-drag-handle" aria-hidden="true" />
        <button className="icon-button modal-close" onClick={() => setOpen(false)} aria-label="Close motivation details"><X /></button>
        <span className="eyebrow"><Smartphone />Mobile money</span>
        <h2 id="motivate-title">Motivate {artistName}</h2>
        <p>Send your support directly using the artist's mobile money number.</p>
        <div className="copy-field"><strong>{phone}</strong><button className={`button secondary ${copied ? 'copied' : ''}`} onClick={copy}>{copied ? <Check /> : <Copy />}{copied ? 'Copied ✓' : 'Copy number'}</button></div>
      </section>
    </div>}
  </>
}
