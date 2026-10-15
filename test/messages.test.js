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
