// Подставной claude для проверки конвейера без входа в аккаунт.
// Что пишет в ответе, задаётся строкой в prompt: FAKE_SAY=<текст>
import { appendFileSync } from 'node:fs'
if (process.env.FAKE_LOG) appendFileSync(process.env.FAKE_LOG, process.argv.slice(2).join(' ') + ' ENV ' + ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_MODEL', 'CLAUDE_CODE_DISABLE_CLAUDE_MDS'].map((k) => k + '=' + (process.env[k] ?? '')).join(' ') + '\n')
let prompt = ''
process.stdin.on('data', (d) => (prompt += d))
process.stdin.on('end', async () => {
  const out = (o) => console.log(JSON.stringify(o))
  const w = (ms) => new Promise((r) => setTimeout(r, ms))
  const found = [...prompt.matchAll(/FAKE_SAY=(.*)/g)]
  const say = found.length ? found[found.length - 1][1].replaceAll('§', '@') : undefined
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
  for (const part of [say ?? 'Готово. Передаю @dev для сведения.']) {
    out({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: part } } })
    await w(200)
  }
  out({ type: 'result', session_id: 'fake-session', is_error: false, result: 'ok', total_cost_usd: 0, num_turns: 1 })
})
