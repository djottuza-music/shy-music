/* oxlint-disable react/only-export-components */
import { Check, FileAudio, ImagePlus, Music2, UploadCloud, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { aiTools, keySignatures } from '../../lib/taxonomy'

export const MAX_AUDIO_BYTES = 100 * 1024 * 1024

export interface AudioSelection {
  file: File
  duration: number
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatClock(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60).toString().padStart(2, '0')}`
}

export async function readAudio(file: File): Promise<AudioSelection> {
  if (file.size > MAX_AUDIO_BYTES) throw new Error('Audio files must be 100MB or smaller.')
  const allowed = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/x-flac', 'audio/aac', 'audio/mp4']
  if (file.type && !allowed.includes(file.type)) throw new Error('Use an MP3, WAV, FLAC, or AAC audio file.')
  const url = URL.createObjectURL(file)
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const audio = new Audio()
      audio.preload = 'metadata'
      audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0)
      audio.onerror = () => reject(new Error('SHY could not read this audio file. Try another supported file.'))
      audio.src = url
    })
    return { file, duration }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function validateCover(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use a JPG, PNG, or WebP image.')
  const url = URL.createObjectURL(file)
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => reject(new Error('SHY could not read this image.'))
      image.src = url
    })
    if (dimensions.width !== dimensions.height) throw new Error('Cover art must be square (1:1).')
    if (dimensions.width < 500) throw new Error('Cover art must be at least 500 x 500 pixels.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function StepIndicator({ current, total }: { current: number; total: number }) {
  return <div className="upload-step-header" aria-label={`Step ${current} of ${total}`}>
    <strong>Step {current} of {total}</strong>
    <div className="step-track" aria-hidden="true"><i style={{ width: `${(current / total) * 100}%` }} /></div>
  </div>
}

export function AudioDropZone({ value, onChange, error, onError, compact = false }: {
  value: AudioSelection | null
  onChange: (value: AudioSelection | null) => void
  error?: string
  onError?: (message: string) => void
  compact?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const choose = async (file?: File) => {
    if (!file) return
    try { onChange(await readAudio(file)) } catch (caught) { onError?.(caught instanceof Error ? caught.message : 'Could not read this audio file.') }
  }
  return <div>
    {value ? <div className="audio-preview">
      <div className="waveform" aria-hidden="true">{Array.from({ length: compact ? 18 : 34 }, (_, index) => <i key={index} style={{ height: `${24 + ((index * 37) % 72)}%` }} />)}</div>
      <div className="audio-summary"><FileAudio /><span><strong>{value.file.name}</strong><small>{formatClock(value.duration)} · {formatBytes(value.file.size)}</small></span></div>
      <button type="button" className="icon-button" onClick={() => onChange(null)} aria-label="Remove audio"><X /></button>
    </div> : <button type="button" className={`audio-drop-zone ${compact ? 'compact' : ''}`} onClick={() => input.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void choose(event.dataTransfer.files[0]) }}>
      <Music2 /><strong>Drag your audio file here or click to browse</strong><small>Supported formats: MP3, WAV, FLAC, AAC · Max 100MB</small>
    </button>}
    <input ref={input} className="visually-hidden" type="file" accept="audio/mpeg,audio/wav,audio/flac,audio/aac,audio/mp4" onChange={(event) => void choose(event.target.files?.[0])} />
    {error && <span className="form-message error" role="alert">{error}</span>}
  </div>
}

export function CoverPicker({ value, onChange, error, onError, inherited }: {
  value: File | null
  onChange: (file: File | null) => void
  error?: string
  onError?: (message: string) => void
  inherited?: string | null
}) {
  const preview = useMemo(() => value ? URL.createObjectURL(value) : inherited ?? '', [inherited, value])
  useEffect(() => () => { if (value && preview) URL.revokeObjectURL(preview) }, [preview, value])
  const select = async (file?: File) => {
    if (!file) return
    try { await validateCover(file); onChange(file) } catch (caught) { onError?.(caught instanceof Error ? caught.message : 'Could not read this image.') }
  }
  return <div className="cover-field">
    <label className="cover-picker">
      {preview ? <img src={preview} alt="Cover preview" /> : <span><ImagePlus /><strong>Add cover art</strong><small>Square JPG, PNG, or WebP · min 500 x 500</small></span>}
      <span className="cover-overlay"><UploadCloud />{preview ? 'Change cover' : 'Choose cover'}</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void select(event.target.files?.[0])} />
    </label>
    {error && <span className="form-message error" role="alert">{error}</span>}
  </div>
}

export function KeyFields({ bpm, keyName, keyMode, onBpm, onKey, onMode }: {
  bpm: string
  keyName: string
  keyMode: 'major' | 'minor'
  onBpm: (value: string) => void
  onKey: (value: string) => void
  onMode: (value: 'major' | 'minor') => void
}) {
  return <div className="music-key-fields">
    <label>BPM<input type="number" min="20" max="300" inputMode="numeric" value={bpm} onChange={(event) => onBpm(event.target.value)} placeholder="120" /></label>
    <label>Key<select value={keyName} onChange={(event) => onKey(event.target.value)}><option value="">Unknown</option>{keySignatures.map((key) => <option key={key}>{key}</option>)}</select></label>
    <div className="segmented" aria-label="Key mode"><button type="button" className={keyMode === 'major' ? 'active' : ''} onClick={() => onMode('major')}>Major</button><button type="button" className={keyMode === 'minor' ? 'active' : ''} onClick={() => onMode('minor')}>Minor</button></div>
  </div>
}

export function AiToolField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label>AI tool used<select required value={value} onChange={(event) => onChange(event.target.value)}><option value="">Choose a tool</option>{aiTools.map((tool) => <option key={tool}>{tool}</option>)}</select></label>
}

export function TagEditor({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const add = () => {
    const next = input.current?.value.trim().replace(/^#/, '')
    if (!next || values.includes(next) || values.length >= 5) return
    onChange([...values, next])
    if (input.current) input.current.value = ''
  }
  return <div className="tag-editor"><label>Searchable tags <span>{values.length}/5</span><input ref={input} maxLength={30} placeholder="wedding" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add() } }} /></label><button type="button" className="button secondary" onClick={add} disabled={values.length >= 5}>Add</button><div className="metadata-chips">{values.map((tag) => <button type="button" className="metadata-chip neutral removable" key={tag} onClick={() => onChange(values.filter((item) => item !== tag))}>#{tag}<X /></button>)}</div></div>
}

export function UploadProgress({ label, value }: { label: string; value: number }) {
  return <div className="upload-progress" role="status"><span>{label}<strong>{value}%</strong></span><div><i style={{ width: `${value}%` }} /></div></div>
}

export function PublishSuccess({ kind, viewTo, onAnother }: { kind: 'track' | 'album'; viewTo: string; onAnother: () => void }) {
  return <section className="publish-success"><span className="success-burst"><Check /></span><h1>Your {kind} is live on SHY {kind === 'track' ? '🎵' : '🎶'}</h1><p>Your release is published and ready for listeners.</p><div className="button-row"><a className="button primary" href={viewTo}>View My {kind === 'track' ? 'Song' : 'Album'}</a><button className="button secondary" onClick={onAnother}>Upload Another</button></div></section>
}
