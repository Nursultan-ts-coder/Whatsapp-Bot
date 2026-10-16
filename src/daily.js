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
  console.log(`DAILY_TIME is ${config.dailyTime}, time on this server now: ${new Date().toString()}`)
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

const RETRY_MINUTES = 5
const SEND_TIMEOUT_MS = 60000

// Gives up on a WhatsApp call that hangs (for example on a dead connection),
// so one stuck send can't block the rest of the list.
function withTimeout(promise, what) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out`)), SEND_TIMEOUT_MS)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// Sends today's message. If anything fails (Google Sheets error, lost
// connection, a send that didn't go through), it tries again every few
// minutes until everyone got it, but never past midnight.
async function runDaily(day = formatDay(new Date())) {
  // Wait for the WhatsApp connection if it's still starting or reconnecting.
  while (!isReady()) await sleep(30000)
  try {
    await sendDailyMessage()
  } catch (err) {
    console.error('Daily message failed:', err.message)
  }
  const state = await loadState()
  if (state.day === day && state.done) return
  if (formatDay(new Date()) !== day) {
    console.error(`Daily message for ${day} was not finished before midnight`)
    return
  }
  console.log(`Daily message not finished, trying again in ${RETRY_MINUTES} minutes`)
  setTimeout(() => runDaily(day), RETRY_MINUTES * 60000)
}

let running = false

async function sendDailyMessage() {
  if (running) return
  running = true
  try {
    const today = formatDay(new Date())
    const state = await loadState()
    // A new day, or DAILY_TIME was changed in .env since the last send: start
    // a fresh round, so a new time later today sends again.
    if (state.day !== today || state.time !== config.dailyTime) {
      Object.assign(state, { day: today, time: config.dailyTime, sent: [], done: false })
    }
    if (state.done) return

    await dayColumn(new Date())
    const people = await getPeople()
    let failed = 0
    for (const person of people) {
      if (state.sent.includes(person.phone)) continue
      while (!isReady()) await sleep(30000)
      const jid = phoneToJid(person.phone)
      if (!jid) {
        console.error(`Daily message to ${person.name} skipped: phone "${person.phone}" is not a valid number`)
        state.sent.push(person.phone)
        continue
      }
      try {
        const sock = getSocket()
        const [result] = await withTimeout(sock.onWhatsApp(jid), 'WhatsApp number check')
        if (!result?.exists) {
          // Retrying won't help, so don't try this person again today.
          console.error(`Daily message to ${person.name} skipped: ${person.phone} is not on WhatsApp`)
          state.sent.push(person.phone)
        } else {
          const text = fillTemplate(config.dailyMessage, { ...person, date: today })
          await withTimeout(sock.sendMessage(result.jid, { text }), 'Sending')
          console.log(`Daily message sent to ${person.name}`)
          state.sent.push(person.phone)
        }
      } catch (err) {
        // Not marked as sent, so the retry picks this person up again.
        failed++
        console.error(`Daily message to ${person.name} failed:`, err.message)
      }
      await saveState(state)
      await sleep(randomDelay())
    }
    if (failed) {
      console.error(`Daily message for ${today}: ${failed} send(s) failed`)
      return
    }
    state.done = true
    await saveState(state)
    console.log(`Daily message done for ${today}`)
  } finally {
    running = false
  }
}
