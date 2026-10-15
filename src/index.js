import { config } from './config.js'
import { extractText, formatDate, jidToPhone } from './messages.js'
import { startScheduler } from './scheduler.js'
import { appendInbox, openSheet } from './sheets.js'
import { connect } from './whatsapp.js'

try {
  await openSheet()
} catch (err) {
  console.error(`Could not open the Google Sheet: ${err.message}`)
  console.error('Check GOOGLE_SHEET_ID, the credentials file, and that the sheet is shared with the service account email (see docs/SETUP.md).')
  process.exit(1)
}

await connect(async (msg, phoneJid) => {
  const text = extractText(msg.message)
  if (text === null) return
  const received = msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000) : new Date()
  await appendInbox({
    Received: formatDate(received),
    Phone: jidToPhone(phoneJid),
    Name: msg.pushName ?? '',
    Message: text,
  })
  console.log(`Logged message from ${jidToPhone(phoneJid)}`)
})

startScheduler()
console.log(`Checking the "${config.scheduleTab}" tab every ${config.checkEverySeconds}s`)
