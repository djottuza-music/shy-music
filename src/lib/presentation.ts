export function sanitizePlainText(value: string) {
  return value.replace(/<[^>]*>/g, '').trim()
}

export function formatFriendlyDate(value: string | Date, now = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.round((startToday.getTime() - startDate.getTime()) / 86_400_000)
  const time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date)
  if (days === 0) return `Today at ${time}`
  if (days === 1) return `Yesterday at ${time}`
  if (days > 1 && days < 7) return `${new Intl.DateTimeFormat('en', { weekday: 'long' }).format(date)} at ${time}`
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function formatZambianPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 10)].filter(Boolean).join(' ')
}
