// Свои эндпоинты (OpenRouter, LiteLLM, любой Anthropic-совместимый адрес): список, модели, окружение для claude
import { tr } from './locale.mjs'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

export const PREFIX = 'ep:'
const ID_RE = /^[a-z][a-z0-9_-]{0,23}$/

// Идентификатор модели бота: ep:<эндпоинт>:<модель как у провайдера>
export const isEp = (m) => typeof m === 'string' && m.startsWith(PREFIX)
export const epModelId = (pid, id) => `${PREFIX}${pid}:${id}`
export function parseEp(m) {
  if (!isEp(m)) return null
  const rest = m.slice(PREFIX.length)
  const i = rest.indexOf(':')
  return i < 1 ? null : { pid: rest.slice(0, i), id: rest.slice(i + 1) }
}

export const normalizeBase = (u) => {
  let s = String(u ?? '').trim().replace(/\/+$/, '')
  if (s && !/^https?:\/\//i.test(s)) s = 'https://' + s
  // claude сам добавляет /v1/messages, поэтому /v1 на конце лишний
  return s.replace(/\/v1$/i, '')
}

export function createStore(file) {
  let list = []
  try { if (existsSync(file)) list = JSON.parse(readFileSync(file, 'utf8')).providers ?? [] } catch (e) { console.error('providers.json:', e.message) }
  const save = () => { writeFileSync(file + '.tmp', JSON.stringify({ providers: list }, null, 1)); renameSync(file + '.tmp', file) }
  return {
    list: () => list,
    get: (id) => list.find((p) => p.id === id),
    // клиенту ключ не отдаём, только последние символы
    view: () => list.map((p) => ({ id: p.id, name: p.name, baseUrl: p.baseUrl, auth: p.auth, liteDefault: !!p.liteDefault, keyTail: p.apiKey ? p.apiKey.slice(-4) : '', hasKey: !!p.apiKey, fetchedAt: p.fetchedAt ?? 0, error: p.error ?? '', models: p.models })),
    upsert(a) {
      const base = normalizeBase(a.baseUrl)
      if (!base) throw new Error(tr('Нужен адрес эндпоинта'))
      try { new URL(base) } catch { throw new Error(tr('Адрес выглядит неверно')) }
      const name = String(a.name ?? '').trim() || new URL(base).hostname
      let p = a.id ? list.find((x) => x.id === a.id) : null
      if (!p) {
        let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20)
        if (!ID_RE.test(id)) id = 'ep'
        const taken = new Set(list.map((x) => x.id))
        let n = id, i = 2
        while (taken.has(n)) n = `${id}-${i++}`
        p = { id: n, models: [] }
        list.push(p)
      }
      p.name = name
      p.baseUrl = base
      p.auth = a.auth === 'x-api-key' ? 'x-api-key' : 'bearer'
      p.liteDefault = !!a.liteDefault
      if (typeof a.apiKey === 'string' && a.apiKey.trim()) p.apiKey = a.apiKey.trim() // пустое поле при правке = оставить прежний
      save()
      return p
    },
    remove(id) { list = list.filter((p) => p.id !== id); save() },
    save,
  }
}

function headers(p) {
  const h = { 'anthropic-version': '2023-06-01', accept: 'application/json' }
  if (p.apiKey) { h.authorization = 'Bearer ' + p.apiKey; h['x-api-key'] = p.apiKey }
  return h
}

// Список моделей у провайдера. Новые попадают в список сами, помеченные флагом упрощённого режима по умолчанию.
export async function fetchModels(p) {
  const base = p.baseUrl
  const urls = [base + '/v1/models', base + '/models']
  let lastErr = 'нет ответа'
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: headers(p), signal: AbortSignal.timeout(20_000) })
      if (!r.ok) { lastErr = `HTTP ${r.status} на ${new URL(url).pathname}`; continue }
      const j = await r.json()
      const arr = Array.isArray(j) ? j : j.data ?? j.models ?? []
      const out = arr.map((m) => (typeof m === 'string' ? { id: m } : { id: m.id ?? m.name, name: m.display_name ?? m.name })).filter((m) => m.id)
      if (!out.length) { lastErr = 'пустой список'; continue }
      const prev = new Map((p.models ?? []).map((m) => [m.id, m]))
      const seen = new Set()
      const models = out.filter((m) => !seen.has(m.id) && seen.add(m.id)).map((m) => ({
        id: m.id, name: m.name && m.name !== m.id ? m.name : m.id, lite: prev.has(m.id) ? !!prev.get(m.id).lite : !!p.liteDefault,
      }))
      // вручную добавленные модели, которых нет в ответе, не теряем
      for (const m of p.models ?? []) if (m.manual && !seen.has(m.id)) models.push(m)
      p.models = models
      p.fetchedAt = Date.now()
      p.error = ''
      return { ok: true, count: models.length }
    } catch (e) { lastErr = e.name === 'TimeoutError' ? 'таймаут запроса' : e.message }
  }
  p.error = tr('Список моделей не получен: {e}. Модели можно добавить вручную по ID.', { e: lastErr })
  return { ok: false, error: p.error }
}

// Переменные окружения для запуска claude через этот эндпоинт
export function envFor(p, modelId) {
  const env = {
    ANTHROPIC_BASE_URL: p.baseUrl,
    ANTHROPIC_MODEL: modelId,
    ANTHROPIC_DEFAULT_OPUS_MODEL: modelId,
    ANTHROPIC_DEFAULT_SONNET_MODEL: modelId,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: modelId, // фоновые вызовы claude тоже идут в выбранную модель
    ANTHROPIC_SMALL_FAST_MODEL: modelId,
    CLAUDE_CODE_SUBAGENT_MODEL: modelId,
    CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1', // шлюзы не знают бета-заголовков Anthropic
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    DISABLE_TELEMETRY: '1',
    DISABLE_AUTOUPDATER: '1',
  }
  if (p.auth === 'x-api-key') { env.ANTHROPIC_API_KEY = p.apiKey || 'none'; env.ANTHROPIC_AUTH_TOKEN = '' }
  else { env.ANTHROPIC_AUTH_TOKEN = p.apiKey || 'none'; env.ANTHROPIC_API_KEY = '' }
  return env
}
