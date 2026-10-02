// Сборка лёгкого релиза для Windows: собранный интерфейс + сервер + крошечный Clawds.exe, одним zip (несколько МБ).
// Нужен Node.js 20+ на машине пользователя. Запуск: npm run release
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version
const name = `Clawds-${version}-windows`
const OUT = join(ROOT, 'release')
const STAGE = join(OUT, name)
const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} завершился с кодом ${r.status}`)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(STAGE, { recursive: true })

console.log('1/4 интерфейс')
if (!existsSync(join(ROOT, 'app', 'node_modules'))) run('npm', ['install'], join(ROOT, 'app'))
run('npm', ['run', 'build'], join(ROOT, 'app'))
cpSync(join(ROOT, 'app', 'dist'), join(STAGE, 'app', 'dist'), { recursive: true })

console.log('2/4 сервер')
const skip = new Set(['node_modules', 'claude-config', 'fake-claude.mjs', 'start-fake.mjs'])
cpSync(join(ROOT, 'server'), join(STAGE, 'server'), {
  recursive: true,
  filter: (src) => !skip.has(src.split(/[\\/]/).pop()) && !/\.log$/.test(src) && !/[\\/]latest$/.test(src),
})
run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], join(STAGE, 'server'))

console.log('3/4 Clawds.exe')
const csc = ['C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe', 'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe'].find(existsSync)
if (csc) run(csc, ['/nologo', '/target:exe', '/optimize+', `/out:${join(STAGE, 'Clawds.exe')}`, join(ROOT, 'scripts', 'launcher', 'Clawds.cs')], ROOT)
else console.log('csc не найден: Clawds.exe пропущен, остаётся Clawds.cmd')
writeFileSync(join(STAGE, 'Clawds.cmd'), '@echo off\r\ncd /d "%~dp0"\r\nwhere node >nul 2>nul || (echo Node.js 20+ is required: https://nodejs.org & pause & exit /b 1)\r\nstart "" http://127.0.0.1:8787\r\nnode server\\index.mjs\r\n')
cpSync(join(ROOT, 'LICENSE'), join(STAGE, 'LICENSE'))
writeFileSync(join(STAGE, 'README.txt'), [
  `Clawds ${version}`,
  '',
  'Requirements: Windows, Node.js 20+, git, Claude Code (the `claude` command) or your own Anthropic-compatible endpoint.',
  'Run Clawds.exe (or Clawds.cmd). The interface opens at http://127.0.0.1:8787.',
  'To use your Claude subscription press "Sign in to Claude" inside the app (Settings -> Connections).',
  'Your data stays next to the program: server-data, .clawds folders inside your projects, server\\claude-config.',
  '',
  'Docs and source: https://github.com/ClawdsAgent/Clawds',
  '',
].join('\r\n'))

console.log('4/4 архив')
const zip = join(OUT, `${name}.zip`)
run('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${STAGE}' -DestinationPath '${zip}' -Force`], ROOT)
const size = (statSync(zip).size / 1024 / 1024).toFixed(2)
console.log(`Готово: ${zip} (${size} МБ)`)

