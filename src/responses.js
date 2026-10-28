import { extractNumber, extractText, formatDay, jidToPhone } from './messages.js'
import { dayColumn, findPerson, readCell, writeCell } from './sheets.js'

// Handle one message at a time so two replies can't both add today's column.
let queue = Promise.resolve()

export function handleIncoming(msg, phoneJid) {
  queue = queue.then(() => saveReply(msg, phoneJid)).catch((err) => console.error('Failed to save reply:', err.message))
  return queue
}

// Writes a person's reply into their row in Sheet1, under the column for
// the day the message was sent. Only replies with a single number are saved.
// If that day already has a reply, it goes to the next day without one.
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

  const day = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000) : new Date()
  let column = await dayColumn(day)
  while (String((await readCell(person.rowNumber, column)) ?? '').trim()) {
    day.setDate(day.getDate() + 1)
    column = await dayColumn(day)
  }
  await writeCell(person.rowNumber, column, value)
  console.log(`Saved ${value} for ${person.name} on ${formatDay(day)}`)
}
