import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, ImagePlus, Music2, Trash2, UploadCloud } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LoadingState } from '../components/States'
import { useAuth } from '../contexts/AuthContext'
import { slugify } from '../lib/format'
import { requireSupabase } from '../lib/supabase'

const moods = ['Happy','Joyful','Cheerful','Uplifting','Energetic','Exciting','Playful','Fun','Hopeful','Motivational','Confident','Powerful','Triumphant','Peaceful','Calm','Relaxing','Dreamy','Gentle','Romantic','Passionate','Flirty','Sensual','Emotional','Heartfelt','Nostalgic','Sentimental','Reflective','Thoughtful','Melancholic','Sad','Heartbroken','Lonely','Regretful','Dark','Mysterious','Haunting','Suspenseful','Angry','Aggressive','Rebellious','Intense','Anxious','Tense','Spiritual','Inspirational','Carefree','Chill','Groovy','Euphoric','Bittersweet','Cinematic','Epic','Adventurous','Festive','Romantic and sad','Calm and emotional','Dark and energetic','Nostalgic and hopeful','Dreamy and peaceful']
const genres = ['Afropop','Afrobeats','Electronic','Hip-hop','R&B','Gospel','Pop','Amapiano','Dancehall','Reggae','Jazz','Soul','Rock','Other']

type UploadMode = 'single' | 'album'
interface AlbumTrackInput { id: string; file: File; title: string }

export function UploadPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [mode, setMode] = useState<UploadMode>('single')
  const [releaseType, setReleaseType] = useState<'album' | 'ep'>('album')
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('Afropop')
  const [mood, setMood] = useState('')
  const [releaseAt, setReleaseAt] = useState('')
  const [cover, setCover] = useState<File | null>(null)
  const [audio, setAudio] = useState<File | null>(null)
  const [albumTracks, setAlbumTracks] = useState<AlbumTrackInput[]>([])
  const [explicit, setExplicit] = useState(false)
  const [progress, setProgress] = useState('')
  const coverPreview = useMemo(() => cover ? URL.createObjectURL(cover) : '', [cover])
  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview) }, [coverPreview])
  const artist = useQuery({ queryKey: ['my-artist', auth.user?.id], queryFn: async () => {
    const { data, error } = await requireSupabase().from('artists').select('id,slug').eq('user_id', auth.user!.id).single()
    if (error) throw error
    return data as { id: string; slug: string }
  }, enabled: Boolean(auth.user && auth.isArtist) })

  const publish = useMutation({ mutationFn: async () => {
    if (!artist.data) throw new Error('Artist profile is not ready.')
    const cleanTitle = title.trim()
    if (!cleanTitle) throw new Error(`Enter ${mode === 'single' ? 'a song' : 'an album'} title.`)
    if (!cover) throw new Error('Choose cover art.')
    validateCover(cover)
    const schedule = new Date(releaseAt)
    if (!releaseAt || !Number.isFinite(schedule.getTime()) || schedule <= new Date(Date.now() + 5 * 60_000)) throw new Error('Schedule the release at least 5 minutes from now.')
    if (mode === 'single' && !audio) throw new Error('Choose an audio file.')
    if (mode === 'album' && albumTracks.length < 2) throw new Error('Choose at least two audio files for an album or EP.')
    const db = requireSupabase()
    const releaseId = crypto.randomUUID()
    const safeTitle = slugify(cleanTitle) || releaseId
    const coverExtension = fileExtension(cover.name, 'png')
    const coverPath = `${artist.data.id}/${mode === 'single' ? 'tracks' : 'albums'}/${releaseId}-${safeTitle}.${coverExtension}`
    const uploadedAudio: string[] = []
    let albumId: string | null = null
    setProgress('Uploading cover art...')
    const coverUpload = await db.storage.from('covers').upload(coverPath, cover, { upsert: false, contentType: cover.type || `image/${coverExtension}` })
    if (coverUpload.error) throw coverUpload.error
    try {
      if (mode === 'single') {
        validateAudio(audio!)
        setProgress('Reading audio and uploading song...')
        const audioPath = `${artist.data.id}/tracks/${releaseId}-${safeTitle}.${fileExtension(audio!.name, 'mp3')}`
        const duration = await readAudioDuration(audio!)
        const audioUpload = await db.storage.from('audio').upload(audioPath, audio!, { upsert: false, contentType: audio!.type || 'audio/mpeg' })
        if (audioUpload.error) throw audioUpload.error
        uploadedAudio.push(audioPath)
        const { error } = await db.from('tracks').insert({ id: releaseId, artist_id: artist.data.id, title: cleanTitle, slug: `${safeTitle}-${releaseId.slice(0, 8)}`, audio_path: audioPath, cover_path: coverPath, duration_seconds: Math.round(duration), genre, mood: mood || null, explicit, downloadable: true, release_status: 'scheduled', release_at: schedule.toISOString() })
        if (error) throw error
      } else {
        albumTracks.forEach((track) => { validateAudio(track.file); if (!track.title.trim()) throw new Error('Every track needs a title.') })
        albumId = releaseId
        const albumSlug = `${safeTitle}-${releaseId.slice(0, 8)}`
        const albumInsert = await db.from('albums').insert({ id: albumId, artist_id: artist.data.id, title: cleanTitle, slug: albumSlug, cover_path: coverPath, release_type: releaseType, release_status: 'scheduled', release_at: schedule.toISOString() })
        if (albumInsert.error) throw albumInsert.error
        for (const [index, track] of albumTracks.entries()) {
          setProgress(`Uploading track ${index + 1} of ${albumTracks.length}: ${track.title}`)
          const trackId = crypto.randomUUID()
          const trackSlugBase = slugify(track.title) || trackId
          const audioPath = `${artist.data.id}/tracks/${trackId}-${trackSlugBase}.${fileExtension(track.file.name, 'mp3')}`
          const duration = await readAudioDuration(track.file)
          const upload = await db.storage.from('audio').upload(audioPath, track.file, { upsert: false, contentType: track.file.type || 'audio/mpeg' })
          if (upload.error) throw upload.error
          uploadedAudio.push(audioPath)
          const insert = await db.from('tracks').insert({ id: trackId, artist_id: artist.data.id, album_id: albumId, title: track.title.trim(), slug: `${albumSlug}-${trackSlugBase}-${trackId.slice(0, 5)}`, audio_path: audioPath, cover_path: coverPath, duration_seconds: Math.round(duration), track_number: index + 1, genre, mood: mood || null, explicit, downloadable: true, release_status: 'scheduled', release_at: schedule.toISOString() })
          if (insert.error) throw insert.error
        }
      }
    } catch (error) {
      if (albumId) await db.from('albums').delete().eq('id', albumId)
      if (uploadedAudio.length) await db.storage.from('audio').remove(uploadedAudio)
      await db.storage.from('covers').remove([coverPath])
      throw error
    }
  }, onSuccess: async () => { setProgress('Release scheduled.'); await client.invalidateQueries({ queryKey: ['my-catalog'] }); navigate('/dashboard?tab=watch') }, onError: () => setProgress('') })

  if (auth.loading || artist.isLoading) return <LoadingState />
  if (!auth.user) return <Navigate to="/auth" replace />
  if (!auth.isArtist) return <Navigate to="/" replace />
  const submit = (event: FormEvent) => { event.preventDefault(); if (!publish.isPending) publish.mutate() }
  const chooseAlbumTracks = (files: FileList | null) => setAlbumTracks(Array.from(files ?? []).map((file) => ({ id: crypto.randomUUID(), file, title: titleFromFile(file.name) })))

  return <div className="upload-page"><div className="page-heading"><div><span className="eyebrow"><UploadCloud />Artist upload</span><h1>Schedule a release</h1><p>Music stays private until its release date and time.</p></div></div><div className="segmented release-switch"><button type="button" className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>Single</button><button type="button" className={mode === 'album' ? 'active' : ''} onClick={() => setMode('album')}>Album / EP</button></div><form className="upload-form" onSubmit={submit}>
    <label className="cover-picker">{coverPreview ? <img src={coverPreview} alt="Selected cover preview" /> : <span><ImagePlus />Choose square cover art<small>JPG, PNG or WebP · maximum 5MB</small></span>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setCover(event.target.files?.[0] ?? null)} /></label>
    <div className="form-grid"><label className="wide">{mode === 'single' ? 'Song title' : 'Album title'}<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>{mode === 'album' && <label>Release type<select value={releaseType} onChange={(event) => setReleaseType(event.target.value as 'album' | 'ep')}><option value="album">Album</option><option value="ep">EP</option></select></label>}<label>Genre<select value={genre} onChange={(event) => setGenre(event.target.value)}>{genres.map((value) => <option key={value}>{value}</option>)}</select></label><label>Mood<select value={mood} onChange={(event) => setMood(event.target.value)}><option value="">No mood</option>{moods.map((value) => <option key={value}>{value}</option>)}</select></label><label className="wide"><span className="label-with-icon"><CalendarClock />Release date and time</span><input type="datetime-local" value={releaseAt} onChange={(event) => setReleaseAt(event.target.value)} required /></label>{mode === 'single' ? <label className="file-picker wide"><Music2 />{audio ? audio.name : 'Choose audio file'}<small>MP3, WAV, M4A, AAC, OGG or WebM · maximum 60MB</small><input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm" onChange={(event) => setAudio(event.target.files?.[0] ?? null)} /></label> : <><label className="file-picker wide"><Music2 />{albumTracks.length ? `${albumTracks.length} tracks selected` : 'Choose album audio files'}<small>Select files in track order. You can correct every title below.</small><input type="file" multiple accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm" onChange={(event) => chooseAlbumTracks(event.target.files)} /></label><div className="album-track-editor wide">{albumTracks.map((track, index) => <div key={track.id}><span>{index + 1}</span><label>Track title<input value={track.title} onChange={(event) => setAlbumTracks((items) => items.map((item) => item.id === track.id ? { ...item, title: event.target.value } : item))} /></label><small>{track.file.name}</small><button type="button" className="icon-button" onClick={() => setAlbumTracks((items) => items.filter((item) => item.id !== track.id))} aria-label={`Remove ${track.title}`}><Trash2 /></button></div>)}</div></>}<label className="check-label wide"><input type="checkbox" checked={explicit} onChange={(event) => setExplicit(event.target.checked)} />Contains explicit content</label>{progress && <p className="form-message success wide" role="status">{progress}</p>}{publish.error && <p className="form-message error wide" role="alert">{publish.error.message}</p>}<button className="button primary" disabled={publish.isPending}><UploadCloud />{publish.isPending ? 'Uploading...' : 'Schedule release'}</button></div>
  </form></div>
}

function validateCover(file: File) {
  const extension = fileExtension(file.name, '')
  if (!(file.type.startsWith('image/') || ['jpg','jpeg','png','webp'].includes(extension)) || file.size > 5 * 1024 * 1024) throw new Error('Use JPG, PNG, or WebP cover art smaller than 5MB.')
}

function validateAudio(file: File) {
  const extension = fileExtension(file.name, '')
  if (!(file.type.startsWith('audio/') || ['mp3','wav','m4a','aac','ogg','webm'].includes(extension)) || file.size > 60 * 1024 * 1024) throw new Error(`${file.name} is not a supported audio file smaller than 60MB.`)
}

function fileExtension(name: string, fallback: string) { return name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || fallback }
function titleFromFile(name: string) { return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() }

function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio')
    const url = URL.createObjectURL(file)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => { const duration = audio.duration; URL.revokeObjectURL(url); if (Number.isFinite(duration)) resolve(duration); else reject(new Error(`Could not read the duration of ${file.name}.`)) }
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not read ${file.name}.`)) }
    audio.src = url
  })
}
