export const africanGenres = [
  'Zamrock', 'Kalindula', 'Afrobeats', 'Afropop', 'Afrosoul', 'Bongo Flava', 'Highlife', 'Kwaito',
  'Amapiano', 'Gqom', 'Afrohouse', 'Soukous', 'Ndombolo', 'Jùjú', 'Makossa', 'Benga', 'Taarab',
  'Fuji', 'Afrojuju', 'Township Jazz', 'Mbaqanga', 'Chimurenga', 'Bikutsi',
] as const

export const globalGenres = [
  'Hiphop', 'R&B', 'Soul', 'Jazz', 'Blues', 'Gospel', 'Electronic', 'House', 'Techno', 'Drum & Bass',
  'Ambient', 'Lo-fi', 'Classical', 'Orchestral', 'Cinematic / Soundtrack', 'Pop', 'Indie Pop',
  'Alternative', 'Rock', 'Metal', 'Punk', 'Reggae', 'Dancehall', 'Latin', 'Bossa Nova', 'Folk',
  'Country', 'World Music', 'Experimental', 'Spoken Word', 'Podcast / Audio Drama',
] as const

export const genres = [...africanGenres, ...globalGenres] as const

export const moods = [
  'Chill', 'Energetic', 'Romantic', 'Melancholy', 'Uplifting', 'Dark', 'Nostalgic', 'Angry', 'Peaceful',
  'Spiritual / Devotional', 'Focused / Study', 'Hype / Party', 'Sad', 'Happy', 'Dreamy', 'Motivational',
  'Late Night', 'Morning Vibes', 'Road Trip', 'Workout', 'Heartbreak', 'Celebratory', 'Cinematic / Epic',
  'Mysterious', 'Playful',
] as const

export const aiTools = [
  'Suno', 'Udio', 'Stable Audio', 'Loudly', 'Beatoven', 'Mubert', 'AIVA', 'Soundraw', 'Boomy',
  'Custom / In-house Model', 'Human-made (not AI)', 'Other',
] as const

export const keySignatures = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export function toggleLimitedValue(values: string[], value: string, maximum = 3) {
  if (values.includes(value)) return values.filter((item) => item !== value)
  if (values.length >= maximum) return values
  return [...values, value]
}

export function normalizedMetadata(values?: string[] | null, legacy?: string | null) {
  const source = values?.length ? values : legacy ? [legacy] : []
  return [...new Set(source.map((item) => item.trim()).filter(Boolean))].slice(0, 3)
}
