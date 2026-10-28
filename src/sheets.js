import { readFile } from 'node:fs/promises'
import { JWT } from 'google-auth-library'
import { GoogleSpreadsheet } from 'google-spreadsheet'
import { config } from './config.js'
import { formatDay, parseSendAt, phonesMatch, sameDay } from './messages.js'

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
  if (!doc.sheetsByTitle[config.peopleTab]) {
    throw new Error(`No tab named "${config.peopleTab}" (set PEOPLE_TAB in .env)`)
  }
  console.log(`Connected to Google Sheet "${doc.title}"`)
}

const peopleSheet = () => doc.sheetsByTitle[config.peopleTab]

// Finds the header that matches a column name, ignoring case and spaces.
function headerFor(sheet, name) {
  const header = sheet.headerValues.find((h) => h.trim().toLowerCase() === name.toLowerCase())
  if (!header) throw new Error(`No "${name}" column in "${sheet.title}"`)
  return header
}

// Everyone in Sheet1 with a phone number: [{ name, phone, rowNumber }].
export async function getPeople() {
  const sheet = peopleSheet()
  const rows = await sheet.getRows()
  const nameHeader = headerFor(sheet, config.nameColumn)
  const phoneHeader = headerFor(sheet, config.phoneColumn)
  return rows
    .map((row) => ({ name: row.get(nameHeader) ?? '', phone: String(row.get(phoneHeader) ?? ''), rowNumber: row.rowNumber }))
    .filter((p) => p.phone.trim())
}

export async function findPerson(phone) {
  return (await getPeople()).find((p) => phonesMatch(p.phone, phone)) ?? null
}

// Returns the 0-based index of the column whose header is the given day,
// adding a new column at the end when there isn't one yet.
export async function dayColumn(date) {
  const sheet = peopleSheet()
  await sheet.loadHeaderRow()
  const headers = sheet.headerValues
  const found = headers.findIndex((h) => sameDay(parseSendAt(h, 'DMY'), date))
  if (found !== -1) return found

  let index = headers.length
  while (index > 0 && !String(headers[index - 1] ?? '').trim()) index--
  if (index >= sheet.columnCount) {
    await sheet.resize({ rowCount: sheet.rowCount, columnCount: index + 1 })
  }
  await sheet.loadCells({ startRowIndex: 0, endRowIndex: 1, startColumnIndex: index, endColumnIndex: index + 1 })
  sheet.getCell(0, index).value = formatDay(date)
  await sheet.saveUpdatedCells()
  console.log(`Added column ${formatDay(date)}`)
  return index
}

async function loadCell(rowNumber, columnIndex) {
  const sheet = peopleSheet()
  const rowIndex = rowNumber - 1
  await sheet.loadCells({ startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: columnIndex, endColumnIndex: columnIndex + 1 })
  return sheet.getCell(rowIndex, columnIndex)
}

export async function readCell(rowNumber, columnIndex) {
  return (await loadCell(rowNumber, columnIndex)).value
}

export async function writeCell(rowNumber, columnIndex, value) {
  const cell = await loadCell(rowNumber, columnIndex)
  cell.value = value
  await peopleSheet().saveUpdatedCells()
}
