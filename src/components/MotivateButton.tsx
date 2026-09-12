import { Check, Copy, Smartphone, X } from 'lucide-react'
import { useState } from 'react'

export function MotivateButton({ artistName, phone }: { artistName: string; phone: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(phone)
    setCopied(true)
  }
  return <>
    <button className="button secondary" onClick={() => setOpen(true)}><Smartphone />Motivate artist</button>
    {open && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="motivate-title">
        <button className="icon-button modal-close" onClick={() => setOpen(false)} aria-label="Close motivation details"><X /></button>
        <span className="eyebrow"><Smartphone />Mobile money</span>
        <h2 id="motivate-title">Motivate {artistName}</h2>
        <p>Send your support directly using the artist's mobile money number.</p>
        <div className="copy-field"><strong>{phone}</strong><button className="button secondary" onClick={copy}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy number'}</button></div>
      </section>
    </div>}
  </>
}
