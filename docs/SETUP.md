# Setup

There are four parts: the Google Sheet, an Oracle Cloud VM, installing the bot, and linking WhatsApp. Everything here is free.

## 1. Google Sheet and service account

The bot reads and writes your sheet as a Google "service account", which is a robot Google user that only sees sheets you share with it.

1. Go to <https://console.cloud.google.com/>, create a project (any name).
2. Open **APIs & Services > Library**, search for **Google Sheets API**, and click **Enable**.
3. Open **APIs & Services > Credentials > Create credentials > Service account**. Give it a name and click **Done** (skip the optional steps).
4. Click the new service account, open the **Keys** tab, then **Add key > Create new key > JSON**. A `.json` file downloads. Rename it `google-credentials.json` and keep it private.
5. Create a Google Sheet. Click **Share** and add the service account's email (it looks like `name@project.iam.gserviceaccount.com`) as an **Editor**.
6. Copy the sheet id from its URL: `docs.google.com/spreadsheets/d/`**`<this part>`**`/edit`.

The bot works with the tab named `Sheet1`: a `name` column, a `phone` column (digits with country code), then one column per day. See the README for details.

## 2. Oracle Cloud Always Free VM

1. Sign up at <https://www.oracle.com/cloud/free/>. It asks for a card to check you're a real person, but Always Free resources are never charged. Pick a home region close to you; you can't change it later.
2. Go to **Compute > Instances > Create instance**.
   - **Image**: Canonical Ubuntu 24.04.
   - **Shape**: `VM.Standard.E2.1.Micro` (Always Free, 1 GB RAM) is always available and is enough for this bot. `VM.Standard.A1.Flex` (Ampere) is also free and bigger, but it's often "out of capacity".
   - **SSH keys**: choose *Generate a key pair for me* and download the private key, or paste your own public key.
3. Click **Create**, wait until it shows *Running*, and copy its **Public IP address**.
4. Connect from your computer (macOS, Linux, or Windows PowerShell):

   ```bash
   ssh -i path/to/private.key ubuntu@<public-ip>
   ```

**About idle VMs:** Oracle may reclaim Always Free VMs that stay almost completely idle for a week. If that happens, or to avoid it, you can upgrade the account to *Pay As You Go* in Billing. Always Free resources still cost nothing after the upgrade, but set a budget alert to be safe.

## 3. Install the bot on the VM

Run these on the VM:

```bash
# Node.js 22 and git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Extra memory headroom for the 1 GB VM
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# The bot
git clone https://github.com/Nursultan-ts-coder/Whatsapp-Bot.git
cd Whatsapp-Bot
npm install --omit=dev
cp .env.example .env
nano .env    # set GOOGLE_SHEET_ID and TZ, then Ctrl+O, Enter, Ctrl+X
```

If the GitHub repo is private, `git clone` asks for a username and password. Use a GitHub personal access token as the password.

Copy your Google key to the VM. Run this **on your own computer**, not on the VM:

```bash
scp -i path/to/private.key google-credentials.json ubuntu@<public-ip>:~/Whatsapp-Bot/
```

## 4. Link WhatsApp and run it in the background

The first start has to be in your SSH window so you can scan the QR code:

```bash
cd ~/Whatsapp-Bot
npm start
```

On your phone, open **WhatsApp > Settings > Linked devices > Link a device** and scan the QR code. If the QR code is hard to scan in the terminal, set `PAIR_PHONE=996555123456` (your number) in `.env` and start again. The bot then prints an 8-letter code, which you enter under **Link a device > Link with phone number instead**.

When you see `WhatsApp connected`, press `Ctrl+C`. The login is saved in the `auth/` folder, so you won't scan again.

Now make it run all the time, also after the VM reboots:

```bash
sudo cp deploy/whatsapp-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now whatsapp-bot
```

Useful commands:

```bash
sudo systemctl status whatsapp-bot     # is it running?
journalctl -u whatsapp-bot -f          # live log (Ctrl+C to leave)
sudo systemctl restart whatsapp-bot    # restart after editing .env
```

## Updating the bot

```bash
cd ~/Whatsapp-Bot
git pull
npm install --omit=dev
sudo systemctl restart whatsapp-bot
```

## If WhatsApp logs the bot out

If you remove the linked device on your phone, the bot clears its saved login and prints a new QR code in the log. Stop the service, run `npm start` in your SSH window, scan again, then start the service:

```bash
sudo systemctl stop whatsapp-bot
npm start                 # scan, wait for "WhatsApp connected", Ctrl+C
sudo systemctl start whatsapp-bot
```
