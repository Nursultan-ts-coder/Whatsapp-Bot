import { extractNumber, extractText, formatDay, jidToPhone } from './messages.js'
import { dayColumn, findPerson, writeCell } from './sheets.js'

// Handle one message at a time so two replies can't both add today's column.
let queue = Promise.resolve()

export function handleIncoming(msg, phoneJid) {
  queue = queue.then(() => saveReply(msg, phoneJid)).catch((err) => console.error('Failed to save reply:', err.message))
  return queue
}

// Writes a person's reply into their row in Sheet1, under the column for
// the day the message was sent. Only replies with a single number are saved.
async function saveReply(msg, phoneJid) {
  const text = extractText(msg.message)
  if (text === null) return
  const phone = jidToPhone(phoneJid)

  const value = extractNumber(text)
  if (value === null) {
    console.log(`Skipped message from ${phone}: no single number in "${text.slice(0, 50)}"`)
    return
  }

  const person = await findPerson(phone)
  if (!person) {
    console.log(`Skipped message from ${phone}: not in the sheet`)
    return
  }

  const sentAt = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000) : new Date()
  const column = await dayColumn(sentAt)
  await writeCell(person.rowNumber, column, value)
  console.log(`Saved ${value} for ${person.name} on ${formatDay(sentAt)}`)
}
