import { describe, expect, it } from 'vitest'
import { canUseAccountMode } from './accountMode'

describe('account experience access', () => {
  it('allows every account to use listener mode', () => {
    expect(canUseAccountMode(['listener'], 'listener')).toBe(true)
  })

  it('requires an artist or admin role for artist mode', () => {
    expect(canUseAccountMode(['listener'], 'artist')).toBe(false)
    expect(canUseAccountMode(['artist'], 'artist')).toBe(true)
    expect(canUseAccountMode(['admin'], 'artist')).toBe(true)
  })
})
