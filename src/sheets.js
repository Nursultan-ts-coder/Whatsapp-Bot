import { readFile } from 'node:fs/promises'
import { JWT } from 'google-auth-library'
import { GoogleSpreadsheet } from 'google-spreadsheet'
import { config } from './config.js'

export const SCHEDULE_HEADERS = ['Phone', 'Name', 'Message', 'SendAt', 'Repeat', 'Status']
export const INBOX_HEADERS = ['Received', 'Phone', 'Name', 'Message']

let doc

export async function openSheet() {
  const creds = JSON.parse(await readFile(config.credentialsFile, 'utf8'))
  const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  doc = new GoogleSpreadsheet(config.sheetId, auth)
  await doc.loadInfo()
  await ensureTab(config.scheduleTab, SCHEDULE_HEADERS)
  await ensureTab(config.inboxTab, INBOX_HEADERS)
  console.log(`Connected to Google Sheet "${doc.title}"`)
}

// Creates the tab with headers if it is missing, or adds headers to an empty tab.
async function ensureTab(title, headers) {
  const sheet = doc.sheetsByTitle[title]
  if (!sheet) {
    await doc.addSheet({ title, headerValues: headers })
    console.log(`Created tab "${title}"`)
    return
  }
  try {
    await sheet.loadHeaderRow()
  } catch {
    await sheet.setHeaderRow(headers)
  }
}

export async function getScheduleRows() {
  return doc.sheetsByTitle[config.scheduleTab].getRows()
}

export async function appendInbox(row) {
  await doc.sheetsByTitle[config.inboxTab].addRow(row, { raw: true })
}
