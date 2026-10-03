// Clawds server: HTTP + WebSocket. Слушает только 127.0.0.1.
import http from 'node:http'
import { WebSocketServer } from 'ws'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, extname, normalize, sep } from 'node:path'
import { randomBytes } from 'node:crypto'
import { tr } from './lib/locale.mjs'
import { init, snapshot, launcherInfo, connInfo, toolsInfo, isOpen, GLOBAL_COMMANDS, onEvent, commands, agentCall, tickSchedules, ROOT, UPLOADS, PORT } from './core.mjs'

// Порт с ботами в режиме bypassPermissions = выполнение кода, поэтому только 127.0.0.1
// и только страницы с этих адресов (иначе любой сайт мог бы управлять ботами).
const ALLOWED = new Set(['5173', String(PORT)].flatMap((p) => [`http://localhost:${p}`, `http://127.0.0.1:${p}`]))
const DIST = join(ROOT, 'app', 'dist')
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf' }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  const origin = req.headers.origin
  if (origin && ALLOWED.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin)

  // Агенты (скрипт clawds.mjs) ходят сюда с токеном запуска
  if (url.pathname === '/agent' && req.method === 'POST') {
    let body = ''
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy() })
    req.on('end', () => {
      try {
        const { token, action, args, files } = JSON.parse(body)
        const out = agentCall(token, action, Array.isArray(args) ? args.map(String) : [], Array.isArray(files) ? files.map(String) : [])
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, out: String(out ?? '') }))
      } catch (e) {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: false, error: e.message }))
      }
    })
    return
  }

  if (url.pathname.startsWith('/files/')) {
    const p = normalize(join(UPLOADS, decodeURIComponent(url.pathname.slice(7))))
    if (!p.startsWith(UPLOADS + sep) || !existsSync(p)) return res.writeHead(404).end()
    res.writeHead(200, { 'content-type': MIME[extname(p).toLowerCase()] ?? 'application/octet-stream', 'x-content-type-options': 'nosniff' })
    return createReadStream(p).pipe(res)
  }

  // Собранный интерфейс (npm run build в app), чтобы работал один порт
  if (existsSync(DIST)) {
    let p = normalize(join(DIST, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)))
    if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) p = join(DIST, 'index.html')
    res.writeHead(200, { 'content-type': MIME[extname(p).toLowerCase()] ?? 'application/octet-stream' })
    return createReadStream(p).pipe(res)
  }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('Clawds server работает. Интерфейс: npm run dev в папке app.')
})

const wss = new WebSocketServer({ server, maxPayload: 40 * 1024 * 1024, verifyClient: ({ origin }) => ALLOWED.has(origin ?? '') })

wss.on('connection', (ws) => {
  const clientId = randomBytes(4).toString('hex')
  const send = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o))
  const off = onEvent((ev, except) => { if (except !== clientId) send(ev) })
  send(launcherInfo())
  send(connInfo())
  send(toolsInfo())
  send(isOpen() ? { t: 'snapshot', state: snapshot() } : { t: 'closed' })
  ws.on('close', off)
  ws.on('message', async (raw) => {
    let m
    try { m = JSON.parse(raw.toString()) } catch { return }
    if (m.t !== 'cmd' || typeof m.name !== 'string') return
    const fn = commands[m.name]
    try {
      if (!fn) throw new Error(tr('Неизвестная команда {n}', { n: m.name }))
      if (!isOpen() && !GLOBAL_COMMANDS.has(m.name)) throw new Error(tr('Сначала откройте папку или сессию'))
      const data = await fn('me', { ...(m.args ?? {}), except: clientId })
      send({ t: 'res', id: m.id, ok: true, data })
    } catch (e) {
      send({ t: 'res', id: m.id, ok: false, error: e.message })
    }
  })
})

await init()
setInterval(() => tickSchedules(), 20_000)
server.listen(PORT, '127.0.0.1', () => console.log(`Clawds server: http://127.0.0.1:${PORT}`))
