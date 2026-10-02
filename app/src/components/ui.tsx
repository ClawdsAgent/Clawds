import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../store'
import { t, locale } from '../i18n'

/* ---------- Аватары: у каждого бота свой «зверёк», собранный из хеша имени ---------- */

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const BODIES = [
  'M20 3C30 3 37 10 37 20S30 37 20 37 3 30 3 20 10 3 20 3Z',
  'M9 3H31C35 3 37 5 37 9V31C37 35 35 37 31 37H9C5 37 3 35 3 31V9C3 5 5 3 9 3Z',
  'M20 2C28 2 38 9 37 20C36 31 29 38 19 37C9 36 2 29 3 19C4 9 12 2 20 2Z',
  'M12 3H28L37 12V28L28 37H12L3 28V12Z',
  'M20 2C23 2 25 6 29 7C33 8 38 10 38 14C38 18 35 19 35 23C35 28 37 31 33 34C29 37 25 34 20 38C15 34 11 37 7 34C3 31 5 28 5 23C5 19 2 18 2 14C2 10 7 8 11 7C15 6 17 2 20 2Z',
]

function Eyes({ v }: { v: number }) {
  switch (v) {
    case 0: return <><circle cx="14" cy="17" r="2.4" /><circle cx="26" cy="17" r="2.4" /></>
    case 1: return <><circle cx="14" cy="17" r="4" fill="#fff" /><circle cx="26" cy="17" r="4" fill="#fff" /><circle cx="15" cy="17.5" r="1.8" /><circle cx="27" cy="17.5" r="1.8" /></>
    case 2: return <><path d="M11 17.5Q14 14 17 17.5M23 17.5Q26 14 29 17.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></>
    case 3: return <><circle cx="20" cy="16" r="5" fill="#fff" /><circle cx="21" cy="16.5" r="2.4" /></>
    default: return <><rect x="11" y="15" width="6" height="4.4" rx="2.2" /><rect x="23" y="15" width="6" height="4.4" rx="2.2" /></>
  }
}
function Mouth({ v }: { v: number }) {
  switch (v) {
    case 0: return <path d="M15 26Q20 30 25 26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    case 1: return <path d="M16 27H24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    case 2: return <ellipse cx="20" cy="27" rx="2.6" ry="3" />
    default: return <path d="M14 25Q20 33 26 25Z" />
  }
}
function Extra({ v }: { v: number }) {
  switch (v) {
    case 0: return <><path d="M20 3V-1" stroke="currentColor" strokeWidth="2" /><circle cx="20" cy="-1.5" r="2" /></>
    case 1: return <><path d="M8 7L5 1L13 5Z" /><path d="M32 7L35 1L27 5Z" /></>
    case 2: return <><circle cx="9" cy="23" r="2.6" fill="#fff" opacity=".35" /><circle cx="31" cy="23" r="2.6" fill="#fff" opacity=".35" /></>
    default: return null
  }
}

export function Avatar({ id, size = 40 }: { id: string; size?: number }) {
  const bot = useStore((s) => s.bots.find((b) => b.id === id))
  const busy = useStore((s) => Object.values(s.typing).some((a) => a.includes(id)))
  const h = hash(id)
  const fill = id === 'me' ? 'oklch(0.82 0.16 125)' : bot?.color ?? `oklch(0.72 0.1 ${h % 360})`
  return (
    <svg className={"avatar" + (busy ? " busy" : "")} width={size} height={size} viewBox="-2 -4 44 46" style={{ color: 'oklch(0.2 0.02 80)' }} aria-hidden>
      <path d={BODIES[h % BODIES.length]} fill={fill} />
      <g fill="currentColor"><Extra v={(h >> 3) % 4} /></g>
      <g fill="currentColor"><Eyes v={(h >> 6) % 5} /></g>
      <g fill="currentColor"><Mouth v={(h >> 9) % 4} /></g>
    </svg>
  )
}

/* ---------- Свой набор реакций ---------- */

export const REACTIONS = ['ok', 'ship', 'eyes', 'heart', 'bolt', 'think'] as const

export function Emoji({ k, size = 18 }: { k: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true } as const
  switch (k) {
    case 'ok':
      return <svg {...p}><path d="M12 2.5c3 0 5 1.6 7 2.8 1.2 2 2.5 4 2.5 6.7s-1.3 4.7-2.5 6.7c-2 1.2-4 2.8-7 2.8s-5-1.6-7-2.8C3.8 16.7 2.5 14.7 2.5 12s1.3-4.7 2.5-6.7C7 4.1 9 2.5 12 2.5Z" fill="oklch(0.82 0.16 140)" /><path d="M7.5 12.3l3 3 6-6.6" fill="none" stroke="oklch(0.22 0.04 140)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'ship':
      return <svg {...p}><path d="M3 11.5L21 3l-6.5 18-3.2-7.3Z" fill="oklch(0.78 0.14 60)" /><path d="M11.3 13.7L21 3" stroke="oklch(0.3 0.06 60)" strokeWidth="1.6" strokeLinecap="round" /><path d="M3 11.5l8.3 2.2" stroke="oklch(0.3 0.06 60)" strokeWidth="1.6" strokeLinecap="round" /></svg>
    case 'eyes':
      return <svg {...p}><ellipse cx="7.5" cy="12" rx="4.6" ry="6" fill="#f4efe6" /><ellipse cx="16.5" cy="12" rx="4.6" ry="6" fill="#f4efe6" /><circle cx="8.8" cy="13" r="2.3" fill="oklch(0.25 0.03 80)" /><circle cx="17.8" cy="13" r="2.3" fill="oklch(0.25 0.03 80)" /></svg>
    case 'heart':
      return <svg {...p}><path d="M12 21C5 16.2 2.5 12.6 2.5 9A4.9 4.9 0 0 1 12 7.3 4.9 4.9 0 0 1 21.5 9c0 3.6-2.5 7.2-9.5 12Z" fill="oklch(0.7 0.18 20)" /><path d="M6.5 8.6a2.6 2.6 0 0 1 2.4-1.4" stroke="#fff" strokeOpacity=".55" strokeWidth="1.6" strokeLinecap="round" fill="none" /></svg>
    case 'bolt':
      return <svg {...p}><path d="M13.5 2L4.5 13.5H11L9.8 22l9.7-12.2H13Z" fill="oklch(0.88 0.17 100)" stroke="oklch(0.4 0.08 90)" strokeWidth="1.2" strokeLinejoin="round" /></svg>
    case 'think':
      return <svg {...p}><path d="M7 18.5C3.6 18.5 2 16.2 2 14c0-2 1.4-3.6 3.4-3.9C5.8 7 8.2 5 11.3 5c2.6 0 4.7 1.4 5.6 3.5 2.6.1 4.6 2 4.6 4.6 0 3-2.2 5.4-5.2 5.4Z" fill="oklch(0.78 0.06 220)" /><circle cx="9" cy="12.4" r="1.2" fill="oklch(0.28 0.04 230)" /><circle cx="13" cy="12.4" r="1.2" fill="oklch(0.28 0.04 230)" /><circle cx="17" cy="12.4" r="1.2" fill="oklch(0.28 0.04 230)" /></svg>
    default:
      return <span>{k}</span>
  }
}

/* ---------- Остальное ---------- */

export function authorName(id: string, bots: { id: string; name: string }[]) {
  return id === 'me' ? t('Вы') : bots.find((b) => b.id === id)?.name ?? id
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className={'modal' + (wide ? ' wide' : '')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button className={'toggle' + (on ? ' on' : '')} disabled={disabled} onClick={() => onChange(!on)}>
      <span />
    </button>
  )
}

export function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
}

export function fmtAgo(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000)
  if (m < 1) return t('только что')
  if (m < 60) return t('{m} мин назад', { m })
  const h = Math.round(m / 60)
  if (h < 24) return t('{h} ч назад', { h })
  const d = Math.round(h / 24)
  return d === 1 ? t('вчера') : t('{d} дн назад', { d })
}
export const folderName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p

export function fmtReset(ts: number) {
  if (!ts) return '—'
  const m = Math.max(0, Math.round((ts - Date.now()) / 60000))
  if (m < 60) return t('{m} мин', { m })
  const h = Math.floor(m / 60)
  if (h < 48) return t('{h} ч {m} мин', { h, m: m % 60 })
  return t('{d} дн', { d: Math.round(h / 24) })
}

/* ---------- Профиль, тосты, вложения ---------- */

export function UserAvatar({ id, size = 40 }: { id: string; size?: number }) {
  const openProfile = useStore((s) => s.openProfile)
  return (
    <button className="av-btn" title={t('Профиль')} onClick={(e) => { e.stopPropagation(); openProfile(id) }}>
      <Avatar id={id} size={size} />
    </button>
  )
}

export function handle(a: { username: string; number: string; primary: 'username' | 'number' }) {
  return a.primary === 'username' ? { main: '@' + a.username, alt: a.number } : { main: a.number, alt: '@' + a.username }
}

export function fmtSize(n: number) {
  if (n < 1024) return n + ' ' + t('Б')
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' ' + t('КБ')
  return (n / 1024 / 1024).toFixed(1) + ' ' + t('МБ')
}

export function Toast() {
  const toast = useStore((s) => s.toast)
  if (!toast) return null
  return <div className="toast" key={toast.id}>{toast.text}</div>
}
