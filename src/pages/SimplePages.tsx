import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Send, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { requireSupabase } from '../lib/supabase'
import { LoadingState } from '../components/States'

export function LegalPage() {
  return <article className="prose-page"><h1>SHY terms and privacy</h1><p>These notes describe how this version of SHY Music currently works. They are a product summary, not a substitute for professional legal advice.</p><h2>Music and ownership</h2><p>Artists keep ownership of music they upload. By publishing a release, an artist confirms they have permission to host, stream, and offer that music through SHY. Uploading material that infringes another person’s rights is not allowed.</p><h2>Listening and downloads</h2><p>Published music can be streamed. Downloads are free when the artist has enabled them. Private, scheduled, archived, and download-disabled files remain restricted. A download record is created when SHY issues a protected download link; SHY cannot confirm that every device finished saving the file.</p><h2>Accounts and activity</h2><p>SHY uses Supabase for authentication, database storage, and media storage. It keeps profile details, saved music, follows, qualified playback events, download events, notifications, support requests, and safety reports needed to operate the service. A qualified play is counted after meaningful listening and is limited to reduce obvious repeated counting.</p><h2>Platform safety</h2><p>Do not manipulate listening statistics, attempt to access private files, impersonate another person, harass users, or interfere with the service. Administrators may restrict accounts or catalogue content to investigate safety, copyright, or security concerns.</p><h2>Support, reports, and deletion</h2><p>Use the in-app support page for technical, account, safety, or copyright concerns. Signed-in members can request account deletion from Account settings. Requests remain visible to restricted administrators until reviewed and completed. Removing an account may also remove its profile and owned catalogue, so deletion is not performed automatically without review.</p><h2>Missing legal details</h2><p>SHY has not published a registered company name, business address, governing jurisdiction, formal response-time promise, or verified copyright-agent details. Those facts must be supplied and professionally reviewed before these notes become final commercial terms.</p></article>
}

export function SupportPage() {
  const auth = useAuth()
  const [form, setForm] = useState({ email: auth.user?.email ?? '', category: 'technical', subject: '', message: '' })
  const submit = useMutation({ mutationFn: async () => {
    const { data, error } = await requireSupabase().rpc('submit_support_request', { p_email: form.email.trim(), p_category: form.category, p_subject: form.subject.trim(), p_message: form.message.trim() })
    if (error) throw error
    return String(data)
  } })
  const onSubmit = (event: FormEvent) => { event.preventDefault(); if (!submit.isPending) submit.mutate() }
  return <div className="support-layout"><article className="prose-page"><span className="eyebrow">Help and safety</span><h1>Talk to SHY support</h1><p>Send account, artist, technical, safety, or copyright concerns to the restricted support queue. Include the song, album, artist, or page link when relevant.</p><h2>Before sending</h2><p>For sign-in problems, try password recovery on the sign-in page. For playback, confirm another song works and include your device type. Never include a password, verification code, payment PIN, or private key.</p></article><form className="dashboard-panel form-stack" onSubmit={onSubmit}><label>Contact email<input type="email" required value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} /></label><label>Category<select value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))}><option value="technical">Technical problem</option><option value="account">Account access</option><option value="artist">Artist tools</option><option value="copyright">Copyright complaint</option><option value="safety">Safety report</option><option value="other">Something else</option></select></label><label>Subject<input required minLength={3} maxLength={120} value={form.subject} onChange={(event) => setForm((value) => ({ ...value, subject: event.target.value }))} /></label><label>What happened?<textarea required minLength={10} maxLength={3000} rows={7} value={form.message} onChange={(event) => setForm((value) => ({ ...value, message: event.target.value }))} /></label>{submit.error && <p className="form-message error" role="alert">{submit.error.message}</p>}{submit.isSuccess && <p className="form-message success" role="status">Request received. Reference: {submit.data}</p>}<button className="button primary" disabled={submit.isPending || submit.isSuccess}><Send />{submit.isPending ? 'Sending...' : submit.isSuccess ? 'Request sent' : 'Send request'}</button></form></div>
}

export function AccountPage() {
  const auth = useAuth()
  const client = useQueryClient()
  const [displayName, setDisplayName] = useState(auth.profile?.display_name ?? '')
  const [reason, setReason] = useState('')
  const deletion = useQuery({ queryKey: ['deletion-request', auth.user?.id], queryFn: async () => {
    const { data, error } = await requireSupabase().from('account_deletion_requests').select('id,status,created_at').eq('user_id', auth.user!.id).in('status', ['open','reviewing']).maybeSingle()
    if (error) throw error
    return data as { id: string; status: string; created_at: string } | null
  }, enabled: Boolean(auth.user) })
  const save = useMutation({ mutationFn: async () => {
    const cleanName = displayName.trim()
    if (cleanName.length < 2) throw new Error('Display name must contain at least 2 characters.')
    const { error } = await requireSupabase().from('profiles').update({ display_name: cleanName }).eq('id', auth.user!.id)
    if (error) throw error
  }, onSuccess: () => auth.refreshProfile() })
  const requestDeletion = useMutation({ mutationFn: async () => {
    const { error } = await requireSupabase().rpc('request_account_deletion', { p_reason: reason.trim() || null })
    if (error) throw error
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['deletion-request', auth.user?.id] }) })
  if (auth.loading) return <LoadingState />
  if (!auth.user) return <Navigate to="/auth" replace />
  return <div><div className="page-heading"><div><span className="eyebrow">Your account</span><h1>Account settings</h1><p>Manage the name shown across SHY and request help with account removal.</p></div></div><div className="account-grid"><form className="dashboard-panel form-stack" onSubmit={(event) => { event.preventDefault(); save.mutate() }}><h2>Profile</h2><label>Email<input value={auth.user.email ?? ''} readOnly /></label><label>Display name<input value={displayName} minLength={2} maxLength={80} onChange={(event) => setDisplayName(event.target.value)} /></label>{save.error && <p className="form-message error">{save.error.message}</p>}{save.isSuccess && <p className="form-message success">Profile saved.</p>}<button className="button primary" disabled={save.isPending}><Save />Save profile</button></form><section className="dashboard-panel form-stack danger-zone"><h2>Account deletion</h2>{deletion.isLoading ? <p>Checking request status...</p> : deletion.data ? <p role="status">Your deletion request is <strong>{deletion.data.status}</strong>. A restricted administrator must review catalogue ownership and associated data before completion.</p> : <><p>Request removal of your account and associated profile data. Artist catalogue ownership must be reviewed before deletion to prevent accidental loss.</p><label>Reason (optional)<textarea rows={4} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>{requestDeletion.error && <p className="form-message error">{requestDeletion.error.message}</p>}<button className="button danger" disabled={requestDeletion.isPending} onClick={() => requestDeletion.mutate()}><Trash2 />{requestDeletion.isPending ? 'Sending request...' : 'Request account deletion'}</button></>}</section></div></div>
}

export function NotFoundPage() { return <article className="state state-card"><h1>Page not found</h1><a className="button primary" href={import.meta.env.BASE_URL}>Go home</a></article> }
