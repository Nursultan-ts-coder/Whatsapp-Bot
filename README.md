# Whatsapp-Bot

A small WhatsApp bot that runs on your own WhatsApp number and uses one Google Sheet:

1. **Scheduled messages.** Add rows to the `Schedule` tab and the bot sends each message when its time comes.
2. **Incoming messages.** Every message people send you is added to the `Inbox` tab.

It's one Node.js program built on [Baileys](https://github.com/WhiskeySockets/Baileys), an unofficial WhatsApp Web client. It's meant to run all the time on a free Oracle Cloud VM. Setup steps are in [docs/SETUP.md](docs/SETUP.md).

## The sheet

**Schedule** tab (you fill this in):

| Phone | Name | Message | SendAt | Repeat | Status |
|---|---|---|---|---|---|
| +996555123456 | Aibek | Hi {name}, football at 7 tonight? | 2026-10-20 09:00 | | |
| +996700987654 | Aliya | Good morning {name}! | 2026-10-16 08:00 | daily | |

- **Phone**: number with country code. Format the column as *Plain text* so Sheets doesn't change it.
- **Message**: `{name}` (or any other column name in braces) is replaced with that row's value.
- **SendAt**: when to send, in the time zone set in `.env`. `2026-10-20 09:00` is the safest format; `20.10.2026 9:00` also works.
- **Repeat**: leave empty for one message, or write `daily`, `weekly` or `monthly`.
- **Status**: the bot writes `Sent ...`, `Last sent ...` (for repeats) or `Error: ...`. Clear it to send the row again. Write `skip` to pause a row.

**Inbox** tab (the bot fills this in): `Received | Phone | Name | Message`. Photos and voice notes without a caption show as `[image]`, `[audio]` and so on.

## Avoiding a ban

WhatsApp doesn't allow unofficial clients and can ban a number that uses one. To keep the risk low:

- Only message people who have your number saved and who talk to you anyway.
- Keep the list small. Use `{name}` so every message is different.
- Keep the random wait between messages (`MIN_DELAY_SECONDS` / `MAX_DELAY_SECONDS`) at its default or longer.
- If you can, use a spare number rather than your main one.

## Running locally

```bash
npm install
cp .env.example .env   # then fill it in
npm start              # scan the QR code with WhatsApp > Linked devices
npm test
```
