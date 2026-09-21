import JSZip from 'jszip'
import { useQuery } from '@tanstack/react-query'
import { Download, Pause, Play, Shuffle } from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlbumCard, TrackCard } from '../components/Cards'
import { Comments } from '../components/Comments'
import { ReportButton } from '../components/ReportButton'
import { Cover, ErrorState, LoadingState } from '../components/States'
import { TrackRow } from '../components/TrackRow'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { usePlayer } from '../contexts/usePlayer'
import { getAlbum, getDownloadUrl, listArtistCatalog, listPublishedTracks } from '../lib/catalog'
import { trackDownloadName } from '../lib/download'
import { formatDuration } from '../lib/format'

type AlbumPalette = { color: string; rgb: string }
const defaultPalette: AlbumPalette = { color: '#7C3AED', rgb: '124,58,237' }

export function AlbumPage() {
  const { slug = '' } = useParams()
  const result = useQuery({ queryKey: ['album', slug], queryFn: () => getAlbum(slug) })
  const artistCatalog = useQuery({ queryKey: ['album-artist-catalog', result.data?.album.artist_id], queryFn: () => listArtistCatalog(result.data!.album.artist_id), enabled: Boolean(result.data?.album.artist_id) })
  const recommendations = useQuery({ queryKey: ['album-recommendations'], queryFn: () => listPublishedTracks(50) })
  const player = usePlayer()
  const [message, setMessage] = useState('')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const palette = useAlbumPalette(result.data?.album.cover_url)

  useEffect(() => {
    let frame = 0
    const update = () => { frame = 0; setCollapsed(window.scrollY > (window.innerWidth <= 760 ? 200 : 280)) }
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    update(); window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (frame) window.cancelAnimationFrame(frame) }
  }, [])

  if (result.isLoading) return <LoadingState label="Loading album..." />
  if (result.error || !result.data) return <ErrorState error={result.error ?? new Error('Album not found.')} retry={() => void result.refetch()} />
  const { album, tracks } = result.data
  const active = tracks.some((track) => track.id === player.current?.id)
  const totalDuration = album.total_duration_seconds || tracks.reduce((sum, track) => sum + track.duration_seconds, 0)
  const otherAlbums = (artistCatalog.data?.albums ?? []).filter((item) => item.id !== album.id).slice(0, 8)
  const relatedTracks = (recommendations.data ?? []).filter((track) => track.artist_id !== album.artist_id && track.genres?.some((genre) => album.genres?.includes(genre))).slice(0, 8)
  const albumStyle = { '--album-color': palette.color, '--album-rgb': palette.rgb } as CSSProperties

  const playAll = () => {
    if (!tracks.length) return
    if (active) void player.toggle()
    else { player.setShuffle(false); void player.play(tracks[0], tracks) }
  }
  const shuffle = () => {
    if (!tracks.length) return
    const shuffled = [...tracks].sort(() => Math.random() - .5)
    player.setShuffle(true); void player.play(shuffled[0], shuffled)
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

  return <div className="album-detail-page" style={albumStyle}>
    <header className={`album-sticky-header ${collapsed ? 'visible' : ''}`} aria-hidden={!collapsed}>
      <Cover src={album.cover_url} alt="" /><span><strong>{album.title}</strong><small>{album.artist?.display_name}</small></span><button onClick={playAll} aria-label={`Play ${album.title}`}>{active && player.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button><button onClick={shuffle} aria-label={`Shuffle ${album.title}`}><Shuffle /></button>
    </header>
    <section className="album-detail-hero">
      <Cover src={album.cover_url} alt={`${album.title} cover art`} className="album-detail-cover" />
      <div className="album-detail-copy"><span className="album-type">{album.release_type}</span><h1>{album.title}</h1>{album.artist && <Link className="album-artist-link" to={`/artists/${album.artist.slug}`}><Cover src={album.artist.avatar_url} alt="" />{album.artist.display_name}{album.artist.verified && <VerifiedBadge />}</Link>}<p>{album.release_at ? new Date(album.release_at).getFullYear() : 'Unreleased'} · {tracks.length} Songs · {formatDuration(totalDuration)}{album.genres?.[0] ? ` · ${album.genres[0]}` : ''}{tracks.some((track) => track.explicit) ? ' · E' : ''}</p><div className="album-primary-actions">{tracks[0] && <button className="album-play" onClick={playAll}>{active && player.isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}{active && player.isPlaying ? 'Pause' : 'Play'}</button>}<button className="album-shuffle" onClick={shuffle}><Shuffle />Shuffle</button></div><div className="album-secondary-actions"><button onClick={() => void downloadAlbum()} disabled={downloadProgress > 0} title="Download Album"><Download /><span>{downloadProgress ? `${downloadProgress}%` : 'Download Album'}</span></button><ReportButton targetType="album" targetId={album.id} targetName={album.title} /></div>{message && <p className="form-message" role="status">{message}</p>}</div>
    </section>
    <section className="album-track-list" aria-label={`${album.title} tracks`}>{tracks.map((track, index) => <TrackRow key={track.id} track={track} queue={tracks} index={index} compact />)}</section>
    <section className="album-detail-footer">
      <dl className="album-credits"><Info label="Released" value={album.release_at ? new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date(album.release_at)) : 'Unreleased'} /><Info label="Total Songs" value={String(tracks.length)} /><Info label="Total Duration" value={formatDuration(totalDuration)} /><Info label="Made with" value={tracks.find((track) => track.ai_tool)?.ai_tool ?? 'Not specified'} /><Info label="Genre" value={album.genres?.join(' · ') || 'Not specified'} /><Info label="Mood" value={album.moods?.join(' · ') || 'Not specified'} /></dl>
      {otherAlbums.length > 0 && <section className="album-related"><div className="section-heading"><h2>More by {album.artist?.display_name}</h2><Link to={`/artists/${album.artist?.slug}?tab=albums`}>See All</Link></div><div className="media-grid">{otherAlbums.map((item) => <AlbumCard key={item.id} album={{ ...item, artist: album.artist }} />)}</div></section>}
      {relatedTracks.length > 0 && <section className="album-related"><div className="section-heading"><h2>Listeners Also Played</h2></div><div className="media-grid album-related-tracks">{relatedTracks.map((track) => <TrackCard key={track.id} track={track} queue={relatedTracks} />)}</div></section>}
      {album.description && <section className="release-section"><h2>About this album</h2><p>{album.description}</p></section>}
      <Comments albumId={album.id} />
    </section>
  </div>
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }

function useAlbumPalette(url?: string | null): AlbumPalette {
  const [palette, setPalette] = useState(defaultPalette)
  useEffect(() => {
    if (!url) return
    let cancelled = false
    const timer = window.setTimeout(() => { if (!cancelled) setPalette(defaultPalette) }, 1000)
    const image = new Image(); image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32
        const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) return
        context.drawImage(image, 0, 0, 32, 32)
        const pixels = context.getImageData(0, 0, 32, 32).data
        let r = 0; let g = 0; let b = 0; let weight = 0
        for (let index = 0; index < pixels.length; index += 16) {
          if (pixels[index + 3] < 180) continue
          const max = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]); const min = Math.min(pixels[index], pixels[index + 1], pixels[index + 2])
          const saturation = max ? (max - min) / max : 0; const brightness = (max + min) / 510
          if (brightness < .12 || brightness > .92) continue
          const importance = .2 + saturation
          r += pixels[index] * importance; g += pixels[index + 1] * importance; b += pixels[index + 2] * importance; weight += importance
        }
        if (!weight || cancelled) return
        const rgb = [Math.round(r / weight), Math.round(g / weight), Math.round(b / weight)]
        const max = Math.max(...rgb); const min = Math.min(...rgb); const saturation = max ? (max - min) / max : 0
        const selected = saturation > .4 ? rgb : [124, 58, 237]
        setPalette({ color: `rgb(${selected.join(',')})`, rgb: selected.join(',') })
      } catch { if (!cancelled) setPalette(defaultPalette) } finally { window.clearTimeout(timer) }
    }
    image.onerror = () => { window.clearTimeout(timer); if (!cancelled) setPalette(defaultPalette) }
    image.src = url
    return () => { cancelled = true; window.clearTimeout(timer); image.onload = null; image.onerror = null }
  }, [url])
  return useMemo(() => url ? palette : defaultPalette, [palette, url])
}
