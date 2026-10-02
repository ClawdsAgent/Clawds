import { Plus, Search, Settings as Cog, FolderGit2, BellOff, Users, MessageSquare } from 'lucide-react'
import { useStore } from '../store'
import { Avatar, authorName, fmtTime } from './ui'

export default function Sidebar() {
  const { channels, bots, messages, active, setActive, setModal, setPanel, quota, typing, panel, muted, accounts, live, unreadOf, running, stopAll } = useStore()

  const last = (cid: string) => { for (let i = messages.length - 1; i >= 0; i--) if (messages[i].channelId === cid && !messages[i].threadOf) return messages[i] }
  const rows = channels
    .map((c) => ({ c, m: last(c.id) }))
    .sort((a, b) => (b.m?.ts ?? 0) - (a.m?.ts ?? 0))

  const pct = (v: number) => (quota.known ? Math.round(v) + '%' : '—')

  return (
    <aside className="sidebar">
      <div className="side-top">
        <button className="search-pill" onClick={() => setModal('search')}>
          <Search size={16} /> Поиск <kbd>Ctrl K</kbd>
        </button>
        <button className="round-btn" title="Создать бота" onClick={() => setModal('createBot')}><Plus size={18} /></button>
      </div>

      <div className="chips">
        <button className="chip" onClick={() => setModal('createGroup')}>+ Группа</button>
        <button className="chip" onClick={() => setModal('accounts')}><Users size={13} /> Аккаунты</button>
        {running > 0 && <button className="chip stop" onClick={stopAll} title="Остановить всех ботов">Стоп · {running}</button>}
        <span className={'live-dot' + (live ? ' on' : '')} title={live ? 'Сервер подключён' : 'Нет связи с сервером'}>{live ? 'online' : 'offline'}</span>
        <button className={'chip' + (panel.kind === 'workspace' ? ' on' : '')} onClick={() => setPanel(panel.kind === 'workspace' ? { kind: 'none' } : { kind: 'workspace' })}>
          <FolderGit2 size={13} /> Воркспейс
        </button>
      </div>

      <div className="chatlist">
        {rows.length === 0 && <div className="side-empty">Пока нет чатов. Нажмите + и создайте первого бота.</div>}
        {rows.map(({ c, m }) => {
          const member = c.members.includes('me')
          const peer = c.kind === 'dm' ? c.members.find((x) => x !== 'me') : undefined
          const bot = peer ? bots.find((b) => b.id === peer) : undefined
          const typers = typing[c.id] ?? []
          const unread = unreadOf(c.id)
          const isMuted = muted.includes(c.id)
          return (
            <button key={c.id} className={'chat-row' + (active === c.id ? ' sel' : '')} onClick={() => setActive(c.id)}>
              <Avatar id={bot ? bot.id : c.kind === 'dm' ? c.members[0] : c.id} size={46} />
              <div className="cr-main">
                <div className="cr-top">
                  <b>{c.kind === 'channel' ? '# ' : ''}{c.name}{isMuted && <BellOff size={12} className="muted-ico" />}</b>
                  <span className="cr-time">{m ? fmtTime(m.ts) : ''}</span>
                </div>
                <div className="cr-bottom">
                  {typers.length > 0 ? (
                    <span className="cr-typing">{typers.join(', ')} печатает<i className="dots"><u /><u /><u /></i></span>
                  ) : (
                    <span className="cr-prev">
                      {!member && 'наблюдение · '}
                      {m ? (c.kind === 'channel' || m.authorId === 'me' || !member ? authorName(m.authorId, bots) + ': ' : '') + (m.text || m.tools?.[0]?.tool || '…') : 'Нет сообщений'}
                    </span>
                  )}
                  {unread > 0 && <span className={'badge' + (isMuted ? ' mute' : '')} key={unread}>{unread}</span>}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <button className="me-card" onClick={() => setModal('settings')}>
        <Avatar id="me" size={38} />
        <div className="me-main">
          <div className="me-top"><b>{accounts.me?.name}</b><Cog size={15} /></div>
          <div className="qline"><span>5 ч</span><div className="bar"><i style={{ width: quota.fiveHour.pct + '%' }} /></div><em>{pct(quota.fiveHour.pct)}</em></div>
          <div className="qline"><span>нед</span><div className="bar"><i style={{ width: quota.sevenDay.pct + '%' }} /></div><em>{pct(quota.sevenDay.pct)}</em></div>
        </div>
      </button>
      <nav className="bottom-nav">
        <button className="on"><MessageSquare size={20} />Чаты</button>
        <button onClick={() => setModal('accounts')}><Users size={20} />Аккаунты</button>
        <button onClick={() => setPanel({ kind: 'workspace' })}><FolderGit2 size={20} />Воркспейс</button>
        <button onClick={() => setModal('settings')}><Cog size={20} />Я</button>
      </nav>
    </aside>
  )
}
