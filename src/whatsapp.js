import { rm } from 'node:fs/promises'
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidGroup,
  isLidUser,
  useMultiFileAuthState,
} from 'baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import { config } from './config.js'
import { notify } from './notify.js'

const logger = pino({ level: config.logLevel })

let sock = null
let ready = false
let qrAlerted = false
let offlineTimer = null
let offlineAlerted = false
const OFFLINE_ALERT_MINUTES = 10

export const isReady = () => ready
export const getSocket = () => sock

// Opens the WhatsApp connection and reconnects on its own when it drops.
// onMessage is called with each new incoming message.
export async function connect(onMessage) {
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir)
  let version
  try {
    ;({ version } = await fetchLatestBaileysVersion())
  } catch {
    // Fall back to the version bundled with Baileys.
  }

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.ubuntu('Chrome'),
    // Keep the phone getting notifications as usual.
    markOnlineOnConnect: false,
    syncFullHistory: false,
  })

  sock.ev.on('creds.update', saveCreds)

  if (config.pairPhone && !state.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(config.pairPhone)
        console.log(`\nPairing code: ${code}\nOn your phone: WhatsApp > Linked devices > Link a device > Link with phone number instead\n`)
      } catch (err) {
        console.error('Could not get a pairing code:', err.message)
      }
    }, 3000)
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr && !config.pairPhone) {
      console.log('\nScan this QR code: WhatsApp > Linked devices > Link a device\n')
      qrcode.generate(qr, { small: true })
      if (!qrAlerted) {
        qrAlerted = true
        notify('WhatsApp is not linked. Run the bot in a terminal and scan the QR code (Linked devices > Link a device).')
      }
    }
    if (connection === 'open') {
      ready = true
      qrAlerted = false
      console.log('WhatsApp connected')
      clearTimeout(offlineTimer)
      offlineTimer = null
      if (offlineAlerted) {
        offlineAlerted = false
        notify('WhatsApp is connected again.')
      }
    }
    if (connection === 'close') {
      ready = false
      const code = lastDisconnect?.error?.output?.statusCode
      // Short drops are normal and fix themselves. Only alert when the bot
      // stays offline.
      if (!offlineTimer) {
        offlineTimer = setTimeout(() => {
          offlineAlerted = true
          notify(`WhatsApp has been disconnected for ${OFFLINE_ALERT_MINUTES} minutes (last code ${code}).`)
        }, OFFLINE_ALERT_MINUTES * 60000)
      }
      if (code === DisconnectReason.connectionReplaced) {
        // Another copy of the bot logged in with the same session. Reconnecting
        // would just kick that copy off and start a fight, so stop here.
        console.error('Another copy of this bot is running with the same WhatsApp login. Stop the other copy, then restart this one.')
        await notify('Stopped: another copy of this bot is using the same WhatsApp login.')
        process.exit(1)
      }
      if (code === DisconnectReason.loggedOut) {
        console.error('WhatsApp logged this device out. Clearing the saved login so a new QR code is shown.')
        qrAlerted = true
        notify('WhatsApp logged the bot out. Link it again: stop the service, run npm start and scan the QR code.')
        await rm(config.authDir, { recursive: true, force: true })
      } else {
        console.log(`WhatsApp connection closed (code ${code}), reconnecting...`)
      }
      setTimeout(() => connect(onMessage), 3000)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      const jid = msg.key.remoteJid
      if (msg.key.fromMe || !jid || jid === 'status@broadcast' || jid.endsWith('@newsletter')) continue
      if (isJidGroup(jid)) continue
      try {
        await onMessage(msg, await senderPhoneJid(msg))
      } catch (err) {
        console.error('Failed to handle incoming message:', err.message)
      }
    }
  })
}

// WhatsApp now hides some senders behind a "LID" id instead of their number.
// Use the phone-number id when WhatsApp gives it to us.
async function senderPhoneJid(msg) {
  const { remoteJid, remoteJidAlt, participant, participantAlt } = msg.key
  const jid = isJidGroup(remoteJid) ? participant : remoteJid
  const alt = isJidGroup(remoteJid) ? participantAlt : remoteJidAlt
  if (!isLidUser(jid)) return jid
  if (alt) return alt
  try {
    return (await sock.signalRepository.lidMapping.getPNForLID(jid)) || jid
  } catch {
    return jid
  }
}
