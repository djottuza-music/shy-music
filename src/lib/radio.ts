import type { Track } from '../types'

export type RadioFilter = { kind: 'all' } | { kind: 'mood' | 'genre'; value: string }

export function tracksForStation(tracks: Track[], filter: RadioFilter) {
  if (filter.kind === 'all') return [...tracks]
  const target = filter.value.toLocaleLowerCase()
  return tracks.filter((track) => {
    const values = filter.kind === 'genre' ? track.genres : track.moods
    if (values?.length) return values.some((value) => value.toLocaleLowerCase() === target)
    return (track[filter.kind] ?? '').toLocaleLowerCase() === target
  })
}

export function shuffled<T>(items: T[], random = Math.random) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}
