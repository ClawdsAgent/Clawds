// Модели и уровни размышлений: те же значения, что принимает claude --model / --effort
export const MODEL_GROUPS: { label: string; items: { id: string; name: string }[] }[] = [
  {
    label: 'Последние (алиасы)',
    items: [
      { id: 'fable', name: 'Fable 5.1, самый мощный' },
      { id: 'opus', name: 'Opus 5.5' },
      { id: 'sonnet', name: 'Sonnet 5.5' },
      { id: 'haiku', name: 'Haiku 4.5, быстрый' },
      { id: 'opusplan', name: 'Opus планирует, Sonnet делает' },
    ],
  },
  {
    label: 'Конкретные версии',
    items: [
      { id: 'claude-fable-5-1', name: 'Fable 5.1' },
      { id: 'claude-fable-5', name: 'Fable 5' },
      { id: 'claude-opus-5-5', name: 'Opus 5.5' },
      { id: 'claude-opus-5', name: 'Opus 5' },
      { id: 'claude-opus-4-8', name: 'Opus 4.8' },
      { id: 'claude-opus-4-7', name: 'Opus 4.7' },
      { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5' },
      { id: 'claude-sonnet-5', name: 'Sonnet 5' },
      { id: 'claude-haiku-4-5', name: 'Haiku 4.5' },
    ],
  },
]

// Эндпоинты приходят с сервера; здесь копия для названий и проверок
import type { Provider } from './types'
let registry: Provider[] = []
export const setProviderRegistry = (p: Provider[]) => { registry = p }
export const EP = 'ep:'
export const epId = (pid: string, id: string) => EP + pid + ':' + id
export const parseEp = (m: string) => {
  if (!m.startsWith(EP)) return null
  const rest = m.slice(EP.length)
  const i = rest.indexOf(':')
  return i < 1 ? null : { pid: rest.slice(0, i), id: rest.slice(i + 1) }
}
export const modelName = (id: string) => {
  const e = parseEp(id)
  if (e) {
    const p = registry.find((x) => x.id === e.pid)
    return p ? (p.models.find((x) => x.id === e.id)?.name ?? e.id) + ' · ' + p.name : e.id + ' (эндпоинт удалён)'
  }
  return MODEL_GROUPS.flatMap((g) => g.items).find((m) => m.id === id)?.name ?? id
}

export const EFFORTS = [
  { id: 'default', name: 'По умолчанию модели' },
  { id: 'low', name: 'Низкий: быстро и дёшево' },
  { id: 'medium', name: 'Средний' },
  { id: 'high', name: 'Высокий' },
  { id: 'xhigh', name: 'Очень высокий' },
  { id: 'max', name: 'Максимум: самые глубокие' },
]

export const supportsEffort = (model: string) => !/haiku/i.test(model) && !model.startsWith(EP)
