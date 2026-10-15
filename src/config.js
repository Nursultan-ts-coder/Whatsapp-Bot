import 'dotenv/config'

function required(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing ${name} in .env (see .env.example)`)
    process.exit(1)
  }
  return value
}

const number = (name, fallback) => {
  const value = Number(process.env[name])
  return Number.isFinite(value) && process.env[name] !== '' && process.env[name] !== undefined ? value : fallback
}

export const config = {
  sheetId: required('GOOGLE_SHEET_ID'),
  credentialsFile: process.env.GOOGLE_CREDENTIALS_FILE || './google-credentials.json',
  scheduleTab: process.env.SCHEDULE_TAB || 'Schedule',
  inboxTab: process.env.INBOX_TAB || 'Inbox',
  authDir: process.env.AUTH_DIR || './auth',
  pairPhone: (process.env.PAIR_PHONE || '').replace(/\D/g, ''),
  checkEverySeconds: number('CHECK_EVERY_SECONDS', 60),
  minDelaySeconds: number('MIN_DELAY_SECONDS', 20),
  maxDelaySeconds: number('MAX_DELAY_SECONDS', 60),
  dateOrder: (process.env.DATE_ORDER || 'DMY').toUpperCase(),
  logGroups: process.env.LOG_GROUPS === 'true',
  logLevel: process.env.LOG_LEVEL || 'warn',
}
