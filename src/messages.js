// Pure helpers with no WhatsApp or Google calls, so they can be unit tested.
import { getContentType, normalizeMessageContent } from 'baileys'

// Accepts "2026-10-20 09:00", "2026-10-20T09:00", "20.10.2026 09:00",
// "20/10/2026 9:00", "10/20/2026 9:00:00 AM", or a Google Sheets serial
// number like "46315.375". Slash dates are day-first unless dateOrder is
// "MDY" or the first number can only be a month. Dates are read in the
// server's local time zone (set TZ in .env).
export function parseSendAt(value, dateOrder = 'DMY') {
  const text = String(value ?? '').trim()
  if (!text) return null

  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text)
    // Sheets serial 0 is 1899-12-30; whole days plus a fraction of a day.
    const days = Math.floor(serial)
    const ms = Math.round((serial - days) * 86400000)
    const date = new Date(1899, 11, 30 + days)
    return new Date(date.getTime() + ms)
  }

  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (m) return build(m[1], m[2], m[3], m[4], m[5], m[6])

  m = text.match(/^(\d{1,2})([./])(\d{1,2})[./](\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/)
  if (m) {
    const [, a, sep, b, y, h, mi, s, ampm] = m
    const monthFirst = sep === '/' && (Number(b) > 12 || (dateOrder === 'MDY' && Number(a) <= 12))
    const [d, mo] = monthFirst ? [b, a] : [a, b]
    let hour = Number(h ?? 0)
    if (ampm) hour = (hour % 12) + (/p/i.test(ampm) ? 12 : 0)
    return build(y, mo, d, hour, mi, s)
  }

  return null
}

function build(y, mo, d, h = 0, mi = 0, s = 0) {
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
  if (date.getMonth() !== Number(mo) - 1) return null
  return date
}

export function formatDate(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`
}

// Moves a repeating row's next send time forward until it is in the future.
// Returns null when the repeat value is empty or unknown.
export function nextRepeat(sendAt, repeat, now = new Date()) {
  if (!sendAt) return null
  const kind = String(repeat ?? '').trim().toLowerCase()
  const step = { daily: [0, 1], weekly: [0, 7], monthly: [1, 0] }[kind]
  if (!step) return null
  const next = new Date(sendAt)
  const day = sendAt.getDate()
  do {
    if (step[0]) {
      next.setDate(1)
      next.setMonth(next.getMonth() + step[0])
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
      next.setDate(Math.min(day, lastDay))
    } else {
      next.setDate(next.getDate() + step[1])
    }
  } while (next <= now)
  return next
}

// "+996 555 12-34-56" -> "996555123456@s.whatsapp.net"
export function phoneToJid(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length < 7) return null
  return `${digits}@s.whatsapp.net`
}

export function jidToPhone(jid) {
  if (!jid) return ''
  return '+' + jid.split('@')[0].split(':')[0]
}

export function fillTemplate(text, values) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (all, key) => {
    const found = Object.keys(values).find((k) => k.toLowerCase() === key.toLowerCase())
    return found === undefined ? all : String(values[found] ?? '')
  })
}

// Returns the readable text of an incoming message, or a [type] label for
// media without a caption. Returns null for protocol messages with no content.
export function extractText(message) {
  const content = normalizeMessageContent(message)
  if (!content) return null
  const type = getContentType(content)
  if (!type || type === 'protocolMessage' || type === 'senderKeyDistributionMessage' || type === 'reactionMessage') return null

  const inner = content[type]
  if (type === 'conversation') return inner
  if (typeof inner?.text === 'string') return inner.text
  if (typeof inner?.caption === 'string' && inner.caption) return inner.caption
  if (type === 'locationMessage') return `[location ${inner.degreesLatitude}, ${inner.degreesLongitude}]`
  if (type === 'contactMessage') return `[contact ${inner.displayName ?? ''}]`.trim()
  return `[${type.replace(/Message$/, '')}]`
}

// "15/10/2026", the date format used for the day columns in Sheet1.
export function formatDay(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()}`
}

export function sameDay(a, b) {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export const digitsOf = (value) => String(value ?? '').replace(/\D/g, '')

// True when two phone numbers are the same person. Allows one side to be
// written without the country code (e.g. 0705608170 vs 996705608170).
export function phonesMatch(a, b) {
  const x = digitsOf(a)
  const y = digitsOf(b)
  if (x.length < 7 || y.length < 7) return false
  if (x === y) return true
  return x.slice(-9) === y.slice(-9)
}

// Returns the number in a reply like "20", "сделал 25" or "12,5",
// or null when there is no number or more than one.
export function extractNumber(text) {
  const found = String(text ?? '').match(/-?\d+(?:[.,]\d+)?/g)
  if (!found || found.length !== 1) return null
  return Number(found[0].replace(',', '.'))
}
