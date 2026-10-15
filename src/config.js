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

// {name} comes from the sheet, {date} is today's date (DD/MM/YYYY).
const DEFAULT_DAILY_MESSAGE = [
  '*Ассаламу алейкум, {name} байке !*',
  'Бугун, {date} канча бет китеп окуганыңызды жазып коесузбу ?',
  '',
  'Чоң рахмат !',
].join('\n')

export const config = {
  sheetId: required('GOOGLE_SHEET_ID'),
  credentialsFile: process.env.GOOGLE_CREDENTIALS_FILE || './google-credentials.json',
  peopleTab: process.env.PEOPLE_TAB || 'Sheet1',
  nameColumn: process.env.NAME_COLUMN || 'name',
  phoneColumn: process.env.PHONE_COLUMN || 'phone',
  dailyTime: process.env.DAILY_TIME || '',
  dailyMessage: (process.env.DAILY_MESSAGE || DEFAULT_DAILY_MESSAGE).replace(/\\n/g, '\n'),
  scheduleTab: process.env.SCHEDULE_TAB || 'Schedule',
  authDir: process.env.AUTH_DIR || './auth',
  stateFile: process.env.STATE_FILE || './state.json',
  pairPhone: (process.env.PAIR_PHONE || '').replace(/\D/g, ''),
  checkEverySeconds: number('CHECK_EVERY_SECONDS', 60),
  minDelaySeconds: number('MIN_DELAY_SECONDS', 20),
  maxDelaySeconds: number('MAX_DELAY_SECONDS', 60),
  dateOrder: (process.env.DATE_ORDER || 'DMY').toUpperCase(),
  logLevel: process.env.LOG_LEVEL || 'warn',
}
