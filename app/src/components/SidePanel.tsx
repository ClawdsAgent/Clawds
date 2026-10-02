import { useEffect, useState } from 'react'
import { X, Folder, FileText, GitBranch, GitCommit, Plus, Trash2, Clock, UserPlus } from 'lucide-react'
import { useStore } from '../store'
import type { FileNode } from '../types'
import { Avatar, UserAvatar } from './ui'
import MessageView from './MessageView'
import Composer from './Composer'
import { EffortSelect, ModelSelect } from './ModelPick'
import { modelName } from '../models'
import { t } from '../i18n'

function Tree({ nodes, depth = 0 }: { nodes: FileNode[]; depth?: number }) {
  return (
    <>
      {nodes.map((n) => (
        <div key={n.name}>
          <div className="tree-row" style={{ paddingLeft: 8 + depth * 14 }}>
            {n.type === 'dir' ? <Folder size={14} /> : <FileText size={14} />} {n.name}
          </div>
          {n.children && <Tree nodes={n.children} depth={depth + 1} />}
        </div>
      ))}
    </>
  )
}

function Head({ title, sub }: { title: string; sub?: string }) {
  const setPanel = useStore((s) => s.setPanel)
  return (
    <div className="panel-head">
      <div>
        <b>{title}</b>
        {sub && <div className="sub">{sub}</div>}
      </div>
      <button className="icon-btn" onClick={() => setPanel({ kind: 'none' })}><X size={18} /></button>
    </div>
  )
}

function BotPanel({ id }: { id: string }) {
  const { bots, updateBot } = useStore()
  const bot = bots.find((b) => b.id === id)!
  const [tab, setTab] = useState<'claude' | 'memory' | 'todo' | 'schedule'>('claude')
  const [cron, setCron] = useState('')
  const [prompt, setPrompt] = useState('')
  const field = tab === 'claude' ? 'claudeMd' : tab === 'memory' ? 'memory' : 'todo'

  return (
    <>
      <Head title={bot.name} sub={`${modelName(bot.model)} · ${t('запусков сегодня:')} ${bot.runsToday}`} />
      <div className="panel-body">
        <div className="bot-hero">
          <Avatar id={bot.id} size={56} />
          <p>{bot.role}</p>
        </div>
        <div className="row-set">
          <label>{t('Модель')}</label>
          <ModelSelect value={bot.model} onChange={(v) => updateBot(bot.id, { model: v })} />
        </div>
        <div className="row-set">
          <label>{t('Размышления')}</label>
          <EffortSelect value={bot.effort} model={bot.model} onChange={(v) => updateBot(bot.id, { effort: v })} />
        </div>
        <div className="row-set">
          <label>{t('Главный')}<span className="sub"> {t('может менять размышления других ботов')}</span></label>
          <input type="checkbox" checked={bot.boss} onChange={(e) => updateBot(bot.id, { boss: e.target.checked })} />
        </div>
        <div className="row-set">
          <label>{t('Спит (не расходует лимит)')}</label>
          <input type="checkbox" checked={bot.sleeping} onChange={(e) => updateBot(bot.id, { sleeping: e.target.checked })} />
        </div>
        <div className="tabs">
          {([['claude', 'CLAUDE.md'], ['memory', t('Память')], ['todo', 'todo.md'], ['schedule', t('Расписание')]] as const).map(([k, l]) => (
            <button key={k} className={tab === k ? 'sel' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {tab !== 'schedule' ? (
          <textarea className="editor" value={bot[field]} onChange={(e) => updateBot(bot.id, { [field]: e.target.value })} placeholder={t('Пусто')} />
        ) : (
          <div>
            {bot.schedule.map((s) => (
              <div className="sched" key={s.id}>
                <Clock size={14} />
                <div className="grow"><code>{s.cron}</code><div className="sub">{s.prompt}</div></div>
                <button className="icon-btn" onClick={() => updateBot(bot.id, { schedule: bot.schedule.filter((x) => x.id !== s.id) })}><Trash2 size={15} /></button>
              </div>
            ))}
            {bot.schedule.length === 0 && <div className="sub">{t('Расписания нет')}</div>}
            <div className="sched-add">
              <input placeholder={t('cron, например 0 9 * * *')} value={cron} onChange={(e) => setCron(e.target.value)} />
              <input placeholder={t('Что сделать')} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <button
                className="btn"
                disabled={!cron.trim() || !prompt.trim()}
                onClick={() => {
                  updateBot(bot.id, { schedule: [...bot.schedule, { id: String(Date.now()), cron: cron.trim(), prompt: prompt.trim() }] })
                  setCron(''); setPrompt('')
                }}
              >
                <Plus size={14} /> {t('Добавить')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function WorkspacePanel() {
  const { workspace, addFolder, setRemote, refreshWorkspace, session, newSession, resetSession, closeSession, renameSession } = useStore()
  const [folder, setFolder] = useState('')
  const [remote, setRemoteText] = useState('')
  const [name, setName] = useState(session?.name ?? '')
  const [confirmReset, setConfirmReset] = useState(false)
  useEffect(() => { refreshWorkspace() }, [refreshWorkspace])
  useEffect(() => setName(session?.name ?? ''), [session?.id, session?.name])
  return (
    <>
      <Head title={t('Воркспейс')} sub={workspace.path} />
      <div className="panel-body">
        <div className="card sess">
          <div className="sub">{t('Сессия')}</div>
          <div className="sess-name">
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== session?.name && renameSession(name)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
          </div>
          <div className="sub">{workspace.path}</div>
          <div className="sess-actions">
            <button className="btn primary" onClick={newSession}><Plus size={15} /> {t('Новая сессия')}</button>
            <button className="btn" onClick={closeSession}>{t('Сменить папку или сессию')}</button>
          </div>
          <details className="opts" onToggle={(e) => !(e.target as HTMLDetailsElement).open && setConfirmReset(false)}>
            <summary>{t('Опции')}</summary>
            <div className="opts-body">
              <p>{t('Сброс удаляет ботов, группы, переписку и память этой сессии. Файлы папки и ветки в git остаются.')}</p>
              {!confirmReset ? (
                <button className="btn danger" onClick={() => setConfirmReset(true)}>{t('Сбросить сессию')}</button>
              ) : (
                <div className="row-btns">
                  <button className="btn danger" onClick={() => { setConfirmReset(false); resetSession() }}>{t('Да, сбросить')}</button>
                  <button className="btn" onClick={() => setConfirmReset(false)}>{t('Отмена')}</button>
                </div>
              )}
            </div>
          </details>
        </div>
        <div className="card"><b>GitHub</b><div className="sub">{workspace.remote || t('remote origin не задан')}</div><div className="sub">{workspace.dirty ? t('Незакоммиченных изменений: {n}', { n: workspace.dirty }) : t('Всё закоммичено')}</div></div>
        <div className="sched-add"><input placeholder={t('https://github.com/вы/репозиторий.git')} value={remote} onChange={(e) => setRemoteText(e.target.value)} /><button className="btn" disabled={!remote.trim()} onClick={() => { setRemote(remote); setRemoteText('') }}>{t('Задать remote origin')}</button></div>
        <h4>{t('Папки проекта')}</h4>
        {workspace.folders.map((f) => <div className="tree-row" key={f}><Folder size={14} /> {f}</div>)}
        <div className="sched-add">
          <input placeholder={t('Путь к папке')} value={folder} onChange={(e) => setFolder(e.target.value)} />
          <button className="btn" disabled={!folder.trim()} onClick={() => { addFolder(folder); setFolder('') }}><Plus size={14} /> {t('Добавить')}</button>
        </div>
        <h4>{t('Ветки')}</h4>
        {workspace.branches.map((b) => <div className="tree-row" key={b}><GitBranch size={14} /> {b}</div>)}
        <h4>{t('Коммиты')}</h4>
        {workspace.commits.map((c) => (
          <div className="commit" key={c.hash}>
            <GitCommit size={14} />
            <div className="grow">{c.msg}<div className="sub">{c.author} · {c.branch} · {c.ago}</div></div>
            <code>{c.hash}</code>
          </div>
        ))}
        <h4>{t('Файлы')}</h4>
        <Tree nodes={workspace.tree} />
      </div>
    </>
  )
}

function MembersPanel() {
  const { channels, active, bots, addMembers, openDm } = useStore()
  const ch = channels.find((c) => c.id === active)!
  const outside = bots.filter((b) => !ch.members.includes(b.id))
  return (
    <>
      <Head title={t('Участники')} sub={`#${ch.name}`} />
      <div className="panel-body">
        <div className="member"><UserAvatar id="me" size={28} /> {t('Вы')}</div>
        {ch.members.filter((m) => m !== 'me').map((m) => {
          const b = bots.find((x) => x.id === m)!
          return <button className="member click" key={m} onClick={() => openDm(m)}><UserAvatar id={m} size={28} /> {b.name}</button>
        })}
        {outside.length > 0 && <h4>{t('Добавить в группу')}</h4>}
        {outside.map((b) => (
          <button className="member click" key={b.id} onClick={() => addMembers(ch.id, [b.id])}>
            <Avatar id={b.id} size={28} /> {b.name} <UserPlus size={14} className="right" />
          </button>
        ))}
      </div>
    </>
  )
}

function ThreadPanel({ id }: { id: string }) {
  const { messages } = useStore()
  const root = messages.find((m) => m.id === id)
  if (!root) return null
  const replies = messages.filter((m) => m.threadOf === id)
  return (
    <>
      <Head title={t('Тред')} />
      <div className="panel-body thread">
        <MessageView msg={root} inThread />
        {replies.length === 0 ? <div className="t-empty"><Avatar id={root.authorId} size={64} /><b>{t('Ответов пока нет')}</b><span>{t('Напишите первым, ответ уйдёт в этот тред')}</span></div> : <div className="sep">{t('{n} ответов', { n: replies.length })}</div>}
        {replies.map((m) => <MessageView key={m.id} msg={m} inThread />)}
      </div>
      <Composer channelId={root.channelId} threadOf={root.id} placeholder={t('Ответить в треде')} />
    </>
  )
}

export default function SidePanel() {
  const panel = useStore((s) => s.panel)
  if (panel.kind === 'none') return null
  return (
    <aside className="panel">
      {panel.kind === 'bot' && <BotPanel id={panel.id} />}
      {panel.kind === 'workspace' && <WorkspacePanel />}
      {panel.kind === 'members' && <MembersPanel />}
      {panel.kind === 'thread' && <ThreadPanel id={panel.id} />}
    </aside>
  )
}
