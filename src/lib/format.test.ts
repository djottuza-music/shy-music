import { describe, expect, it } from 'vitest'
import { formatDuration, slugify } from './format'

describe('formatDuration', () => {
  it('formats complete minutes and seconds', () => expect(formatDuration(221)).toBe('3:41'))
  it('handles invalid values', () => expect(formatDuration(Number.NaN)).toBe('0:00'))
})

describe('slugify', () => {
  it('creates stable URL text', () => expect(slugify("If It Wasn't for Given")).toBe('if-it-wasn-t-for-given'))
})
