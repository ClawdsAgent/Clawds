// Запуск сервера с подставным claude в отдельной папке (для проверки интерфейса без входа и расхода подписки)
import { mkdirSync } from 'node:fs'
process.env.CLAWDS_HOME = process.env.CLAWDS_HOME || new URL('../tmp-home', import.meta.url).pathname.slice(1)
mkdirSync(process.env.CLAWDS_HOME, { recursive: true })
process.env.CLAUDE_BIN = process.execPath
process.env.CLAUDE_PREFIX = JSON.stringify([new URL('./fake-claude.mjs', import.meta.url).pathname.slice(1)])
await import('./index.mjs')
