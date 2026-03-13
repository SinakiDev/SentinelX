# SentinelX

A lightweight Windows desktop overlay for monitoring X (Twitter) accounts in real time. Built for tracking fast-moving news — geopolitical events, conflict coverage, breaking situations — without leaving your workflow.

---

## Features

- **Live feed** — polls your monitored accounts on a configurable interval (1m – 60m), newest tweets at the top
- **Infinite auto-scroll** — seamless looping ticker-tape; gracefully falls back to native scroll when content is too short to loop
- **Pause on hover** — hover the feed to freeze it and read; move away to resume
- **Always-on-top** — pin the overlay above all other windows, survives display changes
- **Transparent overlay** — adjustable opacity 10%–100% (cube-root scaled so the slider feels linear)
- **Keyword alerts** — tweets matching your keywords highlight amber; up to 30 keywords, 50 chars each
- **Max tweet age** — show only the last 30m / 45m / 1h / 2h / 4h, or all
- **Auto-scroll toggle** — switch between animated ticker and plain native scroll
- **Tweet cache** — last 300 tweets are persisted to disk and restored on next launch; new tweets deduplicated automatically
- **Adaptive polling** — after several consecutive empty polls the interval automatically backs off (up to 5×, capped at 30 min) to save API credits; resets as soon as new tweets appear
- **Secure key storage** — API key is encrypted with Windows DPAPI via Electron `safeStorage`; never stored in plaintext, never leaves the machine

---

## Download

Go to [Releases](https://github.com/SinakiDev/SentinelX/releases) and download the latest `.zip`.

> **Windows SmartScreen warning:** The app is not code-signed, so Windows may show "Windows protected your PC". Click **More info → Run anyway**. This is normal for unsigned open-source software.

---

## Getting Started

1. Extract the zip and run `SentinelX.exe`
2. Get a free API key from [twitterapi.io/dashboard](https://twitterapi.io/dashboard)
3. Open **Settings** (⚙) → paste your key in the **twitterapi.io Key** field → click **Save Key**
4. Add the X handles you want to monitor (e.g. `osint613`, `sentdefender`)
5. Close Settings — the feed starts polling immediately

**Tips:**
- Hover the feed to pause and read; move away to resume
- Adjust scroll speed and poll interval in **Settings → Display**
- Use **Max tweet age** to filter out old content — great for 24/7 use so the feed stays current
- The app saves its window position and size between launches

---

## How It Works

### Polling
On startup, the main process loads the saved API key and account list. If both are present, it starts a polling loop that runs a Twitter search query of the form:

```
(from:account1 OR from:account2 ...) since:<last_check> until:<now>
```

Results are fetched from [twitterapi.io](https://twitterapi.io) (paginated, up to 10 pages per poll). New tweets are inserted into the in-memory cache + persisted to disk via `electron-store`, then pushed to the renderer via IPC (`feed:item`). The last poll timestamp is saved so the next poll only fetches what's new.

**Adaptive back-off:** After 3–4 consecutive polls with zero new tweets, the interval multiplies by 5× (capped at 30 min). As soon as a poll returns new tweets, it resets to your configured interval.

### Feed rendering
The renderer receives tweets over IPC, deduplicates them, and holds the last 300 in memory. The visible list is filtered by max age and sorted newest-first, recalculated every 30 seconds and on every new tweet.

Auto-scroll uses a `requestAnimationFrame` loop with a `translateY` transform. It requires a single copy of the list to be taller than the container to enable seamless looping — if content is too short (e.g. a small max-age window with few recent tweets), it automatically falls back to native scrolling so you can still interact with the feed normally.

### Storage
| Data | Location | Encryption |
|---|---|---|
| Settings (accounts, keywords, speed, etc.) | `electron-store` (JSON) | None — not sensitive |
| Tweet cache (last 300) | `electron-store` (`tweet-cache.json`) | None |
| API key | `electron-store` (`apiKeyBlob`) | Windows DPAPI via `safeStorage` |

---

## Build from Source

Requires [Node.js](https://nodejs.org) 18+

```bash
git clone https://github.com/SinakiDev/SentinelX.git
cd SentinelX
npm install
npm run dev        # run in development mode
npm run dist       # build Windows installer/zip -> dist/
```

---

## Tech Stack

| | |
|---|---|
| Shell | Electron |
| UI | React 18 + Tailwind CSS |
| Build | electron-vite + electron-builder |
| X data | twitterapi.io REST API |
| Storage | electron-store |
| Key encryption | Electron `safeStorage` (Windows DPAPI) |

---

## Privacy & Security

- Your API key is encrypted with **Windows DPAPI** via Electron's `safeStorage` — only your Windows user account can decrypt it
- The key is passed directly to twitterapi.io; no third-party servers are involved
- No analytics, no telemetry, no external connections beyond twitterapi.io and X's CDN (for linked content)
- The renderer runs in a sandboxed context (`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`) with a strict IPC bridge — the UI cannot access Node.js or the filesystem directly

---

## License

See [LICENSE](LICENSE)
