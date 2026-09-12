import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, ImagePlus, Music2, UploadCloud } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { requireSupabase } from '../lib/supabase'
import { slugify } from '../lib/format'
import { LoadingState } from '../components/States'

const moods = ['Happy','Joyful','Cheerful','Uplifting','Energetic','Exciting','Playful','Fun','Hopeful','Motivational','Confident','Powerful','Triumphant','Peaceful','Calm','Relaxing','Dreamy','Gentle','Romantic','Passionate','Flirty','Sensual','Emotional','Heartfelt','Nostalgic','Sentimental','Reflective','Thoughtful','Melancholic','Sad','Heartbroken','Lonely','Regretful','Dark','Mysterious','Haunting','Suspenseful','Angry','Aggressive','Rebellious','Intense','Anxious','Tense','Spiritual','Inspirational','Carefree','Chill','Groovy','Euphoric','Bittersweet','Cinematic','Epic','Adventurous','Festive','Romantic and sad','Calm and emotional','Dark and energetic','Nostalgic and hopeful','Dreamy and peaceful']

export function UploadPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('Afropop')
  const [mood, setMood] = useState('')
  const [releaseAt, setReleaseAt] = useState('')
  const [cover, setCover] = useState<File | null>(null)
  const [audio, setAudio] = useState<File | null>(null)
  const [explicit, setExplicit] = useState(false)
  const coverPreview = useMemo(() => cover ? URL.createObjectURL(cover) : '', [cover])
  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview) }, [coverPreview])
  const artist = useQuery({ queryKey: ['my-artist', auth.user?.id], queryFn: async () => {
    const { data, error } = await requireSupabase().from('artists').select('id,slug').eq('user_id', auth.user!.id).single()
    if (error) throw error
    return data as { id: string; slug: string }
  }, enabled: Boolean(auth.user && auth.isArtist) })

  const publish = useMutation({ mutationFn: async () => {
    if (!artist.data) throw new Error('Artist profile is not ready.')
    if (!title.trim()) throw new Error('Enter a song title.')
    if (!audio || !cover) throw new Error('Choose both an audio file and cover art.')
    if (!releaseAt || new Date(releaseAt) <= new Date()) throw new Error('Schedule the release for a future date and time.')
    if (!audio.type.startsWith('audio/') || audio.size > 60 * 1024 * 1024) throw new Error('Use an audio file smaller than 60MB.')
    if (!cover.type.startsWith('image/') || cover.size > 5 * 1024 * 1024) throw new Error('Use a cover image smaller than 5MB.')
    const db = requireSupabase()
    const id = crypto.randomUUID()
    const safeTitle = slugify(title) || id
    const audioPath = `${artist.data.id}/${id}-${safeTitle}.${audio.name.split('.').pop()?.toLowerCase()}`
    const coverPath = `${artist.data.id}/${id}-${safeTitle}.${cover.name.split('.').pop()?.toLowerCase()}`
    const [audioUpload, coverUpload] = await Promise.all([
      db.storage.from('audio').upload(audioPath, audio, { upsert: false, contentType: audio.type }),
      db.storage.from('covers').upload(coverPath, cover, { upsert: false, contentType: cover.type }),
    ])
    if (audioUpload.error) throw audioUpload.error
    if (coverUpload.error) {
      await db.storage.from('audio').remove([audioPath])
      throw coverUpload.error
    }
    const duration = await readAudioDuration(audio)
    const { error } = await db.from('tracks').insert({ id, artist_id: artist.data.id, title: title.trim(), slug: `${safeTitle}-${id.slice(0, 8)}`, audio_path: audioPath, cover_path: coverPath, duration_seconds: Math.round(duration), genre, mood: mood || null, explicit, downloadable: true, release_status: 'scheduled', release_at: new Date(releaseAt).toISOString() })
    if (error) {
      await Promise.all([db.storage.from('audio').remove([audioPath]), db.storage.from('covers').remove([coverPath])])
      throw error
    }
  }, onSuccess: async () => { await client.invalidateQueries({ queryKey: ['my-catalog'] }); navigate('/dashboard?tab=watch') } })

  if (auth.loading || artist.isLoading) return <LoadingState />
  if (!auth.user) return <Navigate to="/auth" replace />
  if (!auth.isArtist) return <Navigate to="/" replace />
  const submit = (event: FormEvent) => { event.preventDefault(); publish.mutate() }
  return <div className="upload-page"><div className="page-heading"><div><span className="eyebrow"><UploadCloud />Artist upload</span><h1>Schedule a single</h1><p>Music stays private until its release date and time.</p></div></div><form className="upload-form" onSubmit={submit}>
    <label className="cover-picker">{coverPreview ? <img src={coverPreview} alt="Selected cover preview" /> : <span><ImagePlus />Choose square cover art<small>JPG, PNG or WebP · maximum 5MB</small></span>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setCover(event.target.files?.[0] ?? null)} /></label>
    <div className="form-grid"><label className="wide">Title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label>Genre<select value={genre} onChange={(event) => setGenre(event.target.value)}><option>Afropop</option><option>Afrobeats</option><option>Electronic</option><option>Hip-hop</option><option>R&B</option><option>Gospel</option><option>Pop</option><option>Other</option></select></label><label>Mood<select value={mood} onChange={(event) => setMood(event.target.value)}><option value="">No mood</option>{moods.map((value) => <option key={value}>{value}</option>)}</select></label><label className="wide"><span className="label-with-icon"><CalendarClock />Release date and time</span><input type="datetime-local" value={releaseAt} onChange={(event) => setReleaseAt(event.target.value)} required /></label><label className="file-picker wide"><Music2 />{audio ? audio.name : 'Choose audio file'}<small>MP3, WAV, M4A, AAC, OGG or WebM · maximum 60MB</small><input type="file" accept="audio/*" onChange={(event) => setAudio(event.target.files?.[0] ?? null)} /></label><label className="check-label wide"><input type="checkbox" checked={explicit} onChange={(event) => setExplicit(event.target.checked)} />Contains explicit content</label>{publish.error && <p className="form-message error wide">{publish.error.message}</p>}<button className="button primary" disabled={publish.isPending}><UploadCloud />{publish.isPending ? 'Uploading...' : 'Schedule release'}</button></div>
  </form></div>
}

function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio')
    const url = URL.createObjectURL(file)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => { const duration = audio.duration; URL.revokeObjectURL(url); resolve(duration) }
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read the audio file.')) }
    audio.src = url
  })
}
