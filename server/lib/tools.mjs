// Сторонние MCP-серверы и навыки (skills): хранение, импорт из других агентов, проверка, раскладка по ботам.
// Файлы: server-data/mcp.json (серверы, могут содержать ключи в env, наружу не отдаются) и server-data/skills/<имя>/SKILL.md
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, renameSync, cpSync } from 'node:fs'
import { join, basename } from 'node:path'
import { homedir } from 'node:os'
import { spawn } from 'node:child_process'
import { tr } from './locale.mjs'

const HOME = homedir()
const APPDATA = process.env.APPDATA || join(HOME, 'AppData', 'Roaming')
export const RESERVED = ['clawds']
const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32)
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) } catch { return null } }

/* ---------- MCP-серверы ---------- */

// Приводит запись из любого агента к одному виду: stdio (command) или http/sse (url)
export function normalizeServer(raw) {
  if (!raw || typeof raw !== 'object') return null
  const t = String(raw.type ?? raw.transport ?? '').toLowerCase()
  if (raw.url || raw.serverUrl || raw.httpUrl) {
    const url = String(raw.url ?? raw.serverUrl ?? raw.httpUrl)
    const type = t === 'sse' || (!t && /\/sse\/?$/i.test(url)) ? 'sse' : 'http'
    return { type, url, headers: raw.headers && typeof raw.headers === 'object' ? { ...raw.headers } : {}, env: {}, args: [] }
  }
  if (raw.command) {
    return {
      type: 'stdio', command: String(raw.command), args: Array.isArray(raw.args) ? raw.args.map(String) : [],
      env: raw.env && typeof raw.env === 'object' ? Object.fromEntries(Object.entries(raw.env).map(([k, v]) => [k, String(v)])) : {}, headers: {},
    }
  }
  return null
}

// Минимальный разбор TOML-таблиц [mcp_servers.имя] из конфига Codex CLI
function parseCodexToml(text) {
  const out = {}
  let cur = null
  const val = (v) => {
    v = v.trim()
    if (v.startsWith('[')) return [...v.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
    if (v.startsWith('{')) return Object.fromEntries([...v.matchAll(/([A-Za-z0-9_]+)\s*=\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => [m[1], m[2]]))
    const m = /^"((?:[^"\\]|\\.)*)"/.exec(v)
    return m ? m[1].replace(/\\\\/g, '\\') : v
  }
  for (const line of text.split(/\r?\n/)) {
    const h = /^\s*\[mcp_servers\.([^\].]+)(?:\.(env))?\]\s*$/.exec(line)
    if (h) { out[h[1]] ??= {}; cur = h[2] ? (out[h[1]].env ??= {}) : out[h[1]]; continue }
    if (/^\s*\[/.test(line)) { cur = null; continue }
    const kv = /^\s*([A-Za-z0-9_]+)\s*=\s*(.+?)\s*$/.exec(line)
    if (cur && kv) cur[kv[1]] = val(kv[2])
  }
  return out
}

// Любой формат (Claude Desktop/Code, Cursor, Windsurf, Cline, VS Code, Gemini CLI, Codex, просто карта) -> [{ name, server }]
export function parseMcpText(text, hint = '') {
  const s = String(text ?? '').trim()
  let map = null
  if (/^\s*\[mcp_servers\./m.test(s) || /\.toml$/i.test(hint)) map = parseCodexToml(s)
  else {
    let j
    try { j = JSON.parse(s.replace(/^﻿/, '')) } catch { throw new Error(tr('Это не JSON и не конфигурация MCP')) }
    if (Array.isArray(j)) map = Object.fromEntries(j.map((x, i) => [x.name ?? `server-${i + 1}`, x]))
    else if (j.mcpServers) map = j.mcpServers
    else if (j.servers && typeof j.servers === 'object') map = j.servers // VS Code
    else if (j.mcp?.servers) map = j.mcp.servers
    else if (j.command || j.url) map = { [j.name ?? 'server']: j } // одна запись
    else map = j // карта имя -> запись
  }
  const res = []
  for (const [name, raw] of Object.entries(map ?? {})) {
    const server = normalizeServer(raw)
    if (server && !raw.disabled) res.push({ name, server })
  }
  if (!res.length) throw new Error(tr('В конфигурации не найдено ни одного MCP-сервера'))
  return res
}

export function createMcpStore(file) {
  let list = []
  const readAll = () => { list = readJson(file)?.servers ?? [] }
  readAll()
  const save = () => { writeFileSync(file + '.tmp', JSON.stringify({ servers: list }, null, 1)); renameSync(file + '.tmp', file) }
  const uniqueId = (name) => {
    let id = slug(name) || 'mcp'
    if (RESERVED.includes(id)) id += '-ext'
    const base = id
    let i = 2
    while (list.some((x) => x.id === id)) id = `${base}-${i++}`
    return id
  }
  return {
    list: () => list,
    get: (id) => list.find((x) => x.id === id),
    // клиенту значения env и заголовков не отдаём
    view: () => list.map((x) => ({ id: x.id, name: x.name, type: x.type, command: x.command ?? '', args: x.args ?? [], url: x.url ?? '', envKeys: Object.keys(x.env ?? {}), headerKeys: Object.keys(x.headers ?? {}), source: x.source ?? 'manual', allBots: !!x.allBots })),
    add(name, server, source = 'manual') {
      const n = String(name ?? '').trim() || (server.command ? basename(server.command) : new URL(server.url).hostname)
      const dup = list.find((x) => x.name === n && x.type === server.type && (x.command ?? x.url) === (server.command ?? server.url))
      if (dup) return dup
      const s = { id: uniqueId(n), name: n, ...server, source, allBots: false }
      list.push(s)
      save()
      return s
    },
    // правка из формы: пустые значения секретов оставляют прежние
    update(id, a) {
      const s = list.find((x) => x.id === id)
      if (!s) throw new Error(tr('Нет такого MCP-сервера'))
      if (typeof a.name === 'string' && a.name.trim()) s.name = a.name.trim()
      if (typeof a.allBots === 'boolean') s.allBots = a.allBots
      if (s.type === 'stdio') {
        if (typeof a.command === 'string' && a.command.trim()) s.command = a.command.trim()
        if (Array.isArray(a.args)) s.args = a.args.map(String)
      } else if (typeof a.url === 'string' && a.url.trim()) s.url = a.url.trim()
      for (const [field, key] of [['env', 'env'], ['headers', 'headers']]) {
        if (a[field] && typeof a[field] === 'object') for (const [k, v] of Object.entries(a[field])) { if (v === null) delete (s[key] ??= {})[k]; else if (String(v).trim()) (s[key] ??= {})[k] = String(v) }
      }
      save()
      return s
    },
    remove(id) { list = list.filter((x) => x.id !== id); save() },
    reload: readAll,
  }
}

// Запись для --mcp-config claude. На Windows npx и подобные запускаются через cmd /c
export function toClaudeEntry(s) {
  if (s.type === 'stdio') {
    const wrap = process.platform === 'win32' && /^(npx|npm|pnpm|yarn|bunx|uvx)(\.cmd)?$/i.test(s.command)
    return { type: 'stdio', command: wrap ? 'cmd' : s.command, args: wrap ? ['/c', s.command, ...(s.args ?? [])] : s.args ?? [], env: s.env ?? {} }
  }
  return { type: s.type, url: s.url, ...(s.headers && Object.keys(s.headers).length ? { headers: s.headers } : {}) }
}

// Проверка сервера: запускаем, просим tools/list, показываем имена инструментов. Не дольше 20 секунд.
export function testServer(s) {
  if (s.type !== 'stdio') {
    return (async () => {
      const post = (body, extra = {}) => fetch(s.url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(s.headers ?? {}), ...extra }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) })
      const parse = async (r) => { const t = await r.text(); const m = /^data:\s*(\{.*\})\s*$/m.exec(t); return JSON.parse(m ? m[1] : t) }
      const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'clawds', version: '1' } } })
      if (!init.ok) throw new Error(`HTTP ${init.status}`)
      const sid = init.headers.get('mcp-session-id')
      await parse(init)
      const extra = sid ? { 'mcp-session-id': sid } : {}
      await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, extra).catch(() => {})
      const r = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, extra)
      const j = await parse(r)
      return (j.result?.tools ?? []).map((t) => t.name)
    })()
  }
  return new Promise((resolve, reject) => {
    const e = toClaudeEntry(s)
    const child = spawn(e.command, e.args, { env: { ...process.env, ...(e.env ?? {}) }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: false })
    let buf = ''
    let err = ''
    let done = false
    const finish = (fn, v) => { if (done) return; done = true; clearTimeout(timer); try { child.kill() } catch { /* уже закрыт */ } fn(v) }
    const timer = setTimeout(() => finish(reject, new Error(tr('Сервер не ответил за 20 секунд') + (err ? ': ' + err.trim().slice(-200) : ''))), 20_000)
    const send = (o) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...o }) + '\n')
    child.on('error', (er) => finish(reject, new Error(er.message)))
    child.on('close', (code) => finish(reject, new Error(tr('Сервер завершился с кодом {c}', { c: code }) + (err ? ': ' + err.trim().slice(-200) : ''))))
    child.stderr.on('data', (d) => { err += d.toString() })
    child.stdout.on('data', (d) => {
      buf += d.toString()
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1)
        let m
        try { m = JSON.parse(line) } catch { continue }
        if (m.id === 1) { send({ method: 'notifications/initialized' }); send({ id: 2, method: 'tools/list' }) }
        else if (m.id === 2) finish(resolve, (m.result?.tools ?? []).map((t) => t.name))
      }
    })
    send({ id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'clawds', version: '1' } } })
  })
}

// Где другие агенты хранят MCP-серверы (папка проекта добавляет .mcp.json)
export function mcpSources(projectDir) {
  const list = [
    ['Claude Desktop', join(APPDATA, 'Claude', 'claude_desktop_config.json')],
    ['Claude Code', join(HOME, '.claude.json')],
    ['Cursor', join(HOME, '.cursor', 'mcp.json')],
    ['Windsurf', join(HOME, '.codeium', 'windsurf', 'mcp_config.json')],
    ['VS Code', join(APPDATA, 'Code', 'User', 'mcp.json')],
    ['Cline', join(APPDATA, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json')],
    ['Gemini CLI', join(HOME, '.gemini', 'settings.json')],
    ['Codex CLI', join(HOME, '.codex', 'config.toml')],
  ]
  if (projectDir) list.push(['.mcp.json проекта', join(projectDir, '.mcp.json')], ['Cursor проекта', join(projectDir, '.cursor', 'mcp.json')])
  return list
}

export function readMcpSource(file) {
  try { return parseMcpText(readFileSync(file, 'utf8'), file) } catch { return [] }
}

export function scanMcp(projectDir) {
  const found = []
  for (const [source, file] of mcpSources(projectDir)) {
    if (!existsSync(file)) continue
    const servers = readMcpSource(file)
    if (servers.length) found.push({ source, file, servers: servers.map(({ name, server }) => ({ name, type: server.type, summary: server.type === 'stdio' ? [server.command, ...(server.args ?? [])].join(' ').slice(0, 120) : server.url, secrets: Object.keys(server.env ?? {}).length + Object.keys(server.headers ?? {}).length })) })
  }
  return found
}

/* ---------- Навыки ---------- */

export function parseSkillMd(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(String(text).replace(/^﻿/, ''))
  const meta = {}
  let body = String(text)
  if (m) {
    body = m[2]
    const lines = m[1].split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(lines[i])
      if (!kv) continue
      let v = kv[2].trim()
      // YAML-блоки «>» и «|»: значение на следующих строках с отступом
      if (/^[>|][+-]?$/.test(v)) {
        const parts = []
        while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) parts.push(lines[++i].trim())
        v = parts.join(' ')
      }
      meta[kv[1]] = v.replace(/^["']|["']$/g, '').trim()
    }
  }
  return { meta, body: body.trim() }
}
export const skillText = (name, description, body) => `---\nname: ${name}\ndescription: ${String(description).replace(/\r?\n/g, ' ').trim()}\n---\n\n${String(body).trim()}\n`

export function createSkillStore(dir) {
  mkdirSync(dir, { recursive: true })
  const skillDir = (n) => join(dir, n)
  const read = (n) => { try { return readFileSync(join(skillDir(n), 'SKILL.md'), 'utf8') } catch { return null } }
  return {
    dir,
    path: skillDir,
    names: () => { try { return readdirSync(dir).filter((n) => existsSync(join(dir, n, 'SKILL.md'))).sort() } catch { return [] } },
    view() {
      return this.names().map((n) => {
        const { meta, body } = parseSkillMd(read(n))
        return { name: n, description: meta.description ?? '', size: body.length, builtin: existsSync(join(skillDir(n), '.builtin')), source: existsSync(join(skillDir(n), '.source')) ? readFileSync(join(skillDir(n), '.source'), 'utf8').trim() : 'manual' }
      })
    },
    get(n) { const t = read(n); if (t === null) return null; const { meta, body } = parseSkillMd(t); return { name: n, description: meta.description ?? '', body } },
    save(name, description, body, source = '') {
      const n = slug(name)
      if (!n) throw new Error(tr('Имя навыка: латиница, цифры, «-» и «_»'))
      if (!String(body ?? '').trim()) throw new Error(tr('Пустой навык'))
      mkdirSync(skillDir(n), { recursive: true })
      writeFileSync(join(skillDir(n), 'SKILL.md'), skillText(n, description || n, body))
      if (source) writeFileSync(join(skillDir(n), '.source'), source)
      return n
    },
    // Копирует папку навыка целиком (со скриптами и справочными файлами)
    importDir(src, source) {
      const t = readFileSync(join(src, 'SKILL.md'), 'utf8')
      const { meta } = parseSkillMd(t)
      let n = slug(meta.name || basename(src))
      if (!n) throw new Error(tr('Имя навыка: латиница, цифры, «-» и «_»'))
      const base = n
      let i = 2
      while (existsSync(skillDir(n))) n = `${base}-${i++}`
      cpSync(src, skillDir(n), { recursive: true, filter: (p) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(p) })
      writeFileSync(join(skillDir(n), '.source'), source)
      return n
    },
    remove(n) { if (slug(n) !== n) return; rmSync(skillDir(n), { recursive: true, force: true }) },
    exists: (n) => existsSync(join(skillDir(n), 'SKILL.md')),
  }
}

// Папки навыков и правила других агентов. Возвращает кандидатов, ничего не копируя.
export function scanSkills(projectDir) {
  const out = []
  const skillRoots = [
    ['Claude Code', join(HOME, '.claude', 'skills')],
    ...(projectDir ? [['Claude Code проекта', join(projectDir, '.claude', 'skills')]] : []),
  ]
  for (const [source, root] of skillRoots) {
    if (!existsSync(root)) continue
    for (const n of readdirSync(root)) {
      const p = join(root, n)
      if (existsSync(join(p, 'SKILL.md'))) out.push({ kind: 'skill', source, name: n, description: parseSkillMd(readFileSync(join(p, 'SKILL.md'), 'utf8')).meta.description ?? '', path: p })
    }
  }
  // навыки из плагинов Claude Code (не глубже четырёх уровней, не больше 150 штук)
  const plug = join(HOME, '.claude', 'plugins')
  const walk = (d, depth) => {
    if (depth > 4 || out.length > 150) return
    let ents = []
    try { ents = readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of ents) {
      if (!e.isDirectory() || e.name === 'node_modules' || e.name === '.git') continue
      const p = join(d, e.name)
      if (basename(d) === 'skills' && existsSync(join(p, 'SKILL.md'))) out.push({ kind: 'skill', source: 'Плагин Claude Code', name: e.name, description: parseSkillMd(readFileSync(join(p, 'SKILL.md'), 'utf8')).meta.description ?? '', path: p })
      else walk(p, depth + 1)
    }
  }
  if (existsSync(plug)) walk(plug, 0)
  // правила и инструкции других агентов, из них получаются навыки
  const rules = []
  if (projectDir) {
    for (const [source, f] of [['Codex и др. (AGENTS.md)', 'AGENTS.md'], ['Claude Code (CLAUDE.md)', 'CLAUDE.md'], ['Gemini CLI (GEMINI.md)', 'GEMINI.md'], ['GitHub Copilot', join('.github', 'copilot-instructions.md')], ['Windsurf', '.windsurfrules'], ['Cursor', '.cursorrules']]) {
      const p = join(projectDir, f)
      if (existsSync(p)) rules.push({ source, path: p, name: slug(basename(f).replace(/\.(md|mdc)$/i, '')) })
    }
    const cr = join(projectDir, '.cursor', 'rules')
    if (existsSync(cr)) for (const f of readdirSync(cr)) if (/\.(mdc|md)$/i.test(f)) rules.push({ source: 'Cursor (rules)', path: join(cr, f), name: slug('cursor-' + f.replace(/\.(mdc|md)$/i, '')) })
  }
  for (const r of rules) {
    let text = ''
    try { text = readFileSync(r.path, 'utf8') } catch { continue }
    const { meta, body } = parseSkillMd(text)
    out.push({ kind: 'rules', source: r.source, name: r.name, description: meta.description || body.split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#'))?.slice(0, 160) || r.name, path: r.path })
  }
  return out
}

// Раскладывает включённые навыки в папку бота: claude подхватывает .claude/skills в рабочей папке сам
export function syncBotSkills(store, botDir, names) {
  const dest = join(botDir, '.claude', 'skills')
  const marker = join(dest, '.clawds-managed.json')
  let managed = []
  try { managed = JSON.parse(readFileSync(marker, 'utf8')) } catch { /* первый раз */ }
  mkdirSync(dest, { recursive: true })
  const want = names.filter((n) => store.exists(n))
  for (const n of managed) if (!want.includes(n)) rmSync(join(dest, n), { recursive: true, force: true })
  for (const n of want) {
    const src = store.path(n)
    const cur = (() => { try { return readFileSync(join(dest, n, 'SKILL.md'), 'utf8') } catch { return null } })()
    if (cur !== readFileSync(join(src, 'SKILL.md'), 'utf8')) cpSync(src, join(dest, n), { recursive: true, force: true })
  }
  writeFileSync(marker, JSON.stringify(want))
  return want
}

// Готовые стартовые навыки: копируются в хранилище один раз
export function seedBuiltins(store, fromDir) {
  if (!existsSync(fromDir)) return
  for (const n of readdirSync(fromDir)) {
    if (!existsSync(join(fromDir, n, 'SKILL.md')) || store.exists(n)) continue
    cpSync(join(fromDir, n), store.path(n), { recursive: true })
    writeFileSync(join(store.path(n), '.builtin'), '1')
  }
}

export const statSafe = (p) => { try { return statSync(p) } catch { return null } }
