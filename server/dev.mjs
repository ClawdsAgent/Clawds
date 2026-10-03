// Супервизор для разработки: перезапускает сервер, когда меняется код, и не реагирует на логи и данные.
// Правки lib/prompts.mjs и mcp.mjs перезапуска не требуют (подгружаются на лету).
import { spawn } from 'node:child_process'
import { watchFile, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const FILES = ['core.mjs', 'index.mjs', 'lib/runner.mjs', 'lib/git.mjs', 'lib/rules.mjs', 'lib/tools.mjs', 'lib/chatimport.mjs', 'lib/providers.mjs', 'lib/locale.mjs']

let child = null
let restarting = false
let timer = null

function start() {
  restarting = false
  child = spawn(process.execPath, ['index.mjs'], { cwd: DIR, stdio: 'inherit' })
  const mine = child
  child.on('exit', (code) => {
    if (child !== mine) return
    child = null
    if (!restarting) console.log(`[dev] сервер остановился (код ${code}). Жду правки файла для перезапуска.`)
  })
}

function stop(cb) {
  if (!child) return cb()
  const mine = child
  mine.once('exit', () => cb())
  // дерево процессов целиком: вместе с сервером останавливаются его запуски claude
  spawn('taskkill', ['/F', '/T', '/PID', String(mine.pid)], { windowsHide: true })
}

function restart(why) {
  if (restarting) return
  restarting = true
  console.log(`[dev] перезапуск: изменён ${why}`)
  stop(() => start())
}

const mtimes = Object.fromEntries(FILES.map((f) => [f, statSync(join(DIR, f)).mtimeMs]))
for (const f of FILES) {
  watchFile(join(DIR, f), { interval: 700 }, (cur) => {
    if (cur.mtimeMs === mtimes[f]) return
    mtimes[f] = cur.mtimeMs
    clearTimeout(timer)
    timer = setTimeout(() => (child ? restart(f) : (console.log(`[dev] запуск после правки ${f}`), start())), 400)
  })
}

process.on('SIGINT', () => stop(() => process.exit(0)))
console.log('[dev] слежу за: ' + FILES.join(', '))
start()
