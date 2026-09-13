import { ArrowLeft, ArrowRight, Save, Send } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { MetadataChips, MetadataPicker } from '../MetadataChips'
import { slugify } from '../../lib/format'
import { requireSupabase } from '../../lib/supabase'
import type { ReleaseStatus } from '../../types'
import { AiToolField, AudioDropZone, CoverPicker, KeyFields, PublishSuccess, StepIndicator, TagEditor, UploadProgress, type AudioSelection } from './UploadFields'

interface ArtistIdentity { id: string; slug: string }

function today() { return new Date().toISOString().slice(0, 10) }
function splitArtists(value: string) { return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 10) }
function fileExtension(file: File) { return file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin' }

export function SingleUploadFlow({ artist, onExit }: { artist: ArtistIdentity; onExit: () => void }) {
  const client = useQueryClient()
  const [step, setStep] = useState(1)
  const [audio, setAudio] = useState<AudioSelection | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [featured, setFeatured] = useState('')
  const [releaseDate, setReleaseDate] = useState(today)
  const [bpm, setBpm] = useState('')
  const [keyName, setKeyName] = useState('')
  const [keyMode, setKeyMode] = useState<'major' | 'minor'>('major')
  const [explicit, setExplicit] = useState(false)
  const [description, setDescription] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [moods, setMoods] = useState<string[]>([])
  const [aiTool, setAiTool] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [published, setPublished] = useState<{ slug: string; status: ReleaseStatus } | null>(null)

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(audio)
    if (step === 2) return title.trim().length > 0 && releaseDate && (!bpm || (Number(bpm) >= 20 && Number(bpm) <= 300))
    if (step === 3) return Boolean(cover && genres.length && moods.length && aiTool)
    return true
  }, [aiTool, audio, bpm, cover, genres.length, moods.length, releaseDate, step, title])

  const save = useMutation({
    mutationFn: async (status: 'draft' | 'published') => {
      if (!audio || !cover) throw new Error('Audio and cover art are required.')
      const db = requireSupabase()
      const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
      const slug = `${slugify(title) || 'track'}-${unique.slice(-8)}`
      const audioPath = `${artist.id}/tracks/${unique}.${fileExtension(audio.file)}`
      const coverPath = `${artist.id}/covers/${unique}.${fileExtension(cover)}`
      const uploaded: Array<{ bucket: string; path: string }> = []
      try {
        setProgressLabel('Uploading audio'); setProgress(18)
        const audioResult = await db.storage.from('audio').upload(audioPath, audio.file, { cacheControl: '3600', upsert: false })
        if (audioResult.error) throw audioResult.error
        uploaded.push({ bucket: 'audio', path: audioPath })
        setProgressLabel('Uploading cover art'); setProgress(62)
        const coverResult = await db.storage.from('covers').upload(coverPath, cover, { cacheControl: '86400', upsert: false })
        if (coverResult.error) throw coverResult.error
        uploaded.push({ bucket: 'covers', path: coverPath })
        setProgressLabel('Saving track details'); setProgress(84)
        const releaseAt = status === 'published' ? new Date().toISOString() : null
        const { data, error: insertError } = await db.from('tracks').insert({
          artist_id: artist.id,
          title: title.trim(),
          slug,
          audio_path: audioPath,
          cover_path: coverPath,
          duration_seconds: Math.round(audio.duration),
          genre: genres[0],
          mood: moods[0],
          genres,
          moods,
          featured_artists: splitArtists(featured),
          ai_tool: aiTool,
          bpm: bpm ? Number(bpm) : null,
          key_signature: keyName ? `${keyName} ${keyMode}` : null,
          description: description.trim() || null,
          custom_tags: tags,
          explicit,
          downloadable: true,
          release_status: status,
          release_at: releaseAt,
        }).select('slug').single()
        if (insertError) throw insertError
        setProgress(100); setProgressLabel(status === 'published' ? 'Published' : 'Draft saved')
        return { slug: data.slug as string, status }
      } catch (caught) {
        await Promise.all(uploaded.map((file) => db.storage.from(file.bucket).remove([file.path])))
        throw caught
      }
    },
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ['my-content'] })
      setPublished(result)
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : 'SHY could not save this track.'),
  })

  const next = () => {
    setError('')
    if (!canContinue) {
      const message = step === 1 ? 'Choose a supported audio file first.' : step === 2 ? 'Complete the required song details.' : 'Add square cover art, at least one genre and mood, and the AI tool used.'
      setError(message)
      return
    }
    setStep((value) => Math.min(4, value + 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (published?.status === 'published') return <PublishSuccess kind="track" viewTo={`/tracks/${published.slug}`} onAnother={() => window.location.assign(`${import.meta.env.BASE_URL}upload?type=single`)} />
  if (published?.status === 'draft') return <section className="publish-success"><span className="success-burst"><Save /></span><h1>Draft saved</h1><p>Only you can see this track until you publish it.</p><div className="button-row"><button className="button primary" onClick={onExit}>Back to uploads</button></div></section>

  return <section className="guided-upload">
    <button type="button" className="text-button" onClick={onExit}><ArrowLeft /> Change release type</button>
    <StepIndicator current={step} total={4} />
    <header><p className="eyebrow">Single track</p><h1>{['Add your audio', 'Song details', 'Artwork and discovery', 'Review and publish'][step - 1]}</h1></header>

    {step === 1 && <div className="upload-stage"><AudioDropZone value={audio} onChange={(value) => { setAudio(value); setError('') }} onError={setError} error={error} /></div>}

    {step === 2 && <div className="upload-stage form-grid">
      <label>Song title<input required autoFocus maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>Featured artists (optional)<input value={featured} onChange={(event) => setFeatured(event.target.value)} placeholder="e.g. Yo Maps, Macky 2" /><small>Separate artist names with commas.</small></label>
      <label>Release date<input type="date" value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} /></label>
      <KeyFields bpm={bpm} keyName={keyName} keyMode={keyMode} onBpm={setBpm} onKey={setKeyName} onMode={setKeyMode} />
      <label className="toggle-row wide"><span>Explicit content<small>A red E badge will appear beside the song.</small></span><input type="checkbox" checked={explicit} onChange={(event) => setExplicit(event.target.checked)} /></label>
      <label className="wide">Song description / lyrics notes<textarea maxLength={1000} rows={6} value={description} onChange={(event) => setDescription(event.target.value)} /><small className="character-count">{description.length}/1000</small></label>
    </div>}

    {step === 3 && <div className="upload-stage discovery-stage">
      <CoverPicker value={cover} onChange={(value) => { setCover(value); setError('') }} onError={setError} error={error && !cover ? error : ''} />
      <div className="discovery-fields"><MetadataPicker label="Genres" values={genres} onChange={setGenres} kind="genre" /><MetadataPicker label="Moods" values={moods} onChange={setMoods} kind="mood" /><AiToolField value={aiTool} onChange={setAiTool} /><TagEditor values={tags} onChange={setTags} /></div>
    </div>}

    {step === 4 && <div className="upload-stage review-stage">
      <CoverPicker value={cover} onChange={setCover} />
      <div className="review-details"><h2>{title}</h2>{featured && <p>Featuring {featured}</p>}<MetadataChips values={genres} /><MetadataChips values={moods} tone="neutral" /><dl><div><dt>Audio</dt><dd>{audio?.file.name}</dd></div><div><dt>Duration</dt><dd>{audio ? `${Math.floor(audio.duration / 60)}:${Math.floor(audio.duration % 60).toString().padStart(2, '0')}` : ''}</dd></div><div><dt>AI tool</dt><dd>{aiTool}</dd></div><div><dt>Music data</dt><dd>{bpm ? `${bpm} BPM` : 'BPM unknown'}{keyName ? ` · ${keyName} ${keyMode}` : ''}</dd></div><div><dt>Release date</dt><dd>{releaseDate}</dd></div></dl>{explicit && <span className="explicit-badge">E</span>}{description && <p>{description}</p>}</div>
    </div>}

    {error && step !== 1 && <p className="form-message error" role="alert">{error}</p>}
    {save.isPending && <UploadProgress label={progressLabel} value={progress} />}
    <footer className="step-actions">
      {step > 1 && <button type="button" className="button secondary" onClick={() => setStep((value) => value - 1)} disabled={save.isPending}><ArrowLeft /> Back</button>}
      {step < 4 ? <button type="button" className="button primary" onClick={next}>Continue <ArrowRight /></button> : <><button type="button" className="button secondary" onClick={() => save.mutate('draft')} disabled={save.isPending}><Save /> Save as Draft</button><button type="button" className="button primary" onClick={() => save.mutate('published')} disabled={save.isPending}><Send /> Publish Now</button></>}
    </footer>
  </section>
}
