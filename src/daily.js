import { readFile, writeFile } from 'node:fs/promises'
import { config } from './config.js'
import { fillTemplate, formatDay, phoneToJid } from './messages.js'
import { dayColumn, getPeople } from './sheets.js'
import { getSocket, isReady } from './whatsapp.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const randomDelay = () =>
  1000 * (config.minDelaySeconds + Math.random() * Math.max(0, config.maxDelaySeconds - config.minDelaySeconds))

// Remembers who already got today's message, so a restart doesn't send it twice.
async function loadState() {
  try {
    return JSON.parse(await readFile(config.stateFile, 'utf8'))
  } catch {
    return {}
  }
}

const saveState = (state) => writeFile(config.stateFile, JSON.stringify(state, null, 2))

// True once today's DAILY_TIME (like "09:00") has passed.
export function isTimeToSend(dailyTime, now = new Date()) {
  const m = String(dailyTime).match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return false
  return now.getHours() * 60 + now.getMinutes() >= Number(m[1]) * 60 + Number(m[2])
}

let running = false

export async function sendDailyMessage() {
  if (running || !isReady() || !config.dailyMessage || !isTimeToSend(config.dailyTime)) return
  running = true
  try {
    const today = formatDay(new Date())
    const state = await loadState()
    if (state.day !== today) Object.assign(state, { day: today, sent: [] })
    if (state.done) return

    await dayColumn(new Date())
    const people = await getPeople()
    for (const person of people) {
      if (state.sent.includes(person.phone) || !isReady()) continue
      const jid = phoneToJid(person.phone)
      if (!jid) continue
      try {
        const sock = getSocket()
        const [result] = await sock.onWhatsApp(jid)
        if (!result?.exists) throw new Error('number is not on WhatsApp')
        await sock.sendMessage(result.jid, { text: fillTemplate(config.dailyMessage, { ...person, date: today }) })
        console.log(`Daily message sent to ${person.name}`)
      } catch (err) {
        console.error(`Daily message to ${person.name} failed:`, err.message)
      }
      state.sent.push(person.phone)
      await saveState(state)
      await sleep(randomDelay())
    }
    if (isReady()) {
      state.done = true
      await saveState(state)
    }
  } catch (err) {
    console.error('Daily message failed:', err.message)
  } finally {
    running = false
  }
}
