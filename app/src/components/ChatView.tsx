import { useEffect, useRef, useState } from 'react'
import { Users, Pin, MoreVertical, BellOff, Bell, LogOut, Ban, ChevronLeft, ArrowDown } from 'lucide-react'
import { useStore } from '../store'
import MessageView from './MessageView'
import Composer from './Composer'
import { Avatar, UserAvatar } from './ui'
import { t } from '../i18n'

export default function ChatView() {
  const { channels, messages, active, bots, typing, setPanel, panel, muted, toggleMute, leaveChannel, block, openProfile, backToList, setModal } = useStore()
  const [away, setAway] = useState(false)
  const nearBottom = useRef(true)
  const boxRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState(false)
  const ch = channels.find((c) => c.id === active)
  const list = messages.filter((m) => m.channelId === active && !m.threadOf)
  const endRef = useRef<HTMLDivElement>(null)
  const last = messages[messages.length - 1]

  useEffect(() => { if (nearBottom.current) endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [list.length, last?.text, last?.tools?.length])
  useEffect(() => { nearBottom.current = true; setAway(false); endRef.current?.scrollIntoView({ block: 'end' }) }, [active])
  useEffect(() => setMenu(false), [active])

  if (!ch) {
    // Пустая сессия: ни ботов, ни групп. Иначе просто не выбран чат.
    return (
      <main className="chat empty">
        <div className="empty-card">
          <div className="dots big"><u /><u /><u /></div>
          {channels.length === 0 ? (
            <>
              <h2>{t('Здесь пока пусто')}</h2>
              <p>{t('В этой сессии нет ботов и групп. Создайте первого бота, потом можно собрать из ботов группу.')}</p>
              <div className="row-btns">
                <button className="btn primary" onClick={() => setModal('createBot')}>{t('Создать бота')}</button>
                <button className="btn" disabled={bots.length === 0} onClick={() => setModal('createGroup')}>{t('Создать группу')}</button>
              </div>
            </>
          ) : <h2>{t('Выберите чат')}</h2>}
        </div>
      </main>
    )
  }

  const member = ch.members.includes('me')
  const bot = ch.kind === 'dm' ? bots.find((b) => b.id === (ch.members.find((x) => x !== 'me') ?? ch.members[0])) : undefined
  const pinned = list.filter((m) => m.pinned).length
  const typers = (typing[active] ?? []).map((id) => bots.find((b) => b.id === id)?.name).filter(Boolean)
  const isMuted = muted.includes(ch.id)
  const sub = typers.length
    ? `${typers.join(', ')} ${typers.length > 1 ? t('печатают') : t('печатает')}`
    : !member ? t('переписка ботов, вы наблюдаете') : bot ? bot.role : t('{n} участников', { n: ch.members.length })

  return (
    <main className="chat">
      <header className="chat-head">
        <button className="icon-btn back-btn" onClick={backToList}><ChevronLeft size={24} /></button>
        <div className="head-title">
          {bot ? <UserAvatar id={bot.id} size={40} /> : <button className="av-btn" onClick={() => setPanel({ kind: 'members' })}><Avatar id={ch.id} size={40} /></button>}
          <button className="head-text" onClick={() => (bot ? openProfile(bot.id) : setPanel({ kind: 'members' }))}>
            <b>{ch.kind === 'channel' ? '# ' : ''}{ch.name}{isMuted && <BellOff size={13} className="muted-ico" />}</b>
            <div className={'sub' + (typers.length ? ' live' : '')}>
              {sub}{typers.length > 0 && <i className="dots"><u /><u /><u /></i>}
            </div>
          </button>
        </div>
        <div className="grow" />
        {pinned > 0 && <span className="pill"><Pin size={12} /> {pinned}</span>}
        {ch.kind === 'channel' && (
          <button className={'pill btn' + (panel.kind === 'members' ? ' sel' : '')} onClick={() => setPanel(panel.kind === 'members' ? { kind: 'none' } : { kind: 'members' })}>
            <Users size={14} /> {ch.members.length}
          </button>
        )}
        <div className="menu-wrap">
          <button className="icon-btn" onClick={() => setMenu(!menu)}><MoreVertical size={19} /></button>
          {menu && (
            <>
              <div className="menu-back" onClick={() => setMenu(false)} />
              <div className="menu">
                <button onClick={() => { toggleMute(ch.id); setMenu(false) }}>{isMuted ? <Bell size={16} /> : <BellOff size={16} />} {isMuted ? t('Включить звук') : t('Заглушить')}</button>
                {ch.kind === 'channel' && member && <button className="danger" onClick={() => { leaveChannel(ch.id); setMenu(false) }}><LogOut size={16} /> {t('Покинуть группу')}</button>}
                {bot && member && <button className="danger" onClick={() => { block(bot.id); setMenu(false) }}><Ban size={16} /> {t('Заблокировать')}</button>}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="messages" key={active} ref={boxRef} onScroll={(e) => { const el = e.currentTarget; const d = el.scrollHeight - el.scrollTop - el.clientHeight; nearBottom.current = d < 120; setAway(d > 260) }}>
        <div className="date-chip">{t('Сегодня')}</div>
        {list.map((m, i) => {
          const prev = list[i - 1]
          const next = list[i + 1]
          const near = (a?: typeof m, b?: typeof m) => !!a && !!b && a.authorId === b.authorId && Math.abs(a.ts - b.ts) < 5 * 60_000
          if (m.system) return <div className="sys-msg" key={m.id}>{m.text}</div>
          return <MessageView key={m.id} msg={m} showName={ch.kind === 'channel'} pos={{ first: !near(prev, m), last: !near(m, next) }} />
        })}
        <div ref={endRef} />
      </div>

      {away && <button className="to-bottom" onClick={() => endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })}><ArrowDown size={18} /></button>}
      {member ? <Composer channelId={active} /> : <div className="spectate">{t('Вы наблюдаете за перепиской. Писать здесь могут только участники.')}</div>}
    </main>
  )
}
