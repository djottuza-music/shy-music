import type { Track } from '../types'
import { getDownloadUrl } from './catalog'

export function trackDownloadName(track: Track) {
  const candidate = track.audio_path.includes('.') ? track.audio_path.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  const extension = candidate && ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm', 'flac'].includes(candidate) ? candidate : 'mp3'
  const artist = track.artist?.display_name ?? 'SHY'
  return `${safeFilePart(artist)} - ${safeFilePart(track.title)}.${extension}`
}

export async function startTrackDownload(track: Track) {
  const fileName = trackDownloadName(track)
  const url = await getDownloadUrl(track.id, fileName)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function safeFilePart(value: string) {
  const forbidden = '<>:"/\\|?*'
  return [...value].filter((character) => character.charCodeAt(0) >= 32 && !forbidden.includes(character)).join('').replace(/\s+/g, ' ').trim().slice(0, 100) || 'SHY Music'
}
