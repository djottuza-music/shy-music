import JSZip from 'jszip'
import { useQuery } from '@tanstack/react-query'
import { Download, Pause, Play, Share2, Shuffle } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Comments } from '../components/Comments'
import { MetadataChips } from '../components/MetadataChips'
import { ReportButton } from '../components/ReportButton'
import { Cover, ErrorState, LoadingState } from '../components/States'
import { TrackRow } from '../components/TrackRow'
import { usePlayer } from '../contexts/usePlayer'
import { getAlbum, getDownloadUrl } from '../lib/catalog'
import { trackDownloadName } from '../lib/download'
import { formatCount, formatDuration } from '../lib/format'

export function AlbumPage() {
  const { slug = '' } = useParams()
  const result = useQuery({ queryKey: ['album', slug], queryFn: () => getAlbum(slug) })
  const player = usePlayer()
  const [message, setMessage] = useState('')
  const [downloadProgress, setDownloadProgress] = useState(0)
  if (result.isLoading) return <LoadingState label="Loading album..." />
  if (result.error || !result.data) return <ErrorState error={result.error ?? new Error('Album not found.')} retry={() => void result.refetch()} />
  const { album, tracks } = result.data
  const active = tracks.some((track) => track.id === player.current?.id)
  const totalDuration = album.total_duration_seconds || tracks.reduce((sum, track) => sum + track.duration_seconds, 0)
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `${album.title} on SHY`, url: window.location.href })
      else { await navigator.clipboard.writeText(window.location.href); setMessage('Album link copied.') }
    } catch (caught) { if ((caught as DOMException).name !== 'AbortError') setMessage('The album link could not be shared.') }
  }
  const playAll = () => {
    if (!tracks.length) return
    if (active) void player.toggle()
    else { player.setShuffle(false); void player.play(tracks[0], tracks) }
  }
  const shuffle = () => {
    if (!tracks.length) return
    const shuffled = [...tracks].sort(() => Math.random() - .5)
    player.setShuffle(true)
    void player.play(shuffled[0], shuffled)
  }
  const downloadAlbum = async () => {
    const downloadable = tracks.filter((track) => track.downloadable)
    if (!downloadable.length) { setMessage('No tracks in this album are available to download.'); return }
    setMessage(''); setDownloadProgress(1)
    try {
      const zip = new JSZip()
      for (let index = 0; index < downloadable.length; index += 1) {
        const track = downloadable[index]
        const url = await getDownloadUrl(track.id, trackDownloadName(track))
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Could not download ${track.title}.`)
        zip.file(`${String(index + 1).padStart(2, '0')} ${trackDownloadName(track)}`, await response.blob())
        setDownloadProgress(Math.round(((index + 1) / downloadable.length) * 75))
      }
      const blob = await zip.generateAsync({ type: 'blob' }, (metadata) => setDownloadProgress(75 + Math.round(metadata.percent * .25)))
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = `${album.title.replace(/[<>:"/\\|?*]/g, '').trim() || 'SHY Album'}.zip`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
      setMessage('Album download started.')
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Album download failed.') } finally { setDownloadProgress(0) }
  }

  return <div className="release-detail-page"><section className="album-hero"><Cover src={album.cover_url} alt={album.title} className="album-cover-large" /><div className="release-copy"><span className="eyebrow">{album.release_type}</span><h1>{album.title}</h1>{album.artist && <Link className="artist-link" to={`/artists/${album.artist.slug}`}>{album.artist.display_name}</Link>}<p>{album.release_at ? new Date(album.release_at).getFullYear() : 'Unreleased'} · {tracks.length} tracks · {formatDuration(totalDuration)}</p><MetadataChips values={album.genres} /><MetadataChips values={album.moods} tone="neutral" /><div className="stat-line"><span>{formatCount(tracks.reduce((sum, track) => sum + track.plays_count, 0))} streams</span><span>{formatCount(tracks.reduce((sum, track) => sum + (track.downloads_count ?? 0), 0))} downloads</span></div><div className="hero-actions">{tracks[0] && <button className="button primary large-action" onClick={playAll}>{active && player.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}{active && player.isPlaying ? 'Pause' : 'Play All'}</button>}<button className="button secondary" onClick={shuffle}><Shuffle />Shuffle</button><button className="button secondary" onClick={() => void downloadAlbum()} disabled={downloadProgress > 0}><Download />{downloadProgress ? `Preparing ${downloadProgress}%` : 'Download Album'}</button><button className="button secondary" onClick={() => void share()}><Share2 />Share</button><ReportButton targetType="album" targetId={album.id} targetName={album.title} /></div>{message && <p className="form-message" role="status">{message}</p>}</div></section><section className="release-section"><div className="section-heading"><h2>Tracklist</h2><span>{tracks.length} tracks</span></div><div className="track-list">{tracks.map((track, index) => <TrackRow key={track.id} track={track} queue={tracks} index={index} />)}</div></section>{album.description && <section className="release-section"><h2>About this album</h2><details className="expandable-copy" open={album.description.length < 320}><summary>Read album notes</summary><p>{album.description}</p></details></section>}<Comments albumId={album.id} /></div>
}
