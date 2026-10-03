// Подставной claude для проверки конвейера без входа в аккаунт.
// Что пишет в ответе, задаётся строкой в prompt: FAKE_SAY=<текст>
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
if (process.env.FAKE_LOG) appendFileSync(process.env.FAKE_LOG, process.argv.slice(2).join(' ') + ' ENV ' + ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_MODEL', 'CLAUDE_CODE_DISABLE_CLAUDE_MDS'].map((k) => k + '=' + (process.env[k] ?? '')).join(' ') + '\n')
let prompt = ''
process.stdin.on('data', (d) => (prompt += d))
process.stdin.on('end', async () => {
  if (process.env.FAKE_LOG) appendFileSync(process.env.FAKE_LOG, 'PROMPT_LANG=' + (/LANGUAGE: write every chat message/.test(prompt) ? 'en' : /ЯЗЫК: пиши/.test(prompt) ? 'ru' : '?') + '\n')
  if (process.env.FAKE_LOG && /ПРОСЯТ ПРИМЕНИТЬ НАВЫК/.test(prompt)) appendFileSync(process.env.FAKE_LOG, 'PROMPT_SKILL=' + /ПРОСЯТ ПРИМЕНИТЬ НАВЫК \/([\w-]+)/.exec(prompt)?.[1] + '\n')
  const out = (o) => console.log(JSON.stringify(o))
  const w = (ms) => new Promise((r) => setTimeout(r, ms))
  const found = [...prompt.matchAll(/FAKE_SAY=(.*)/g)]
  let say = found.length ? found[found.length - 1][1].replaceAll('§', '@') : undefined
  // FAKE_SCRIPT=файл.json: {"бот": ["ответ 1", "ответ 2"]}. Ответы по порядку для каждого бота (для демонстраций без меток в чате)
  if (process.env.FAKE_SCRIPT) {
    const who = /Ты: ([\w-]+),/.exec(prompt)?.[1]
    const sc = JSON.parse(readFileSync(process.env.FAKE_SCRIPT, 'utf8'))
    const cf = process.env.FAKE_SCRIPT + '.' + who
    const n = existsSync(cf) ? Number(readFileSync(cf, 'utf8')) : 0
    writeFileSync(cf, String(n + 1))
    say = sc[who]?.[n] ?? '[молчу]'
  }
  out({ type: 'system', subtype: 'init', session_id: 'fake-session' })
  // FAKE_QUOTA=пятичасовое,недельное (доли 0..1) имитирует событие квоты; FAKE_MS растягивает работу
  if (process.env.FAKE_QUOTA) {
    const [a, b] = process.env.FAKE_QUOTA.split(',').map(Number)
    out({ type: 'rate_limit_event', rate_limit_info: { unifiedWindows: { five_hour: { utilization: a, resetsAt: Math.floor(Date.now() / 1000) + 3600 }, seven_day: { utilization: b, resetsAt: Math.floor(Date.now() / 1000) + 86400 } } } })
  }
  await w(300)
  out({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'echo привет' } }] } })
  await w(Number(process.env.FAKE_MS) || 300)
  out({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'привет' }] } })
  const full = say ?? 'Готово. Передаю @dev для сведения.'
  // FAKE_STREAM=1: ответ приходит кусочками, как у настоящей модели (для записи демонстраций)
  const parts = process.env.FAKE_STREAM ? full.match(/[\s\S]{1,7}/g) : [full]
  for (const part of parts) {
    out({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: part } } })
    await w(process.env.FAKE_STREAM ? 22 : 200)
  }
  out({ type: 'result', session_id: 'fake-session', is_error: false, result: 'ok', total_cost_usd: 0, num_turns: 1 })
})
