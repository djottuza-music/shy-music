import { describe, expect, it } from 'vitest'
import { formatFriendlyDate, formatZambianPhone, sanitizePlainText } from './presentation'

describe('presentation helpers', () => {
  it('strips markup before saving user text', () => expect(sanitizePlainText(' <b>Hello</b><script>x</script> ')).toBe('Hellox'))
  it('formats Zambian mobile numbers as they are typed', () => expect(formatZambianPhone('0976123456')).toBe('0976 123 456'))
  it('uses friendly relative dates', () => {
    const now = new Date('2026-09-13T15:00:00')
    expect(formatFriendlyDate('2026-09-13T14:34:00', now)).toContain('Today at')
    expect(formatFriendlyDate('2026-09-12T10:15:00', now)).toContain('Yesterday at')
  })
})
