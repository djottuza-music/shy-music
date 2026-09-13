import type { Track } from '../types'

export type RadioFilter = { kind: 'all' } | { kind: 'mood' | 'genre'; value: string }

export function tracksForStation(tracks: Track[], filter: RadioFilter) {
  if (filter.kind === 'all') return [...tracks]
  return tracks.filter((track) => (track[filter.kind] ?? '').toLocaleLowerCase() === filter.value.toLocaleLowerCase())
}

export function shuffled<T>(items: T[], random = Math.random) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}
