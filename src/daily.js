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

// The next time DAILY_TIME (like "22:00") comes around after `now`.
// Returns null when DAILY_TIME is empty or not a valid time.
export function nextSendTime(dailyTime, now = new Date()) {
  const m = String(dailyTime).match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const next = new Date(now)
  next.setHours(Number(m[1]), Number(m[2]), 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next
}

// Sets one timer for the next DAILY_TIME. If today's time already passed and
// today's message wasn't sent yet (the bot was off), it sends it now.
export async function startDaily() {
  const next = nextSendTime(config.dailyTime)
  if (!next) {
    console.log('DAILY_TIME is not set, so no daily message will be sent')
    return
  }
  const state = await loadState()
  const sentToday = state.day === formatDay(new Date()) && state.done
  const passedToday = next.getDate() !== new Date().getDate()
  if (passedToday && !sentToday) runDaily()
  scheduleNext()
}

function scheduleNext() {
  const next = nextSendTime(config.dailyTime)
  console.log(`Next daily message: ${next.toString()}`)
  setTimeout(() => {
    runDaily()
    scheduleNext()
  }, next - new Date())
}

async function runDaily() {
  // Wait for the WhatsApp connection if it's still starting or reconnecting.
  while (!isReady()) await sleep(30000)
  try {
    await sendDailyMessage()
  } catch (err) {
    console.error('Daily message failed:', err.message)
  }
}

let running = false

async function sendDailyMessage() {
  if (running) return
  running = true
  try {
    const today = formatDay(new Date())
    const state = await loadState()
    if (state.day !== today) Object.assign(state, { day: today, sent: [], done: false })
    if (state.done) return

    await dayColumn(new Date())
    const people = await getPeople()
    for (const person of people) {
      if (state.sent.includes(person.phone)) continue
      while (!isReady()) await sleep(30000)
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
    state.done = true
    await saveState(state)
    console.log(`Daily message done for ${today}`)
  } finally {
    running = false
  }
}
