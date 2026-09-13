import { describe, expect, it } from 'vitest'
import { normalizedMetadata, toggleLimitedValue } from './taxonomy'

describe('taxonomy helpers', () => {
  it('enforces the three-value selection limit', () => {
    expect(toggleLimitedValue(['Pop', 'Soul', 'Jazz'], 'Rock')).toEqual(['Pop', 'Soul', 'Jazz'])
  })

  it('allows a selected value to be removed at the limit', () => {
    expect(toggleLimitedValue(['Pop', 'Soul', 'Jazz'], 'Soul')).toEqual(['Pop', 'Jazz'])
  })

  it('normalizes arrays and supports legacy metadata', () => {
    expect(normalizedMetadata([], ' Afropop ')).toEqual(['Afropop'])
    expect(normalizedMetadata(['Pop', 'Pop', 'Soul', 'Jazz', 'Rock'])).toEqual(['Pop', 'Soul', 'Jazz'])
  })
})
