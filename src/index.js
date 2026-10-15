import { config } from './config.js'
import { sendDailyMessage } from './daily.js'
import { handleIncoming } from './responses.js'
import { startScheduler } from './scheduler.js'
import { openSheet } from './sheets.js'
import { connect } from './whatsapp.js'

try {
  await openSheet()
} catch (err) {
  console.error(`Could not open the Google Sheet: ${err.message}`)
  console.error('Check GOOGLE_SHEET_ID, the credentials file, and that the sheet is shared with the service account email (see docs/SETUP.md).')
  process.exit(1)
}

await connect(handleIncoming)

startScheduler(sendDailyMessage)
if (config.dailyMessage && config.dailyTime) console.log(`Daily message goes out at ${config.dailyTime}`)
