import { modelName } from '../models'
import { useState } from 'react'
import { Search, Copy, MessageCircle, Ban, BellOff, Bell, Settings2, Check, X } from 'lucide-react'
import { useStore } from '../store'
import { Avatar, Modal, handle } from './ui'
import { usernameRule } from '../rules'

const ago = (ts: number) => {
  const m = Math.round((Date.now() - ts) / 60000)
  return m < 60 ? `${m} мин назад` : `${Math.round(m / 60)} ч назад`
}

export function ProfileModal() {
  const { profileId, accounts, bots, channels, muted, setModal, openDm, block, unblock, toggleMute, setPanel, say } = useStore()
  const a = profileId ? accounts[profileId] : undefined
  if (!a) return null
  const isMe = a.id === 'me'
  const bot = bots.find((b) => b.id === a.id)
  const h = handle(a)
  const blocked = accounts.me.blocked.includes(a.id)
  const dm = channels.find((c) => c.id === `dm-${a.id}`)
  const common = channels.filter((c) => c.kind === 'channel' && c.members.includes(a.id) && c.members.includes('me'))
  const copy = (t: string) => { navigator.clipboard?.writeText(t); say('Скопировано') }

  return (
    <Modal title="" onClose={() => setModal(null)}>
      <div className="profile">
        <Avatar id={a.id} size={96} />
        <h2>{a.name}{bot && <span className="tag">бот</span>}</h2>
        <button className="handle" onClick={() => copy(h.main)}>{h.main} <Copy size={13} /></button>
        <button className="handle alt" onClick={() => copy(h.alt)}>{h.alt}</button>
        {a.bio && <p className="bio">{a.bio}</p>}
        <div className="stats">
          <div><b>{common.length}</b><span>общих групп</span></div>
          {bot && <div><b>{modelName(bot.model)}</b><span>модель</span></div>}
        </div>

        <div className="p-actions">
          {isMe ? (
            <button className="btn primary" onClick={() => setModal('account')}><Settings2 size={16} /> Редактировать аккаунт</button>
          ) : (
            <>
              <button className="btn primary" onClick={() => { openDm(a.id); setModal(null) }}><MessageCircle size={16} /> Написать</button>
              {dm && <button className="btn" onClick={() => toggleMute(dm.id)}>{muted.includes(dm.id) ? <Bell size={16} /> : <BellOff size={16} />}{muted.includes(dm.id) ? 'Звук' : 'Заглушить'}</button>}
              <button className="btn danger" onClick={() => (blocked ? unblock(a.id) : block(a.id))}><Ban size={16} /> {blocked ? 'Разблокировать' : 'Заблокировать'}</button>
              {bot && <button className="btn" onClick={() => { setPanel({ kind: 'bot', id: bot.id }); setModal(null) }}>Настройки бота</button>}
            </>
          )}
        </div>

        {bot && (
          <div className="alog">
            <h3>Действия аккаунта</h3>
            <div className="sub">Аккаунтом управляет сам агент</div>
            {a.log.length === 0 && <div className="sub">Пока пусто</div>}
            {a.log.slice(0, 5).map((l, i) => <div className="alog-row" key={i}><span>{l.text}</span><em>{ago(l.ts)}</em></div>)}
          </div>
        )}
      </div>
    </Modal>
  )
}

export function AccountsModal() {
  const { accounts, openProfile, setModal } = useStore()
  const [q, setQ] = useState('')
  const list = Object.values(accounts).filter((a) => {
    const s = q.toLowerCase().replace(/\s+/g, '')
    return !s || a.name.toLowerCase().includes(s) || a.username.includes(s.replace('@', '')) || a.number.replace(/\s+/g, '').includes(s)
  })
  return (
    <Modal title="Аккаунты" onClose={() => setModal(null)}>
      <div className="search-box"><Search size={16} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, @юзер или номер" /></div>
      <div className="results">
        {list.map((a) => {
          const h = handle(a)
          return (
            <button className="acc-row" key={a.id} onClick={() => openProfile(a.id)}>
              <Avatar id={a.id} size={42} />
              <span className="grow"><b>{a.name}</b><span className="sub">{h.main} · {h.alt}</span></span>
            </button>
          )
        })}
        {list.length === 0 && <div className="sub">Ничего не найдено</div>}
      </div>
    </Modal>
  )
}

export function AccountModal() {
  const { accounts, updateAccount, setUsername, unblock, setModal, bots } = useStore()
  const me = accounts.me
  const [tab, setTab] = useState<'profile' | 'user' | 'number' | 'blocked'>('profile')
  const [uname, setUname] = useState(me.username)
  const taken = Object.values(accounts).filter((a) => a.id !== 'me').map((a) => a.username)
  const rule = usernameRule(uname, taken)
  const same = uname.trim().toLowerCase() === me.username

  return (
    <Modal title="Мой аккаунт" onClose={() => setModal(null)} wide>
      <div className="acc-head">
        <Avatar id="me" size={64} />
        <div className="grow"><b>{me.name}</b><div className="sub">{handle(me).main} · {handle(me).alt}</div></div>
      </div>
      <div className="tabs">
        {([['profile', 'Профиль'], ['user', 'Юзернейм'], ['number', 'Номер'], ['blocked', 'Блок-лист']] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? 'sel' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'profile' && (
        <>
          <label>Имя</label>
          <input value={me.name} onChange={(e) => updateAccount('me', { name: e.target.value })} />
          <label>О себе</label>
          <textarea rows={2} value={me.bio} onChange={(e) => updateAccount('me', { bio: e.target.value })} />
          <label>Основной идентификатор</label>
          <div className="seg">
            <button className={me.primary === 'username' ? 'sel' : ''} onClick={() => updateAccount('me', { primary: 'username' })}>@{me.username}</button>
            <button className={me.primary === 'number' ? 'sel' : ''} onClick={() => updateAccount('me', { primary: 'number' })}>{me.number}</button>
          </div>
        </>
      )}

      {tab === 'user' && (
        <>
          <label>Юзернейм выбираете сами: латиница, цифры и «_», от 3 символов. Его можно менять в любой момент, номер остаётся прежним.</label>
          <div className="uname"><span>@</span><input value={uname} onChange={(e) => setUname(e.target.value)} placeholder="username" /></div>
          {!same && (
            <div className={'hint ' + (rule.ok ? 'good' : 'bad')}>
              {rule.ok ? <><Check size={14} /> Свободен</> : <><X size={14} /> {rule.reason}</>}
            </div>
          )}
          <div className="modal-foot">
            <button className="btn primary" disabled={same || !rule.ok} onClick={() => setUsername(uname)}>
              Установить
            </button>
          </div>
        </>
      )}

      {tab === 'number' && (
        <>
          <div className="card"><span className="sub">Постоянный адрес аккаунта, выдан автоматически</span><div className="bignum">{me.number}</div></div>
          <div className="sub" style={{ marginTop: 12 }}>Имя и юзернейм можно менять, номер не меняется никогда. Поэтому по номеру вас всегда найдут: ссылки, журналы и упоминания не ломаются при переименовании.</div>
        </>
      )}

      {tab === 'blocked' && (
        <>
          {me.blocked.length === 0 && <div className="sub">Никого не заблокировали</div>}
          {me.blocked.map((b) => (
            <div className="shop-row" key={b}>
              <Avatar id={b} size={32} /><b className="grow" style={{ marginLeft: 10 }}>{bots.find((x) => x.id === b)?.name ?? b}</b>
              <button className="btn" onClick={() => unblock(b)}>Разблокировать</button>
            </div>
          ))}
        </>
      )}
    </Modal>
  )
}
