// Общие правила аккаунтов, цвета, cron
export const COLORS = [
  'oklch(0.78 0.13 55)', 'oklch(0.76 0.11 200)', 'oklch(0.76 0.12 340)', 'oklch(0.8 0.13 130)',
  'oklch(0.74 0.13 25)', 'oklch(0.82 0.1 90)', 'oklch(0.74 0.09 270)',
]

export function autoNumber(seed) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const a = String((h >>> 0) % 10000).padStart(4, '0')
  const b = String(((h >>> 0) * 7919) % 10000).padStart(4, '0')
  return `+888 ${a} ${b}`
}

// Юзернейм: латиница, цифры и «_», от 3 до 32 символов, свободный
export function usernameRule(raw, taken) {
  const u = String(raw).trim().toLowerCase()
  if (!/^[a-z][a-z0-9_]*$/.test(u)) return { ok: false, cost: 0, reason: 'Латиница, цифры и «_», первая буква' }
  if (u.length < 3) return { ok: false, cost: 0, reason: 'Минимум 3 символа' }
  if (u.length > 32) return { ok: false, cost: 0, reason: 'Максимум 32 символа' }
  if (taken.includes(u)) return { ok: false, cost: 0, reason: 'Уже занят' }
  return { ok: true, cost: 0 }
}

// Минимальный cron: 5 полей, поддерживает *, числа, списки через запятую, диапазоны a-b и шаг */n
function fieldMatches(field, value, min, max) {
  return field.split(',').some((part) => {
    const [range, stepRaw] = part.split('/')
    const step = stepRaw ? parseInt(stepRaw, 10) : 1
    if (!step || step < 1) return false
    let lo = min, hi = max
    if (range !== '*') {
      const [a, b] = range.split('-')
      lo = parseInt(a, 10)
      hi = b === undefined ? (stepRaw ? max : lo) : parseInt(b, 10)
      if (Number.isNaN(lo) || Number.isNaN(hi)) return false
    }
    return value >= lo && value <= hi && (value - lo) % step === 0
  })
}
export function cronMatches(expr, d = new Date()) {
  const f = String(expr).trim().split(/\s+/)
  if (f.length !== 5) return false
  return (
    fieldMatches(f[0], d.getMinutes(), 0, 59) && fieldMatches(f[1], d.getHours(), 0, 23) &&
    fieldMatches(f[2], d.getDate(), 1, 31) && fieldMatches(f[3], d.getMonth() + 1, 1, 12) &&
    fieldMatches(f[4], d.getDay(), 0, 6)
  )
}

// Модели и уровни размышлений (effort) для claude --model / --effort
export const MODELS = [
  'fable', 'opus', 'sonnet', 'haiku', 'opusplan',
  'claude-fable-5-1', 'claude-fable-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-opus-4-8', 'claude-opus-4-7',
  'claude-sonnet-5-5', 'claude-sonnet-5', 'claude-haiku-4-5',
]
export const EFFORTS = ['default', 'low', 'medium', 'high', 'xhigh', 'max']
// Haiku уровни размышлений не поддерживает
export const supportsEffort = (model) => !/haiku/i.test(model) && !String(model).startsWith('ep:')
