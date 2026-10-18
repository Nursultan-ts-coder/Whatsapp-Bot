import { basename } from 'node:path'
import { config } from './config.js'

// Sends an alert to your phone. The bot's own WhatsApp can't be used for this,
// because the alerts matter most when it's logged out or offline. So alerts go
// through outside services:
//  - ALERT_PHONE + ALERT_APIKEY: a WhatsApp message via CallMeBot (free)
//  - NOTIFY_URL: a push notification via an ntfy.sh topic
// The bot's folder name is added, so two bots are easy to tell apart.
export async function notify(text) {
  const message = `WhatsApp bot (${basename(process.cwd())}): ${text}`
  console.error(`Alert: ${message}`)
  if (config.alertPhone && config.alertApiKey) {
    const url = new URL('https://api.callmebot.com/whatsapp.php')
    url.search = new URLSearchParams({ phone: config.alertPhone, text: message, apikey: config.alertApiKey })
    await send('WhatsApp alert', () => fetch(url))
  }
  if (config.notifyUrl) {
    await send('ntfy alert', () => fetch(config.notifyUrl, { method: 'POST', body: message }))
  }
}

async function send(what, request) {
  try {
    const res = await request()
    if (!res.ok) console.error(`Could not send the ${what}: HTTP ${res.status}`)
  } catch (err) {
    console.error(`Could not send the ${what}:`, err.message)
  }
}
