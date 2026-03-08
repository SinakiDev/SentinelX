# SentinelX

A lightweight Windows desktop overlay for monitoring X (Twitter) accounts in real time. Built for tracking fast-moving news — geopolitical events, conflict coverage, breaking situations — without leaving your workflow.

---

## Features

- **Live feed** — polls your monitored accounts every 90s, newest tweets at the top
- **Auto-scroll** — seamless continuous ticker-tape, pauses on hover so you can read
- **Always-on-top** — pin the overlay above all other windows
- **Transparent overlay** — adjustable opacity 10%–100%
- **Keyword alerts** — highlight tweets containing words like `strike`, `missile`, `breaking`
- **Max tweet age** — show only last 30m / 1h / 2h / 4h / all
- **No API key required** — cookie-based X session auth
- **Secure** — session cookies encrypted with Windows DPAPI, never stored in plaintext

---

## Download

Go to [Releases](https://github.com/SinakiDev/SentinelX/releases) and download the latest `.exe`.

> **Windows SmartScreen warning:** The app is not code-signed, so Windows may show "Windows protected your PC". Click **More info** → **Run anyway**. This is normal for unsigned open-source software.

---

## Getting Started

1. Run the installer / portable exe
2. Open **Settings** (⚙) → click **Login with X →**
3. A browser window opens — log in to your X account
4. Add the handles you want to monitor (e.g. `osint613`, `sentdefender`)
5. Close Settings — the feed starts automatically

**Tips:**
- Use a burner/alt X account to reduce risk to your main account
- Keep monitored accounts **under 10** to avoid X rate-limiting
- Hover the feed to pause and read; move away to resume
- Adjust scroll speed in Settings → Display

---

## Build from Source

Requires [Node.js](https://nodejs.org) 18+

```bash
git clone https://github.com/SinakiDev/SentinelX.git
cd SentinelX
npm install
npm run dev        # run in development mode
npm run dist       # build Windows installer → dist/
```

---

## Tech Stack

| | |
|---|---|
| Shell | Electron 30 |
| UI | React 18 + Tailwind CSS |
| Build | electron-vite + electron-builder |
| X data | @the-convocation/twitter-scraper |
| Storage | electron-store |
| Auth | OS-encrypted cookies via Electron safeStorage (Windows DPAPI) |

---

## Privacy & Security

- X session cookies are encrypted with **Windows DPAPI** via Electron's `safeStorage` — only your Windows user account can decrypt them
- No credentials are sent anywhere other than X's own servers
- No analytics, no telemetry, no external connections from the app itself

---

## License

MIT — see [LICENSE](LICENSE)
