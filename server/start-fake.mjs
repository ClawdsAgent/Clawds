// Запуск сервера с подставным claude в отдельной папке (для проверки интерфейса без входа и расхода подписки)
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
// fileURLToPath вместо pathname.slice(1): slice(1) рассчитан на Windows
// (убирает ведущий слэш у /C:/...), а на Linux/macOS давал относительный путь,
// и подставной claude не запускался (runner.mjs получал несуществующий путь).
process.env.CLAWDS_HOME = process.env.CLAWDS_HOME || fileURLToPath(new URL('../tmp-home', import.meta.url))
mkdirSync(process.env.CLAWDS_HOME, { recursive: true })
process.env.CLAUDE_BIN = process.execPath
process.env.CLAUDE_PREFIX = JSON.stringify([fileURLToPath(new URL('./fake-claude.mjs', import.meta.url))])
await import('./index.mjs')
