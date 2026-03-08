// Clears ELECTRON_RUN_AS_NODE before launching electron-vite dev
delete process.env.ELECTRON_RUN_AS_NODE

const { spawn } = require('child_process')
const path = require('path')

const evite = path.join(__dirname, '../node_modules/.bin/electron-vite.cmd')

// On Windows, .cmd files need cmd.exe with /d /s /c
const proc = spawn('cmd.exe', ['/d', '/s', '/c', `"${evite}" dev`], {
  stdio: 'inherit',
  env: process.env,
  windowsVerbatimArguments: true
})

proc.on('close', (code) => process.exit(code != null ? code : 0))
