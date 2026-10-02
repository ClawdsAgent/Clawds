// Правила аккаунтов: дублируют server/lib/rules.mjs для проверки на лету. Решает сервер.
export function usernameRule(raw: string, taken: string[]): { ok: boolean; reason?: string } {
  const u = raw.trim().toLowerCase()
  if (!/^[a-z][a-z0-9_]*$/.test(u)) return { ok: false, reason: 'Латиница, цифры и «_», первая буква' }
  if (u.length < 3) return { ok: false, reason: 'Минимум 3 символа' }
  if (u.length > 32) return { ok: false, reason: 'Максимум 32 символа' }
  if (taken.includes(u)) return { ok: false, reason: 'Уже занят' }
  return { ok: true }
}
