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

const logger = pino({ level: config.logLevel })

let sock = null
let ready = false

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
    }
    if (connection === 'open') {
      ready = true
      console.log('WhatsApp connected')
    }
    if (connection === 'close') {
      ready = false
      const code = lastDisconnect?.error?.output?.statusCode
      if (code === DisconnectReason.loggedOut) {
        console.error('WhatsApp logged this device out. Clearing the saved login so a new QR code is shown.')
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
