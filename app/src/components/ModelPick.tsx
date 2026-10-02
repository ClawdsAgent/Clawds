import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { EFFORTS, MODEL_GROUPS, epId, modelName, supportsEffort } from '../models'
import { useStore } from '../store'
import { t } from '../i18n'

type Item = { id: string; name: string; sub?: string; lite?: boolean }
const CAP = 80 // у OpenRouter сотни моделей: показываем первые, остальное находится поиском

// Выбор модели с поиском: алиасы Claude и модели всех подключённых эндпоинтов
export function ModelSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const providers = useStore((s) => s.conn.providers)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<React.CSSProperties>({})

  // Список поверх всего (у окна есть прокрутка, внутри него он обрезался): открываем вниз или вверх, где больше места
  const toggle = () => {
    if (!open && box.current) {
      const r = box.current.getBoundingClientRect()
      const below = window.innerHeight - r.bottom
      const width = Math.max(r.width, 280)
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
      setPos(below >= 300 || below >= r.top ? { left, width, top: r.bottom + 6, maxHeight: Math.max(160, below - 14) } : { left, width, bottom: window.innerHeight - r.top + 6, maxHeight: Math.max(160, r.top - 14) })
    }
    setOpen(!open)
  }

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const ok = (id: string, name: string) => !ql || id.toLowerCase().includes(ql) || name.toLowerCase().includes(ql)
    const out: { label: string; items: Item[]; total: number }[] = []
    for (const g of MODEL_GROUPS) {
      const items = g.items.filter((m) => ok(m.id, m.name)).map((m) => ({ ...m, name: t(m.name) }))
      if (items.length) out.push({ label: t(g.label), items, total: items.length })
    }
    for (const p of providers) {
      const all = p.models.filter((m) => ok(m.id, m.name))
      if (all.length) out.push({ label: p.name, total: all.length, items: all.slice(0, CAP).map((m) => ({ id: epId(p.id, m.id), name: m.name, sub: m.name !== m.id ? m.id : undefined, lite: m.lite })) })
    }
    return out
  }, [q, providers])

  const pick = (id: string) => { onChange(id); setOpen(false); setQ('') }

  return (
    <div className="mp" ref={box}>
      <button type="button" className="mp-btn" onClick={toggle}>
        <span>{modelName(value)}</span><ChevronDown size={15} />
      </button>
      {open && (
        <div className="mp-pop" style={pos}>
          <div className="mp-search">
            <Search size={14} />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Найти модель')}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }}
            />
          </div>
          <div className="mp-list" style={{ maxHeight: typeof pos.maxHeight === 'number' ? pos.maxHeight - 52 : 300 }}>
            {groups.map((g) => (
              <div key={g.label}>
                <div className="mp-group">{g.label}</div>
                {g.items.map((m) => (
                  <button type="button" key={m.id} className={'mp-item' + (m.id === value ? ' on' : '')} onClick={() => pick(m.id)}>
                    <span className="mp-name">{m.name}{m.lite && <em>{t('упрощённо')}</em>}</span>
                    {m.sub && <span className="mp-sub">{m.sub}</span>}
                  </button>
                ))}
                {g.total > g.items.length && <div className="mp-more">{t('Ещё {n}: уточните поиск', { n: g.total - g.items.length })}</div>}
              </div>
            ))}
            {groups.length === 0 && <div className="mp-more">{t('Ничего не найдено')}</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export function EffortSelect({ value, model, onChange }: { value: string; model: string; onChange: (v: string) => void }) {
  const ok = supportsEffort(model)
  return (
    <select value={ok ? value : 'default'} disabled={!ok} onChange={(e) => onChange(e.target.value)} title={ok ? '' : t('Эта модель не поддерживает уровни размышлений')}>
      {EFFORTS.map((e) => <option key={e.id} value={e.id}>{t(e.name)}</option>)}
    </select>
  )
}
