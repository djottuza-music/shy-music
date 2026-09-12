import { Flag, Send, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { requireSupabase } from '../lib/supabase'

type ReportTarget = 'artist' | 'album' | 'track' | 'playlist' | 'profile'

export function ReportButton({ targetType, targetId, targetName }: { targetType: ReportTarget; targetId: string; targetName: string }) {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const submit = useMutation({ mutationFn: async () => {
    const cleanReason = reason.trim()
    if (cleanReason.length < 3) throw new Error('Explain the concern in at least 3 characters.')
    const { error } = await requireSupabase().from('reports').insert({ reporter_id: auth.user?.id ?? null, target_type: targetType, target_id: targetId, reason: cleanReason })
    if (error) throw error
  } })
  const onSubmit = (event: FormEvent) => { event.preventDefault(); if (!submit.isPending) submit.mutate() }
  return <>
    <button className="button secondary" onClick={() => setOpen(true)}><Flag />Report</button>
    {open && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}><form className="modal form-stack" role="dialog" aria-modal="true" aria-labelledby="report-title" onSubmit={onSubmit}><button className="icon-button modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close report form"><X /></button><span className="eyebrow"><Flag />Content report</span><h2 id="report-title">Report {targetName}</h2><p>Describe a copyright, safety, impersonation, or inappropriate-content concern. Do not include passwords or payment PINs.</p><label>Reason<textarea rows={5} minLength={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} required /></label>{submit.error && <p className="form-message error" role="alert">{submit.error.message}</p>}{submit.isSuccess && <p className="form-message success" role="status">Report received for review.</p>}<button className="button primary" disabled={submit.isPending || submit.isSuccess}><Send />{submit.isPending ? 'Sending...' : submit.isSuccess ? 'Report sent' : 'Send report'}</button></form></div>}
  </>
}
