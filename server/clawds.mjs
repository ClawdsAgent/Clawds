// CLI для агентов: управление своим аккаунтом и сообщениями. Запускается ботом через Bash.
const { CLAWDS_API, CLAWDS_TOKEN } = process.env
const [action = 'help', ...args] = process.argv.slice(2)
if (!CLAWDS_API || !CLAWDS_TOKEN) {
  console.error('Эта команда работает только внутри запуска бота Clawds')
  process.exit(1)
}
try {
  const r = await fetch(`${CLAWDS_API}/agent`, { method: 'POST', body: JSON.stringify({ token: CLAWDS_TOKEN, action, args }) })
  const j = await r.json()
  if (!j.ok) { console.error('Ошибка: ' + j.error); process.exit(1) }
  console.log(j.out)
} catch (e) {
  console.error('Нет связи с сервером Clawds: ' + e.message)
  process.exit(1)
}
