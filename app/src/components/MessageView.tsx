import { useState } from 'react'
import { ChevronRight, Loader2, Check, MessageSquare, Pin, Wrench, FileText, Download } from 'lucide-react'
import { useStore } from '../store'
import type { Attachment, Message, ToolCall } from '../types'
import Markdown from './Markdown'
import { t } from '../i18n'
import { Emoji, REACTIONS, UserAvatar, authorName, fmtSize, fmtTime } from './ui'

const toolKind = (t: string) =>
  t.startsWith('clawds') ? 'clawds' : t === 'Bash' || t === 'PowerShell' ? 'run' : t === 'Edit' || t === 'Write' ? 'write' : t === 'Read' ? 'read' : 'web'

// Все инструменты сообщения свёрнуты в один блок: пока бот работает, видно текущий шаг, потом счётчик
function ToolGroup({ tools }: { tools: ToolCall[] }) {
  const [open, setOpen] = useState(false)
  const active = tools.find((t) => !t.done)
  const names = [...new Set(tools.map((t) => t.tool))]
  return (
    <div className={'tgroup' + (open ? ' open' : '')}>
      <button className="tg-head" onClick={(e) => { e.stopPropagation(); setOpen(!open) }}>
        <ChevronRight size={14} className="chev" />
        <Wrench size={13} />
        {active ? (
          <span className="tg-title"><b>{active.tool}</b> <code>{active.input}</code></span>
        ) : (
          <span className="tg-title">{t('Инструментов:')} <b>{tools.length}</b><span className="sub"> · {names.slice(0, 3).join(', ')}{names.length > 3 ? '…' : ''}</span></span>
        )}
        {active ? <Loader2 size={14} className="spin" /> : <Check size={14} className="ok" />}
      </button>
      <div className="tool-fold"><div className="tg-body">{tools.map((t) => <ToolCard key={t.id} t={t} />)}</div></div>
    </div>
  )
}

function ToolCard({ t }: { t: ToolCall }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={'tool' + (open ? ' open' : '')} data-kind={toolKind(t.tool)}>
      <button className="tool-head" onClick={() => setOpen(!open)}>
        <ChevronRight size={14} className="chev" />
        <Wrench size={13} />
        <b>{t.tool}</b>
        <code>{t.input}</code>
        {t.done ? <Check size={14} className="ok pop" /> : <Loader2 size={14} className="spin" />}
      </button>
      <div className="tool-fold"><pre className="tool-out">{t.output ?? ''}</pre></div>
    </div>
  )
}

function Attachments({ list }: { list: Attachment[] }) {
  const setLightbox = useStore((s) => s.setLightbox)
  const imgs = list.filter((a) => a.mime.startsWith('image/'))
  const files = list.filter((a) => !a.mime.startsWith('image/'))
  return (
    <>
      {imgs.length > 0 && (
        <div className={'att-grid n' + Math.min(imgs.length, 4)}>
          {imgs.map((a) => (
            <button key={a.id} className="att-img" onClick={(e) => { e.stopPropagation(); setLightbox(a) }}>
              <img src={a.url} alt={a.name} />
            </button>
          ))}
        </div>
      )}
      {files.map((a) => (
        <button key={a.id} className="att-file" onClick={(e) => { e.stopPropagation(); setLightbox(a) }}>
          <span className="att-ico"><FileText size={20} /></span>
          <span className="grow"><b>{a.name}</b><span className="sub">{fmtSize(a.size)}</span></span>
          <Download size={16} />
        </button>
      ))}
    </>
  )
}

export default function MessageView({
  msg, inThread, pos = { first: true, last: true }, showName = true,
}: { msg: Message; inThread?: boolean; pos?: { first: boolean; last: boolean }; showName?: boolean }) {
  const { bots, react, pin, setPanel, messages, openProfile, accounts } = useStore()
  const replies = messages.filter((m) => m.threadOf === msg.id).length
  const names = bots.map((b) => b.name)
  const bot = bots.find((b) => b.id === msg.authorId)
  const mine = msg.authorId === 'me'
  const [bar, setBar] = useState(false)

  // Упоминания с приоритетом: [high]@бот будит (tier 2), [low]@бот и @бот от бота только уведомляют, /all будит всех (tier 1)
  const accountIdByHandle = (h: string) => (names.includes(h) ? h : Object.values(accounts).find((a) => a.username === h)?.id)
  // Токены внутри Markdown: упоминания (@бот, [high]@бот, [low]@бот) и /all
  const mention = (p: string, key: string) => {
    if (p === '/all') return <span key={key} className="mention all">/all</span>
    const mm = p.match(/^(?:\[(high|low)\]\s*)?@(\w+)$/)
    if (!mm) return null
    const id = accountIdByHandle(mm[2])
    if (!id && mm[2] !== 'all') return null
    return (
      <button key={key} className={'mention' + (mm[1] === 'high' ? ' hi' : mm[1] === 'low' ? ' lo' : '')} onClick={(e) => { e.stopPropagation(); if (id) openProfile(id) }}>
        {mm[1] === 'high' && <Emoji k="bolt" size={13} />}@{mm[2]}
      </button>
    )
  }

  return (
    <div className={'msg' + (mine ? ' mine' : '') + (pos.first ? ' first' : '') + (pos.last ? ' last' : '') + (bar ? ' show' : '')} onClick={() => setBar(!bar)}>
      {!mine && <div className="msg-av">{pos.last && <UserAvatar id={msg.authorId} size={34} />}</div>}
      <div className="bubble-wrap">
        <div className={'bubble' + (msg.pinned ? ' pinned' : '') + (msg.error ? ' err' : '') + (msg.tier === 1 ? ' t1' : '')} onDoubleClick={() => react(msg.id, 'heart')}>
          {msg.tier === 1 && <div className="t1-label"><Emoji k="bolt" size={14} /> {t('Важное · для всех')}</div>}
          {!mine && pos.first && showName && (
            <button className="b-name" style={{ color: bot?.color }} onClick={() => openProfile(msg.authorId)}>{authorName(msg.authorId, bots)}</button>
          )}
          {!!msg.tools?.length && <ToolGroup tools={msg.tools} />}
          {msg.attachments && <Attachments list={msg.attachments} />}
          {(msg.text || (!msg.tools?.length && !msg.attachments?.length)) && (
            <div className="b-text">
              <Markdown text={msg.text} mention={mention} />
              {msg.streaming && <span className="caret" />}
            </div>
          )}
          <div className="b-foot">
            {msg.pinned && <Pin size={11} />}
            <span>{fmtTime(msg.ts)}</span>
          </div>
        </div>

        {Object.keys(msg.reactions).length > 0 && (
          <div className="reactions">
            {Object.entries(msg.reactions).map(([e, who]) => (
              <button key={e} className={who.includes('me') ? 'mine' : ''} onClick={() => react(msg.id, e)}>
                <Emoji k={e} size={16} /> <span key={who.length}>{who.length}</span>
              </button>
            ))}
          </div>
        )}
        {!inThread && replies > 0 && (
          <button className="thread-link" onClick={() => setPanel({ kind: 'thread', id: msg.id })}>
            <MessageSquare size={13} /> {replies} {replies === 1 ? t('ответ') : t('ответов')}
          </button>
        )}

        {!msg.streaming && (
          <div className="msg-actions">
            {REACTIONS.map((e) => (
              <button key={e} className="qr" title={t('Реакция')} onClick={(ev) => { ev.stopPropagation(); react(msg.id, e); setBar(false) }}><Emoji k={e} size={20} /></button>
            ))}
            <span className="qsep" />
            {!inThread && <button className="icon-btn" title={t('Тред')} onClick={() => setPanel({ kind: 'thread', id: msg.id })}><MessageSquare size={16} /></button>}
            <button className="icon-btn" title={t('Закрепить')} onClick={() => pin(msg.id)}><Pin size={16} /></button>
          </div>
        )}
      </div>
    </div>
  )
}
