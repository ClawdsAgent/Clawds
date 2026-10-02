// Связь с локальным сервером Clawds: команды и поток событий.
import { t } from './i18n'
const URL_WS = `ws://127.0.0.1:8787`

type Handlers = { onEvent: (e: any) => void; onStatus: (open: boolean) => void }
let ws: WebSocket | null = null
let started = false
let seq = 0
const pending = new Map<number, { ok: (v: any) => void; fail: (e: Error) => void }>()

export function connect(h: Handlers) {
  if (started) return
  started = true
  const open = () => {
    try { ws = new WebSocket(URL_WS) } catch { setTimeout(open, 2500); return }
    ws.onopen = () => h.onStatus(true)
    ws.onclose = () => {
      h.onStatus(false)
      pending.forEach((p) => p.fail(new Error(t('Связь с сервером потеряна'))))
      pending.clear()
      setTimeout(open, 2500)
    }
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.t === 'res') {
        const p = pending.get(m.id)
        if (!p) return
        pending.delete(m.id)
        m.ok ? p.ok(m.data) : p.fail(new Error(m.error))
      } else h.onEvent(m)
    }
  }
  open()
}

export function call<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  return new Promise((ok, fail) => {
    if (!ws || ws.readyState !== 1) return fail(new Error(t('Сервер не подключён')))
    const id = ++seq
    pending.set(id, { ok, fail })
    ws.send(JSON.stringify({ t: 'cmd', id, name, args }))
  })
}
