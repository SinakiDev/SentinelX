import { app } from 'electron'
import { join } from 'path'
import { appendFileSync, statSync, writeFileSync } from 'fs'

let _logPath: string | null = null
const MAX_LOG_BYTES = 500_000 // rotate at 500 KB

function getLogPath(): string {
  if (!_logPath) _logPath = join(app.getPath('userData'), 'sentinelx.log')
  return _logPath
}

function writeLine(line: string): void {
  try {
    const p = getLogPath()
    try {
      const { size } = statSync(p)
      if (size > MAX_LOG_BYTES) writeFileSync(p, line) // rotate by overwriting
      else appendFileSync(p, line)
    } catch {
      appendFileSync(p, line) // file doesn't exist yet
    }
  } catch { /* never crash on log failure */ }
}

export function log(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', ...args: unknown[]): void {
  const ts = new Date().toISOString()
  const msg = args
    .map((a) => (a instanceof Error ? `${a.message}${a.stack ? '\n' + a.stack : ''}` : String(a)))
    .join(' ')
  const line = `[${ts}] [${level}] ${msg}\n`
  process.stdout.write(line)
  writeLine(line)
}

export function getLogFilePath(): string {
  return getLogPath()
}
