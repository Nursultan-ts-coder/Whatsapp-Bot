import { config } from './config.js'
import { fillTemplate, formatDate, nextRepeat, parseSendAt, phoneToJid } from './messages.js'
import { getScheduleRows } from './sheets.js'
import { getSocket, isReady } from './whatsapp.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const randomDelay = () =>
  1000 * (config.minDelaySeconds + Math.random() * Math.max(0, config.maxDelaySeconds - config.minDelaySeconds))

let running = false

// Every CHECK_EVERY_SECONDS: run the extra job (the daily message), then send
// due rows from the optional Schedule tab.
export function startScheduler(extraJob) {
  const tick = async () => {
    if (extraJob) await extraJob()
    if (running || !isReady()) return
    running = true
    try {
      await sendDueMessages()
    } catch (err) {
      console.error('Schedule check failed:', err.message)
    } finally {
      running = false
    }
  }
  setInterval(tick, config.checkEverySeconds * 1000)
  setTimeout(tick, 5000)
}

// A row is due when SendAt has passed and its Status doesn't say it was
// already sent or failed. Repeating rows get a new SendAt instead.
export function isDue(row, now = new Date()) {
  const status = String(row.get('Status') ?? '').trim().toLowerCase()
  if (status.startsWith('sent') || status.startsWith('error') || status === 'skip') return false
  const sendAt = parseSendAt(row.get('SendAt'), config.dateOrder)
  return sendAt !== null && sendAt <= now
}

async function sendDueMessages() {
  const rows = await getScheduleRows()
  const due = rows.filter((row) => isDue(row))
  let first = true

  for (const row of due) {
    if (!isReady()) return
    if (!first) await sleep(randomDelay())
    first = false

    const now = new Date()
    const jid = phoneToJid(row.get('Phone'))
    const text = fillTemplate(row.get('Message'), row.toObject())

    if (!jid || !text.trim()) {
      row.set('Status', `Error: ${!jid ? 'bad phone number' : 'empty message'}`)
      await row.save({ raw: true })
      continue
    }

    try {
      const sock = getSocket()
      const [result] = await sock.onWhatsApp(jid)
      if (!result?.exists) throw new Error('number is not on WhatsApp')

      // Show "typing..." for a few seconds, like a person would.
      await sock.sendPresenceUpdate('composing', result.jid)
      await sleep(2000 + Math.min(text.length * 50, 6000))
      await sock.sendPresenceUpdate('paused', result.jid)
      await sock.sendMessage(result.jid, { text })

      const next = nextRepeat(parseSendAt(row.get('SendAt'), config.dateOrder), row.get('Repeat'), now)
      if (next) {
        row.set('SendAt', formatDate(next))
        row.set('Status', `Last sent ${formatDate(now)}`)
      } else {
        row.set('Status', `Sent ${formatDate(now)}`)
      }
      console.log(`Sent to ${row.get('Phone')}`)
    } catch (err) {
      row.set('Status', `Error: ${err.message}`)
      console.error(`Failed to send to ${row.get('Phone')}:`, err.message)
    }
    await row.save({ raw: true })
  }
}
