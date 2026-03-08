#!/usr/bin/env node
// Unsets ELECTRON_RUN_AS_NODE before launching electron-vite dev
// This is needed when the env variable is set in the parent shell
delete process.env.ELECTRON_RUN_AS_NODE

import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const eviteBin = resolve(__dirname, '../node_modules/.bin/electron-vite')

const proc = spawn(
  process.platform === 'win32' ? 'node' : eviteBin,
  process.platform === 'win32'
    ? [eviteBin + '.cmd', 'dev']
    : ['dev'],
  {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'
  }
)

proc.on('close', (code) => process.exit(code ?? 0))
