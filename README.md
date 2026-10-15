# Whatsapp-Bot

A small WhatsApp bot that runs on your own WhatsApp number and works with one Google Sheet:

1. **Daily message.** Once a day at `DAILY_TIME` it sends a message to everyone listed in `Sheet1`, with their name from the sheet and today's date filled in (`{name}` and `{date}`). The text is in `src/config.js`, or set `DAILY_MESSAGE` in `.env` to change it.
2. **Replies go into the sheet.** When someone answers with a number, the bot finds their row in `Sheet1` and writes the number under today's date column. It adds the column for today if it's missing.

It's one Node.js program built on [Baileys](https://github.com/WhiskeySockets/Baileys), an unofficial WhatsApp Web client. It runs all the time on a free Oracle Cloud VM. Setup steps are in [docs/SETUP.md](docs/SETUP.md).

## The sheet

`Sheet1` has one row per person and one column per day:

| name | phone | 13/10/2026 | 15/10/2026 |
|---|---|---|---|
| Анвар | 996709171758 | 40 | 45 |
| Болот | 996551103469 | | 30 |

- **phone**: the WhatsApp number with country code, digits only.
- **Day columns**: headers in `DD/MM/YYYY`. The bot uses the column for the day the reply was sent, and adds it at the end if it doesn't exist yet.
- **Confirmation**: after saving, the bot replies to the person, e.g. `Рахмат, Нурсултан байке! Бүгүнкү күнгө 120 бет жазылды.` Change or turn it off with `CONFIRM_MESSAGE` in `.env`.
- **What gets saved**: a reply with exactly one number, like `20`, `сделал 25` or `12,5`. A later reply on the same day replaces the earlier one. Messages without a number (or with several) are skipped, and so are messages from numbers that aren't in the sheet.

The column names, the tab name and the daily message are set in `.env` (see `.env.example`).

## Avoiding a ban

WhatsApp doesn't allow unofficial clients and can ban a number that uses one. To keep the risk low:

- Only message people who have your number saved and who talk to you anyway.
- Keep the list small. Use `{name}` so every message is different.
- Keep the random wait between messages (`MIN_DELAY_SECONDS` / `MAX_DELAY_SECONDS`) at its default or longer.

## Running locally

```bash
npm install
cp .env.example .env   # then fill it in
npm start              # scan the QR code with WhatsApp > Linked devices
npm test
```
