// Импорт переписок из других ИИ: экспорт ChatGPT, экспорт Claude.ai, журналы Claude Code (.jsonl), общий JSON и простой текст.
// Результат один: список разговоров { id, title, messages: [{ role: 'user' | 'assistant', text, ts }] }
import { tr } from './locale.mjs'

const MAX_TEXT = 20_000
const MAX_MSGS = 2000
const clip = (s) => String(s ?? '').trim().slice(0, MAX_TEXT)
const ms = (v) => { if (!v) return 0; if (typeof v === 'number') return v < 1e12 ? Math.round(v * 1000) : v; const t = Date.parse(v); return Number.isNaN(t) ? 0 : t }

function blocksText(c) {
  if (typeof c === 'string') return c
  if (!Array.isArray(c)) return ''
  return c.map((b) => (typeof b === 'string' ? b : b?.type === 'text' || b?.text ? b.text : '')).filter(Boolean).join('\n')
}

function chatgpt(list) {
  return list.filter((c) => c?.mapping).map((c, i) => {
    // идём от текущего сообщения к корню: в экспорте это дерево с ветками
    const chain = []
    let id = c.current_node ?? Object.keys(c.mapping).find((k) => !c.mapping[k].children?.length)
    while (id && c.mapping[id]) { chain.push(c.mapping[id]); id = c.mapping[id].parent }
    chain.reverse()
    const messages = []
    for (const n of chain) {
      const m = n.message
      const role = m?.author?.role
      if (role !== 'user' && role !== 'assistant') continue
      const parts = m.content?.parts
      const text = clip(Array.isArray(parts) ? parts.filter((p) => typeof p === 'string').join('\n') : m.content?.text ?? '')
      if (text) messages.push({ role, text, ts: ms(m.create_time) })
    }
    return { id: c.conversation_id ?? c.id ?? 'c' + i, title: c.title || tr('Без названия'), messages: messages.slice(-MAX_MSGS) }
  })
}

function claudeAi(list) {
  return list.filter((c) => Array.isArray(c?.chat_messages)).map((c, i) => ({
    id: c.uuid ?? 'c' + i,
    title: c.name || tr('Без названия'),
    messages: c.chat_messages.map((m) => ({ role: m.sender === 'human' ? 'user' : 'assistant', text: clip(m.text || blocksText(m.content)), ts: ms(m.created_at) })).filter((m) => m.text).slice(-MAX_MSGS),
  }))
}

// Журнал Claude Code: по строке JSON, user/assistant с message.content; вызовы инструментов пропускаем
function claudeCodeJsonl(lines, name) {
  const messages = []
  let title = ''
  for (const o of lines) {
    if (o.type === 'summary' && o.summary && !title) title = o.summary
    if (o.type !== 'user' && o.type !== 'assistant') continue
    if (o.isMeta || o.isSidechain) continue
    const text = clip(blocksText(o.message?.content))
    if (!text || /^<(command|local-command|system-reminder)/.test(text)) continue
    messages.push({ role: o.type, text, ts: ms(o.timestamp) })
  }
  const first = messages.find((m) => m.role === 'user')?.text.split('\n')[0].slice(0, 70)
  return [{ id: name || 'session', title: title || first || tr('Сессия Claude Code'), messages: messages.slice(-MAX_MSGS) }]
}

function generic(j) {
  const arr = Array.isArray(j) ? j : Array.isArray(j?.messages) ? j.messages : null
  if (!arr) return []
  const messages = arr.map((m) => {
    const r = String(m.role ?? m.sender ?? m.author ?? '').toLowerCase()
    return { role: /user|human|me|person/.test(r) ? 'user' : /assistant|bot|ai|model|gpt|claude/.test(r) ? 'assistant' : '', text: clip(blocksText(m.content ?? m.text ?? m.message)), ts: ms(m.ts ?? m.time ?? m.timestamp ?? m.created_at) }
  }).filter((m) => m.role && m.text)
  return messages.length ? [{ id: 'chat', title: j.title ?? j.name ?? tr('Импортированный чат'), messages: messages.slice(-MAX_MSGS) }] : []
}

// Текст вида «User: ...» / «Assistant: ...» (копия переписки из окна чата)
function plain(text) {
  const messages = []
  let cur = null
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:\*\*)?(user|you|human|я|пользователь|assistant|claude|chatgpt|gpt|bot|ai|ассистент|бот)(?:\*\*)?\s*[:：]\s*(.*)$/i.exec(line)
    if (m) {
      if (cur) messages.push(cur)
      cur = { role: /^(user|you|human|я|пользователь)$/i.test(m[1]) ? 'user' : 'assistant', text: m[2], ts: 0 }
    } else if (cur) cur.text += '\n' + line
  }
  if (cur) messages.push(cur)
  const ok = messages.map((x) => ({ ...x, text: clip(x.text) })).filter((x) => x.text)
  return ok.length >= 2 ? [{ id: 'text', title: tr('Импортированный чат'), messages: ok.slice(-MAX_MSGS) }] : []
}

export function parseChats(text, filename = '') {
  const s = String(text ?? '').replace(/^﻿/, '').trim()
  if (!s) throw new Error(tr('Пусто: нечего импортировать'))
  let convs = []
  let format = ''
  if (/\.jsonl$/i.test(filename) || (s.startsWith('{') && s.includes('\n{'))) {
    const lines = s.split(/\r?\n/).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
    if (lines.length) { convs = claudeCodeJsonl(lines, filename.replace(/\.jsonl$/i, '').split(/[\\/]/).pop()); format = 'Claude Code' }
  }
  if (!convs.length) {
    let j = null
    try { j = JSON.parse(s) } catch { /* не JSON */ }
    if (j) {
      const list = Array.isArray(j) ? j : j.conversations ?? [j]
      if (list.some((c) => c?.mapping)) { convs = chatgpt(list); format = 'ChatGPT' }
      else if (list.some((c) => Array.isArray(c?.chat_messages))) { convs = claudeAi(list); format = 'Claude.ai' }
      else { convs = generic(j); format = 'JSON' }
    } else { convs = plain(s); format = tr('Текст') }
  }
  convs = convs.filter((c) => c.messages.length)
  if (!convs.length) throw new Error(tr('Не нашёл переписок в этом файле'))
  return { format, conversations: convs }
}
