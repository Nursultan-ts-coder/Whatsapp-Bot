import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extractText, fillTemplate, formatDate, jidToPhone, nextRepeat, parseSendAt, phoneToJid } from '../src/messages.js'

test('parseSendAt reads the date formats Google Sheets shows', () => {
  assert.equal(formatDate(parseSendAt('2026-10-20 09:05')), '2026-10-20 09:05')
  assert.equal(formatDate(parseSendAt('2026-10-20T09:05')), '2026-10-20 09:05')
  assert.equal(formatDate(parseSendAt('20.10.2026 9:05:00')), '2026-10-20 09:05')
  assert.equal(formatDate(parseSendAt('20/10/2026 9:05')), '2026-10-20 09:05')
  assert.equal(formatDate(parseSendAt('10/20/2026 9:05:00 PM')), '2026-10-20 21:05')
  assert.equal(formatDate(parseSendAt('03/04/2026 12:00 AM', 'MDY')), '2026-03-04 00:00')
  assert.equal(formatDate(parseSendAt('03/04/2026 10:00')), '2026-04-03 10:00')
  assert.equal(formatDate(parseSendAt('2026-10-20')), '2026-10-20 00:00')
  assert.equal(formatDate(parseSendAt('46315.375')), '2026-10-20 09:00')
  assert.equal(parseSendAt(''), null)
  assert.equal(parseSendAt('next friday'), null)
  assert.equal(parseSendAt('2026-02-30 10:00'), null)
})

test('nextRepeat moves the time past now', () => {
  const now = new Date(2026, 9, 15, 12, 0)
  assert.equal(formatDate(nextRepeat(new Date(2026, 9, 15, 9, 0), 'daily', now)), '2026-10-16 09:00')
  assert.equal(formatDate(nextRepeat(new Date(2026, 9, 1, 9, 0), 'Weekly', now)), '2026-10-22 09:00')
  assert.equal(formatDate(nextRepeat(new Date(2026, 0, 31, 9, 0), 'monthly', now)), '2026-10-31 09:00')
  assert.equal(formatDate(nextRepeat(new Date(2026, 8, 30, 9, 0), 'monthly', now)), '2026-10-30 09:00')
  assert.equal(nextRepeat(new Date(2026, 9, 15), '', now), null)
  assert.equal(nextRepeat(null, 'daily', now), null)
})

test('phone numbers and WhatsApp ids', () => {
  assert.equal(phoneToJid('+996 555 12-34-56'), '996555123456@s.whatsapp.net')
  assert.equal(phoneToJid('123'), null)
  assert.equal(jidToPhone('996555123456@s.whatsapp.net'), '+996555123456')
  assert.equal(jidToPhone('996555123456:12@s.whatsapp.net'), '+996555123456')
})

test('fillTemplate fills columns by name, ignoring case', () => {
  assert.equal(fillTemplate('Hi {name}, see you {Day}!', { Name: 'Aibek', Day: 'Friday' }), 'Hi Aibek, see you Friday!')
  assert.equal(fillTemplate('Hi {unknown}', { Name: 'A' }), 'Hi {unknown}')
})

test('extractText handles text, captions, media and protocol messages', () => {
  assert.equal(extractText({ conversation: 'hello' }), 'hello')
  assert.equal(extractText({ extendedTextMessage: { text: 'link https://x.y' } }), 'link https://x.y')
  assert.equal(extractText({ imageMessage: { caption: 'look' } }), 'look')
  assert.equal(extractText({ audioMessage: {} }), '[audio]')
  assert.equal(extractText({ ephemeralMessage: { message: { conversation: 'secret' } } }), 'secret')
  assert.equal(extractText({ protocolMessage: {} }), null)
  assert.equal(extractText(undefined), null)
})

test('Sheet1 helpers: day headers, phone matching and number replies', async () => {
  const { formatDay, sameDay, phonesMatch, extractNumber, parseSendAt } = await import('../src/messages.js')
  assert.equal(formatDay(new Date(2026, 9, 5)), '05/10/2026')
  assert.ok(sameDay(parseSendAt('15/10/2026'), new Date(2026, 9, 15, 18, 30)))
  assert.ok(!sameDay(parseSendAt('10/09/2026'), new Date(2026, 9, 9)))
  assert.ok(!sameDay(parseSendAt('phone'), new Date()))

  assert.ok(phonesMatch('996705608170', '+996705608170'))
  assert.ok(phonesMatch('0705608170', '+996 705 608 170'))
  assert.ok(!phonesMatch('996705608170', '996705608171'))
  assert.ok(!phonesMatch('', '+996705608170'))

  assert.equal(extractNumber('20'), 20)
  assert.equal(extractNumber(' сделал 25 '), 25)
  assert.equal(extractNumber('12,5'), 12.5)
  assert.equal(extractNumber('спасибо'), null)
  assert.equal(extractNumber('20 и 30'), null)
})

test('nextSendTime finds the next DAILY_TIME', async () => {
  process.env.GOOGLE_SHEET_ID ||= 'test'
  const { nextSendTime } = await import('../src/daily.js')
  const { formatDate } = await import('../src/messages.js')
  assert.equal(formatDate(nextSendTime('22:00', new Date(2026, 9, 15, 13, 0))), '2026-10-15 22:00')
  assert.equal(formatDate(nextSendTime('22:00', new Date(2026, 9, 15, 22, 0))), '2026-10-16 22:00')
  assert.equal(formatDate(nextSendTime('9:30', new Date(2026, 9, 31, 23, 0))), '2026-11-01 09:30')
  assert.equal(nextSendTime('', new Date()), null)
  assert.equal(nextSendTime('soon', new Date()), null)
})
