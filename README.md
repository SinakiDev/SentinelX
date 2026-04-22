# SentinelX

A lightweight Windows desktop overlay for monitoring X (Twitter) accounts in real time. Built for tracking fast-moving news - geopolitical events, conflict coverage, breaking situations - without leaving your workflow.

---
https://github.com/user-attachments/assets/44c1b8ff-01ce-433b-8b01-f7e6a44b87e6



## Features

- **Live feed** - polls monitored accounts on a configurable interval (1m - 10m), newest tweets first
- **Card-based UI** - modern dark theme with colored type badges (POST, REPLY, RT) and per-tweet View links
- **Always-on-top overlay** - pin above all windows with adjustable transparency (10% - 100%)
- **Infinite auto-scroll** - seamless looping ticker-tape; falls back to native scroll when content is short, can be toggled off
- **Pause on hover** - hover the feed to freeze it and read; move away to resume
- **Keyword alerts** - matching tweets highlight amber with keyword callout
- **Max tweet age** - show only the last 30m / 45m / 1h / 2h / 4h, or all
- **Adaptive polling** - backs off up to 5x after consecutive empty polls to save API credits; resets on new tweets
- **Tweet cache** - last 300 tweets persisted to disk, restored on launch, deduplicated automatically
- **Secure key storage** - API key encrypted with Windows DPAPI via Electron `safeStorage`, never stored in plaintext

---

## Download

Go to [Releases](https://github.com/SinakiDev/SentinelX/releases) and download the latest `.zip`.

> **SmartScreen warning:** The app is unsigned so Windows may warn you. Click **More info - Run anyway**.

---

## Getting Started

1. Extract the zip and run `SentinelX.exe`
2. Get a free API key from [twitterapi.io/dashboard](https://twitterapi.io/dashboard) (The free api gives 10.000 credits which is plenty depending how long and how many accounts you monitor)
3. Open Settings - paste your key - click **Save Key**
4. Add X handles to monitor (e.g. `osint613`, `sentdefender`)
5. Close Settings - polling starts immediately

**Tips:**
- Hover the feed to pause and read; move away to resume
- Adjust scroll speed and poll interval in **Settings - Display**
- Use **Max tweet age** to filter out old content - great for 24/7 use so the feed stays current

---

## How Polling Works

SentinelX uses `since_id` tracking to minimize API credit usage. After each poll, the ID of the newest tweet is saved. The next poll includes `since_id:<last_tweet_id>` so the API only returns tweets newer than what you already have - no duplicates, no wasted credits scanning old results.

On the very first poll (or if no previous tweet ID exists), it falls back to a time-based `since:` query covering the last hour with a 2-minute overlap window to handle API indexing delays.

Pagination is capped at 10 pages per poll as a credit safety net. Adaptive back-off kicks in after 3-4 consecutive empty polls, multiplying the interval by 5x (capped at 30 min). Resets instantly when new tweets arrive.

---

## Build from Source

```bash
git clone https://github.com/SinakiDev/SentinelX.git
cd SentinelX
npm install
npm run dev        # development mode
npm run dist       # build Windows installer/zip
```

Requires Node.js 18+

---

## Tech Stack

| | |
|---|---|
| Shell | Electron 30 |
| UI | React 18 + Tailwind CSS |
| Build | electron-vite + electron-builder |
| X data | twitterapi.io REST API |
| Storage | electron-store |
| Key encryption | Electron `safeStorage` (Windows DPAPI) |

---

## License

See [LICENSE](LICENSE)
