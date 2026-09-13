import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, GripVertical, Plus, Save, Send, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { MetadataChips, MetadataPicker } from '../MetadataChips'
import { slugify } from '../../lib/format'
import { requireSupabase } from '../../lib/supabase'
import type { ReleaseStatus } from '../../types'
import { AiToolField, AudioDropZone, CoverPicker, KeyFields, PublishSuccess, StepIndicator, UploadProgress, formatClock, type AudioSelection } from './UploadFields'

interface ArtistIdentity { id: string; slug: string }
type AlbumType = 'album' | 'ep' | 'mixtape' | 'compilation'
interface AlbumTrackDraft {
  id: string
  expanded: boolean
  audio: AudioSelection | null
  title: string
  featured: string
  genres: string[]
  moods: string[]
  cover: File | null
  explicit: boolean
  description: string
  bpm: string
  keyName: string
  keyMode: 'major' | 'minor'
  aiTool: string
  bonus: boolean
  error: string
}

function blankTrack(): AlbumTrackDraft {
  return { id: crypto.randomUUID(), expanded: true, audio: null, title: '', featured: '', genres: [], moods: [], cover: null, explicit: false, description: '', bpm: '', keyName: '', keyMode: 'major', aiTool: '', bonus: false, error: '' }
}
function today() { return new Date().toISOString().slice(0, 10) }
function splitArtists(value: string) { return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 10) }
function extension(file: File) { return file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin' }

export function AlbumUploadFlow({ artist, onExit }: { artist: ArtistIdentity; onExit: () => void }) {
  const client = useQueryClient()
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<AlbumType>('album')
  const [cover, setCover] = useState<File | null>(null)
  const [releaseDate, setReleaseDate] = useState(today)
  const [description, setDescription] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [moods, setMoods] = useState<string[]>([])
  const [featured, setFeatured] = useState('')
  const [tracks, setTracks] = useState<AlbumTrackDraft[]>([blankTrack()])
  const [releaseMode, setReleaseMode] = useState<'now' | 'schedule'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [published, setPublished] = useState<{ slug: string; status: ReleaseStatus } | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const totalDuration = useMemo(() => tracks.reduce((sum, track) => sum + (track.audio?.duration ?? 0), 0), [tracks])
  const uploadedCount = tracks.filter((track) => track.audio).length
  const updateTrack = (id: string, patch: Partial<AlbumTrackDraft>) => setTracks((current) => current.map((track) => track.id === id ? { ...track, ...patch } : track))
  const moveTrack = (index: number, direction: -1 | 1) => setTracks((current) => {
    const target = index + direction
    if (target < 0 || target >= current.length) return current
    const next = [...current]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
  const dropTrack = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return
    setTracks((current) => {
      const from = current.findIndex((track) => track.id === draggedId)
      const to = current.findIndex((track) => track.id === targetId)
      if (from < 0 || to < 0) return current
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setDraggedId(null)
  }

  const validateStep = () => {
    if (step === 1 && (!title.trim() || !cover || !releaseDate || !genres.length || !moods.length)) return 'Complete the album title, artwork, release date, genres, and moods.'
    if (step === 2) {
      if (!tracks.length) return 'Add at least one track.'
      const incomplete = tracks.find((track) => !track.audio || !track.title.trim() || !track.genres.length || !track.moods.length || !track.aiTool)
      if (incomplete) return 'Every track needs audio, a title, at least one genre and mood, and an AI tool.'
    }
    return ''
  }

  const save = useMutation({
    mutationFn: async (requestedStatus: 'draft' | 'publish') => {
      if (!cover) throw new Error('Album cover art is required.')
      const invalid = validateStep()
      if (invalid) throw new Error(invalid)
      if (requestedStatus === 'publish' && releaseMode === 'schedule' && (!scheduledAt || new Date(scheduledAt) <= new Date())) throw new Error('Choose a future date and time for the scheduled release.')
      const status: 'draft' | 'published' | 'scheduled' = requestedStatus === 'draft' ? 'draft' : releaseMode === 'schedule' ? 'scheduled' : 'published'
      const releaseAt = status === 'published' ? new Date().toISOString() : status === 'scheduled' ? new Date(scheduledAt).toISOString() : null
      const db = requireSupabase()
      const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
      const albumSlug = `${slugify(title) || 'album'}-${unique.slice(-8)}`
      const albumCoverPath = `${artist.id}/albums/${unique}.${extension(cover)}`
      const uploaded: Array<{ bucket: string; path: string }> = []
      let albumId: string | null = null
      try {
        setProgressLabel('Uploading album cover'); setProgress(4)
        const coverUpload = await db.storage.from('covers').upload(albumCoverPath, cover, { cacheControl: '86400', upsert: false })
        if (coverUpload.error) throw coverUpload.error
        uploaded.push({ bucket: 'covers', path: albumCoverPath })
        const albumInsert = await db.from('albums').insert({
          artist_id: artist.id,
          title: title.trim(),
          slug: albumSlug,
          cover_path: albumCoverPath,
          release_type: type,
          release_status: status,
          release_at: releaseAt,
          scheduled_at: status === 'scheduled' ? releaseAt : null,
          genres,
          moods,
          featured_artists: splitArtists(featured),
          description: description.trim() || null,
          total_tracks: tracks.length,
          total_duration_seconds: Math.round(totalDuration),
        }).select('id,slug').single()
        if (albumInsert.error) throw albumInsert.error
        albumId = albumInsert.data.id as string

        for (let index = 0; index < tracks.length; index += 1) {
          const track = tracks[index]
          if (!track.audio) throw new Error(`Track ${index + 1} has no audio file.`)
          const trackUnique = `${unique}-${index + 1}`
          const audioPath = `${artist.id}/albums/${albumId}/${trackUnique}.${extension(track.audio.file)}`
          setProgressLabel(`Uploading track ${index + 1} of ${tracks.length}`)
          setProgress(Math.round(8 + (index / tracks.length) * 82))
          const audioUpload = await db.storage.from('audio').upload(audioPath, track.audio.file, { cacheControl: '3600', upsert: false })
          if (audioUpload.error) throw audioUpload.error
          uploaded.push({ bucket: 'audio', path: audioPath })
          let trackCoverPath = albumCoverPath
          if (track.cover) {
            trackCoverPath = `${artist.id}/albums/${albumId}/cover-${index + 1}.${extension(track.cover)}`
            const trackCoverUpload = await db.storage.from('covers').upload(trackCoverPath, track.cover, { cacheControl: '86400', upsert: false })
            if (trackCoverUpload.error) throw trackCoverUpload.error
            uploaded.push({ bucket: 'covers', path: trackCoverPath })
          }
          const trackSlug = `${slugify(track.title) || 'track'}-${crypto.randomUUID().slice(0, 8)}`
          const trackInsert = await db.from('tracks').insert({
            artist_id: artist.id,
            album_id: albumId,
            title: track.title.trim(),
            slug: trackSlug,
            audio_path: audioPath,
            cover_path: trackCoverPath,
            duration_seconds: Math.round(track.audio.duration),
            track_number: index + 1,
            genre: track.genres[0],
            mood: track.moods[0],
            genres: track.genres,
            moods: track.moods,
            featured_artists: splitArtists(track.featured),
            ai_tool: track.aiTool,
            bpm: track.bpm ? Number(track.bpm) : null,
            key_signature: track.keyName ? `${track.keyName} ${track.keyMode}` : null,
            description: track.description.trim() || null,
            explicit: track.explicit,
            downloadable: true,
            is_bonus: track.bonus,
            release_status: status,
            release_at: releaseAt,
            scheduled_at: status === 'scheduled' ? releaseAt : null,
          }).select('id').single()
          if (trackInsert.error) throw trackInsert.error
          const relation = await db.from('album_tracks').insert({ album_id: albumId, song_id: trackInsert.data.id, track_number: index + 1, is_bonus: track.bonus })
          if (relation.error) throw relation.error
        }
        setProgressLabel(status === 'draft' ? 'Draft saved' : status === 'scheduled' ? 'Release scheduled' : 'Album published')
        setProgress(100)
        return { slug: albumSlug, status }
      } catch (caught) {
        if (albumId) await db.from('albums').delete().eq('id', albumId)
        await Promise.all(uploaded.map((file) => db.storage.from(file.bucket).remove([file.path])))
        throw caught
      }
    },
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ['my-content'] })
      setPublished(result)
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : 'SHY could not save this album.'),
  })

  const next = () => {
    const nextError = validateStep()
    if (nextError) { setError(nextError); return }
    setError(''); setStep((value) => Math.min(3, value + 1)); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (published?.status === 'published') return <PublishSuccess kind="album" viewTo={`/albums/${published.slug}`} onAnother={() => window.location.assign(`${import.meta.env.BASE_URL}upload?type=album`)} />
  if (published) return <section className="publish-success"><span className="success-burst"><Save /></span><h1>{published.status === 'draft' ? 'Draft saved' : 'Release scheduled'}</h1><p>{published.status === 'draft' ? 'Only you can see this project until it is published.' : 'SHY will keep this project private until its release time.'}</p><button className="button primary" onClick={onExit}>Back to uploads</button></section>

  return <section className="guided-upload">
    <button type="button" className="text-button" onClick={onExit}><ArrowLeft /> Change release type</button>
    <StepIndicator current={step} total={3} />
    <header><p className="eyebrow">Album / EP</p><h1>{['Album details', 'Build your tracklist', 'Review and publish'][step - 1]}</h1></header>

    {step === 1 && <div className="upload-stage album-details">
      <CoverPicker value={cover} onChange={(value) => { setCover(value); setError('') }} onError={setError} />
      <div className="form-grid">
        <label>Album title<input required autoFocus maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Project type<select value={type} onChange={(event) => setType(event.target.value as AlbumType)}><option value="album">Album</option><option value="ep">EP</option><option value="mixtape">Mixtape</option><option value="compilation">Compilation</option></select></label>
        <label>Release date<input type="date" value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} /></label>
        <label>Featured artists (optional)<input value={featured} onChange={(event) => setFeatured(event.target.value)} placeholder="Separate names with commas" /></label>
        <label className="wide">Album description<textarea rows={5} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} /><small className="character-count">{description.length}/500</small></label>
        <div className="wide"><MetadataPicker label="Primary genres" values={genres} onChange={setGenres} kind="genre" /></div>
        <div className="wide"><MetadataPicker label="Primary moods" values={moods} onChange={setMoods} kind="mood" /></div>
      </div>
    </div>}

    {step === 2 && <div className="upload-stage">
      <div className="track-builder-heading"><div><h2>Tracks</h2><p>{uploadedCount} of {tracks.length} tracks uploaded · {formatClock(totalDuration)} total</p></div><button type="button" className="button primary" disabled={tracks.length >= 30} onClick={() => setTracks((current) => [...current.map((track) => ({ ...track, expanded: false })), blankTrack()])}><Plus /> Add Track</button></div>
      <div className="album-track-stack">{tracks.map((track, index) => <TrackEditor key={track.id} track={track} index={index} total={tracks.length} albumCover={cover} onChange={(patch) => updateTrack(track.id, patch)} onDelete={() => setTracks((current) => current.filter((item) => item.id !== track.id))} onMove={(direction) => moveTrack(index, direction)} onDragStart={() => setDraggedId(track.id)} onDrop={() => dropTrack(track.id)} />)}</div>
    </div>}

    {step === 3 && <div className="upload-stage review-stage album-review">
      <CoverPicker value={cover} onChange={setCover} />
      <div className="review-details"><span className="status-pill">{type}</span><h2>{title}</h2><p>{tracks.length} tracks · {formatClock(totalDuration)}</p><MetadataChips values={genres} /><MetadataChips values={moods} tone="neutral" />{description && <p>{description}</p>}</div>
      <ol className="review-tracklist">{tracks.map((track, index) => <li key={track.id}><span>{index + 1}</span><div><strong>{track.title}</strong><small>{formatClock(track.audio?.duration ?? 0)}{track.featured ? ` · feat. ${track.featured}` : ''}</small></div>{track.bonus && <span className="metadata-chip warning">Bonus</span>}<MetadataChips values={track.genres.slice(0, 1)} /></li>)}</ol>
      <div className="release-options"><div className="segmented"><button type="button" className={releaseMode === 'now' ? 'active' : ''} onClick={() => setReleaseMode('now')}>Release all tracks now</button><button type="button" className={releaseMode === 'schedule' ? 'active' : ''} onClick={() => setReleaseMode('schedule')}>Schedule release</button></div>{releaseMode === 'schedule' && <label>Go live date and time<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>}</div>
    </div>}

    {error && <p className="form-message error" role="alert">{error}</p>}
    {save.isPending && <UploadProgress label={progressLabel} value={progress} />}
    <footer className="step-actions">{step > 1 && <button type="button" className="button secondary" onClick={() => setStep((value) => value - 1)} disabled={save.isPending}><ArrowLeft /> Back</button>}{step < 3 ? <button type="button" className="button primary" onClick={next}>Continue <ArrowRight /></button> : <><button type="button" className="button secondary" onClick={() => save.mutate('draft')} disabled={save.isPending}><Save /> Save as Draft</button><button type="button" className="button primary" onClick={() => save.mutate('publish')} disabled={save.isPending}><Send /> {releaseMode === 'schedule' ? 'Schedule Release' : 'Publish Now'}</button></>}</footer>
  </section>
}

function TrackEditor({ track, index, total, albumCover, onChange, onDelete, onMove, onDragStart, onDrop }: {
  track: AlbumTrackDraft
  index: number
  total: number
  albumCover: File | null
  onChange: (patch: Partial<AlbumTrackDraft>) => void
  onDelete: () => void
  onMove: (direction: -1 | 1) => void
  onDragStart: () => void
  onDrop: () => void
}) {
  const inheritedPreview = useMemo(() => albumCover ? URL.createObjectURL(albumCover) : null, [albumCover])
  useEffect(() => () => { if (inheritedPreview) URL.revokeObjectURL(inheritedPreview) }, [inheritedPreview])
  return <article className="album-track-panel" draggable onDragStart={onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
    <header><GripVertical aria-label="Drag to reorder" /><button type="button" className="track-collapse" onClick={() => onChange({ expanded: !track.expanded })}><span>{index + 1}</span><div><strong>{track.title || `Track ${index + 1}`}</strong><small>{track.audio ? formatClock(track.audio.duration) : 'Audio needed'}{track.genres.length ? ` · ${track.genres.join(', ')}` : ''}</small></div><ChevronDown className={track.expanded ? 'rotated' : ''} /></button><div className="row-buttons"><button type="button" className="icon-button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move track up"><ArrowUp /></button><button type="button" className="icon-button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move track down"><ArrowDown /></button><button type="button" className="icon-button danger" onClick={onDelete} disabled={total === 1} aria-label="Delete track"><Trash2 /></button></div></header>
    {track.expanded && <div className="track-panel-body">
      <AudioDropZone compact value={track.audio} onChange={(audio) => onChange({ audio, error: '' })} onError={(error) => onChange({ error })} error={track.error} />
      <div className="form-grid"><label>Track title<input maxLength={160} value={track.title} onChange={(event) => onChange({ title: event.target.value })} /></label><label>Featured artists<input value={track.featured} onChange={(event) => onChange({ featured: event.target.value })} placeholder="Optional, comma-separated" /></label><KeyFields bpm={track.bpm} keyName={track.keyName} keyMode={track.keyMode} onBpm={(bpm) => onChange({ bpm })} onKey={(keyName) => onChange({ keyName })} onMode={(keyMode) => onChange({ keyMode })} /><AiToolField value={track.aiTool} onChange={(aiTool) => onChange({ aiTool })} /><label className="wide">Description<textarea rows={3} maxLength={300} value={track.description} onChange={(event) => onChange({ description: event.target.value })} /><small className="character-count">{track.description.length}/300</small></label><label className="toggle-row"><span>Explicit content</span><input type="checkbox" checked={track.explicit} onChange={(event) => onChange({ explicit: event.target.checked })} /></label><label className="toggle-row"><span>Bonus track</span><input type="checkbox" checked={track.bonus} onChange={(event) => onChange({ bonus: event.target.checked })} /></label></div>
      <div className="track-cover-field"><CoverPicker value={track.cover} inherited={inheritedPreview} onChange={(cover) => onChange({ cover })} onError={(error) => onChange({ error })} /><small>Optional. Album artwork is inherited automatically.</small></div>
      <MetadataPicker label="Track genres" values={track.genres} onChange={(genres) => onChange({ genres })} kind="genre" />
      <MetadataPicker label="Track moods" values={track.moods} onChange={(moods) => onChange({ moods })} kind="mood" />
    </div>}
  </article>
}
