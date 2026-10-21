import { useState } from 'react'
import { Plus, Trash2, Pencil, Search, Play, Download, FileText, Sparkles } from 'lucide-react'
import '../tools.css'
import { useStore } from '../store'
import { Modal, Toggle } from './ui'
import { t } from '../i18n'

type Tab = 'mcp' | 'skills' | 'chats'

/* ---------- MCP-серверы ---------- */

type McpFound = { source: string; file: string; servers: { name: string; type: string; summary: string; secrets: number }[] }

function McpForm({ id, onDone }: { id?: string; onDone: () => void }) {
  const { tools, rpc } = useStore()
  const cur = tools.mcp.find((s) => s.id === id)
  const [name, setName] = useState(cur?.name ?? '')
  const [type, setType] = useState<string>(cur?.type ?? 'stdio')
  const [command, setCommand] = useState(cur?.command ?? '')
  const [args, setArgs] = useState((cur?.args ?? []).join(' '))
  const [url, setUrl] = useState(cur?.url ?? '')
  const [env, setEnv] = useState('')
  const [headers, setHeaders] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    const r = await rpc('saveMcp', { id, name, type, command, args, url, env, headers })
    setBusy(false)
    if (r) onDone()
  }
  return (
    <div className="conn-form">
      <label>{t('Название')}</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('например, filesystem')} />
      {!cur && (
        <>
          <label>{t('Тип')}</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="stdio">{t('Локальная программа (stdio)')}</option>
            <option value="http">{t('Сервер по адресу (http)')}</option>
            <option value="sse">{t('Сервер по адресу (sse)')}</option>
          </select>
        </>
      )}
      {type === 'stdio' ? (
        <>
          <label>{t('Команда')}</label>
          <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx" />
          <label>{t('Аргументы')}</label>
          <input value={args} onChange={(e) => setArgs(e.target.value)} placeholder="-y @modelcontextprotocol/server-filesystem D:\projects" />
          <label>{t('Переменные окружения')} <span className="sub">{cur ? t('значения не показываются; пустое поле оставит прежние') : t('по одной в строке: KEY=значение')}</span></label>
          <textarea rows={2} value={env} onChange={(e) => setEnv(e.target.value)} placeholder="API_KEY=..." />
        </>
      ) : (
        <>
          <label>{t('Адрес')}</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/mcp" />
          <label>{t('Заголовки')} <span className="sub">{cur ? t('значения не показываются; пустое поле оставит прежние') : t('по одному в строке: Authorization=Bearer ...')}</span></label>
          <textarea rows={2} value={headers} onChange={(e) => setHeaders(e.target.value)} placeholder="Authorization=Bearer ..." />
        </>
      )}
      <div className="modal-foot">
        <button className="btn ghost" onClick={onDone}>{t('Отмена')}</button>
        <button className="btn primary" disabled={busy || (type === 'stdio' ? !command.trim() : !url.trim())} onClick={save}>{t('Сохранить')}</button>
      </div>
    </div>
  )
}

function McpTab() {
  const { tools, rpc } = useStore()
  const [edit, setEdit] = useState<string | null>(null) // 'new' | id
  const [test, setTest] = useState<Record<string, string>>({})
  const [paste, setPaste] = useState('')
  const [found, setFound] = useState<McpFound[] | null>(null)
  const [pick, setPick] = useState<Record<string, boolean>>({}) // file||name
  const [busy, setBusy] = useState(false)

  const runTest = async (id: string) => {
    setTest({ ...test, [id]: '…' })
    const r = await rpc<{ ok: boolean; tools?: string[]; error?: string }>('testMcp', { id })
    setTest((cur) => ({ ...cur, [id]: r ? (r.ok ? t('Работает, инструментов: {n}', { n: r.tools?.length ?? 0 }) + (r.tools?.length ? ': ' + r.tools.slice(0, 6).join(', ') + (r.tools.length > 6 ? '…' : '') : '') : t('Ошибка') + ': ' + r.error) : '' }))
  }
  const importPaste = async () => {
    setBusy(true)
    const r = await rpc<{ added: number; total: number }>('importMcp', { text: paste })
    setBusy(false)
    if (r) { useStore.getState().say(t('Добавлено серверов: {n}', { n: r.added })); setPaste('') }
  }
  const scan = async () => {
    setBusy(true)
    const r = await rpc<{ found: McpFound[] }>('scanMcp')
    setBusy(false)
    if (r) { setFound(r.found); setPick(Object.fromEntries(r.found.flatMap((f) => f.servers.map((s) => [f.file + '||' + s.name, true])))) }
  }
  const importFound = async () => {
    setBusy(true)
    let added = 0
    for (const f of found ?? []) {
      const names = f.servers.filter((s) => pick[f.file + '||' + s.name]).map((s) => s.name)
      if (!names.length) continue
      const r = await rpc<{ added: number }>('importMcp', { file: f.file, names })
      added += r?.added ?? 0
    }
    setBusy(false)
    useStore.getState().say(t('Добавлено серверов: {n}', { n: added }))
    setFound(null)
  }

  return (
    <>
      <p className="sub tl-intro">{t('MCP-серверы дают ботам новые инструменты: файлы, браузер, базы данных, сервисы. Серверы запускаются на этом компьютере, подключайте только те, которым доверяете.')}</p>
      {tools.mcp.map((s) => (
        edit === s.id ? <McpForm key={s.id} id={s.id} onDone={() => setEdit(null)} /> : (
          <div className="conn-block" key={s.id}>
            <div className="conn-card">
              <div className="grow">
                <b>{s.name}</b> <span className="tl-tag">{s.type}</span>
                <div className="sub rs-path">{s.type === 'stdio' ? [s.command, ...s.args].join(' ') : s.url}</div>
                <div className="sub">{[s.envKeys.length ? t('переменных: {n}', { n: s.envKeys.length }) : '', s.headerKeys.length ? t('заголовков: {n}', { n: s.headerKeys.length }) : '', s.source !== 'manual' ? t('импорт: {s}', { s: t(s.source) }) : ''].filter(Boolean).join(' · ')}</div>
                {test[s.id] && <div className={'sub ' + (test[s.id].startsWith(t('Ошибка')) ? 'err' : 'tl-ok')}>{test[s.id]}</div>}
              </div>
              <button className="icon-btn" title={t('Проверить')} onClick={() => runTest(s.id)}><Play size={16} /></button>
              <button className="icon-btn" title={t('Изменить')} onClick={() => setEdit(s.id)}><Pencil size={16} /></button>
              <button className="icon-btn" title={t('Удалить')} onClick={() => { if (confirm(t('Удалить MCP-сервер «{name}»?', { name: s.name }))) void rpc('deleteMcp', { id: s.id }) }}><Trash2 size={16} /></button>
            </div>
            <div className="set-row tl-allbots"><div><b>{t('Всем ботам')}</b><div className="sub">{t('Иначе включается каждому боту отдельно, в его настройках')}</div></div><Toggle on={s.allBots} onChange={(v) => void rpc('saveMcp', { id: s.id, allBots: v })} /></div>
          </div>
        )
      ))}
      {tools.mcp.length === 0 && <div className="sub" style={{ marginBottom: 8 }}>{t('Пока нет ни одного сервера.')}</div>}
      {edit === 'new' ? <McpForm onDone={() => setEdit(null)} /> : <button className="btn wide-btn" onClick={() => setEdit('new')}><Plus size={16} /> {t('Добавить MCP-сервер')}</button>}

      <h3>{t('Импорт из других агентов')}</h3>
      <div className="sub">{t('Настройки MCP из Claude Desktop и Claude Code, Cursor, Windsurf, VS Code, Cline, Gemini CLI, Codex CLI и .mcp.json проекта.')}</div>
      <div className="gen-row"><button className="btn" disabled={busy} onClick={scan}><Search size={15} /> {t('Найти на этом компьютере')}</button></div>
      {found && (
        <div className="conn-form">
          {found.length === 0 && <div className="sub">{t('Ничего не найдено.')}</div>}
          {found.map((f) => (
            <div key={f.file} className="tl-src">
              <div className="sub"><b>{t(f.source)}</b> · {f.file}</div>
              {f.servers.map((s) => (
                <label className="check" key={s.name}>
                  <input type="checkbox" checked={!!pick[f.file + '||' + s.name]} onChange={(e) => setPick({ ...pick, [f.file + '||' + s.name]: e.target.checked })} />
                  <span><b>{s.name}</b> <span className="tl-tag">{s.type}</span><span className="sub"> {s.summary}{s.secrets ? ' · ' + t('ключей: {n}', { n: s.secrets }) : ''}</span></span>
                </label>
              ))}
            </div>
          ))}
          {found.length > 0 && <div className="modal-foot"><button className="btn ghost" onClick={() => setFound(null)}>{t('Отмена')}</button><button className="btn primary" disabled={busy} onClick={importFound}><Download size={15} /> {t('Импортировать выбранное')}</button></div>}
          {found.length > 0 && <div className="sub">{t('Значения ключей копируются на этот сервер и в интерфейс не попадают.')}</div>}
        </div>
      )}
      <label>{t('Или вставьте конфигурацию')}</label>
      <textarea rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'{ "mcpServers": { "name": { "command": "npx", "args": ["-y", "pkg"] } } }'} />
      <div className="gen-row"><button className="btn" disabled={busy || !paste.trim()} onClick={importPaste}>{t('Импортировать')}</button><span className="sub">{t('Понимает JSON из этих программ и TOML от Codex')}</span></div>
    </>
  )
}

/* ---------- Навыки ---------- */

type SkillFound = { kind: 'skill' | 'rules'; source: string; name: string; description: string; path: string }

function SkillForm({ name: initial, onDone }: { name?: string; onDone: () => void }) {
  const { rpc } = useStore()
  const [name, setName] = useState(initial ?? '')
  const [description, setDescription] = useState('')
  const [body, setBody] = useState('')
  const [loaded, setLoaded] = useState(!initial)
  const [ask, setAsk] = useState('')
  const [gen, setGen] = useState<'' | 'busy'>('')
  const [busy, setBusy] = useState(false)
  if (!loaded) {
    void rpc<{ description: string; body: string }>('getSkill', { name: initial }).then((r) => { if (r) { setDescription(r.description); setBody(r.body) } setLoaded(true) })
    return <div className="conn-form sub">…</div>
  }
  const save = async () => { setBusy(true); const r = await rpc('saveSkill', { name, description, body }); setBusy(false); if (r) onDone() }
  // Haiku придумывает название, описание и инструкцию по запросу; результат можно править перед сохранением
  const generate = async () => {
    setGen('busy')
    const r = await rpc<{ name: string; description: string; body: string }>('generateSkill', { request: ask })
    setGen('')
    if (r) { if (!initial) setName(r.name); setDescription(r.description); setBody(r.body) }
  }
  return (
    <div className="conn-form">
      <label>{t('Что должен уметь навык')} <span className="sub">{t('Haiku составит название, описание и инструкцию, их можно править')}</span></label>
      <textarea rows={2} value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={t('Например: проверять pull request на безопасность и писать короткий отчёт')} />
      <div className="gen-row"><button className="btn" disabled={gen === 'busy' || !ask.trim()} onClick={generate}><Sparkles size={15} /> {gen === 'busy' ? t('Придумываю…') : t('Придумать с помощью Haiku')}</button></div>
      <label>{t('Название')}</label>
      <input value={name} disabled={!!initial} onChange={(e) => setName(e.target.value)} placeholder="code-review" />
      <label>{t('Когда использовать (одно-два предложения)')}</label>
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('Проверяет изменения в git. Использовать, когда просят посмотреть код.')} />
      <label>{t('Инструкция')}</label>
      <textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('Пошаговая инструкция в Markdown: что делать, в каком порядке, как отчитаться')} />
      <div className="modal-foot">
        <button className="btn ghost" onClick={onDone}>{t('Отмена')}</button>
        <button className="btn primary" disabled={busy || !name.trim() || !body.trim()} onClick={save}>{t('Сохранить')}</button>
      </div>
    </div>
  )
}

function SkillsTab() {
  const { tools, rpc } = useStore()
  const [edit, setEdit] = useState<string | null>(null)
  const [found, setFound] = useState<SkillFound[] | null>(null)
  const [pick, setPick] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const scan = async () => {
    setBusy(true)
    const r = await rpc<{ found: SkillFound[] }>('scanSkills')
    setBusy(false)
    if (r) { setFound(r.found); setPick({}) }
  }
  const importPicked = async () => {
    setBusy(true)
    const r = await rpc<{ added: number }>('importSkills', { items: (found ?? []).filter((f) => pick[f.path]).map((f) => ({ path: f.path })) })
    setBusy(false)
    if (r) { useStore.getState().say(t('Добавлено навыков: {n}', { n: r.added })); setFound(null) }
  }
  return (
    <>
      <p className="sub tl-intro">{t('Навык это инструкция, которую бот читает, когда задача подходит: как проверять код, писать отчёт, искать информацию. Включается каждому боту в его настройках.')}</p>
      {tools.skills.map((s) => (
        edit === s.name ? <SkillForm key={s.name} name={s.name} onDone={() => setEdit(null)} /> : (
          <div className="conn-card tl-skill" key={s.name}>
            <FileText size={18} />
            <div className="grow">
              <b>{s.name}</b> {s.builtin && <span className="tl-tag">{t('готовый')}</span>}
              <div className="sub">{s.description}</div>
            </div>
            <button className="btn small" title={t('Включить всем ботам')} onClick={() => void rpc('setBotTools', { id: '*', skills: [s.name], add: true })}>{t('Всем')}</button>
            <button className="icon-btn" title={t('Изменить')} onClick={() => setEdit(s.name)}><Pencil size={16} /></button>
            <button className="icon-btn" title={t('Удалить')} onClick={() => { if (confirm(t('Удалить навык «{name}»?', { name: s.name }))) void rpc('deleteSkill', { name: s.name }) }}><Trash2 size={16} /></button>
          </div>
        )
      ))}
      {edit === 'new' ? <SkillForm onDone={() => setEdit(null)} /> : <button className="btn wide-btn" onClick={() => setEdit('new')}><Plus size={16} /> {t('Новый навык')}</button>}

      <h3>{t('Импорт из других агентов')}</h3>
      <div className="sub">{t('Навыки Claude Code (в том числе из плагинов), а также правила проекта: AGENTS.md, CLAUDE.md, GEMINI.md, Cursor, Windsurf, Copilot.')}</div>
      <div className="gen-row"><button className="btn" disabled={busy} onClick={scan}><Search size={15} /> {t('Найти на этом компьютере')}</button></div>
      {found && (
        <div className="conn-form">
          {found.length === 0 && <div className="sub">{t('Ничего не найдено.')}</div>}
          <div className="tl-list">
            {found.map((f) => (
              <label className="check" key={f.path}>
                <input type="checkbox" checked={!!pick[f.path]} onChange={(e) => setPick({ ...pick, [f.path]: e.target.checked })} />
                <span><b>{f.name}</b> <span className="tl-tag">{f.kind === 'skill' ? t('навык') : t('правила')}</span> <span className="sub">{t(f.source)}</span><span className="sub tl-desc">{f.description}</span></span>
              </label>
            ))}
          </div>
          {found.length > 0 && <div className="modal-foot"><button className="btn ghost" onClick={() => setFound(null)}>{t('Отмена')}</button><button className="btn primary" disabled={busy || !Object.values(pick).some(Boolean)} onClick={importPicked}><Download size={15} /> {t('Импортировать выбранное')}</button></div>}
        </div>
      )}
    </>
  )
}

/* ---------- Переписки ---------- */

type Preview = { key: string; format: string; conversations: { id: string; title: string; count: number; first: string }[] }
type Recent = { path: string; mtime: number; size: number; title: string }

function ChatsTab() {
  const { rpc, session, bots } = useStore()
  const [path, setPath] = useState('')
  const [text, setText] = useState('')
  const [prev, setPrev] = useState<Preview | null>(null)
  const [pick, setPick] = useState<Record<string, boolean>>({})
  const [bot, setBot] = useState('')
  const [recent, setRecent] = useState<Recent[] | null>(null)
  const [busy, setBusy] = useState(false)

  const look = async (args: { path?: string; text?: string }) => {
    setBusy(true)
    const r = await rpc<Preview>('previewChats', args)
    setBusy(false)
    if (r) { setPrev(r); setPick(Object.fromEntries(r.conversations.slice(0, 1).map((c) => [c.id, true]))) }
  }
  const doImport = async () => {
    if (!prev) return
    setBusy(true)
    const r = await rpc('importChat', { key: prev.key, ids: Object.keys(pick).filter((k) => pick[k]), botId: bot || undefined })
    setBusy(false)
    if (r) { setPrev(null); setPath(''); setText('') }
  }
  const loadRecent = async () => { const r = await rpc<{ found: Recent[] }>('scanChats'); if (r) setRecent(r.found) }

  return (
    <>
      <p className="sub tl-intro">{t('Перенесите переписку из другого ИИ: она появится группой, и бота можно продолжить расспрашивать с этого места. Поддерживаются экспорт ChatGPT и Claude.ai (zip или conversations.json), журналы Claude Code (.jsonl), JSON и текст «User: … Assistant: …».')}</p>
      {!session && <div className="sub err">{t('Откройте папку или сессию: чат импортируется в неё.')}</div>}
      {!prev ? (
        <>
          <label>{t('Путь к файлу')}</label>
          <div className="gen-row">
            <input value={path} onChange={(e) => setPath(e.target.value)} placeholder={t('Например D:\\Downloads\\chatgpt-export.zip')} onKeyDown={(e) => e.key === 'Enter' && path.trim() && look({ path })} />
            <button className="btn" disabled={busy || !path.trim()} onClick={() => look({ path })}>{t('Просмотреть')}</button>
          </div>
          <label>{t('Или вставьте текст переписки')}</label>
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={'User: ...\nAssistant: ...'} />
          <div className="gen-row"><button className="btn" disabled={busy || !text.trim()} onClick={() => look({ text })}>{t('Просмотреть')}</button></div>
          <h3>{t('Недавние сессии Claude Code')}</h3>
          {recent === null ? <button className="btn" onClick={loadRecent}><Search size={15} /> {t('Показать')}</button> : (
            <div className="tl-list">
              {recent.length === 0 && <div className="sub">{t('Ничего не найдено.')}</div>}
              {recent.map((r) => (
                <button className="tl-recent" key={r.path} onClick={() => look({ path: r.path })}>
                  <b>{r.title}</b><span className="sub">{new Date(r.mtime).toLocaleString()} · {Math.round(r.size / 1024)} KB</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="conn-form">
          <div className="sub"><b>{prev.format}</b> · {t('разговоров: {n}', { n: prev.conversations.length })}</div>
          <div className="tl-list">
            {prev.conversations.map((c) => (
              <label className="check" key={c.id}>
                <input type="checkbox" checked={!!pick[c.id]} onChange={(e) => setPick({ ...pick, [c.id]: e.target.checked })} />
                <span><b>{c.title}</b> <span className="sub">{t('сообщений: {n}', { n: c.count })}</span><span className="sub tl-desc">{c.first}</span></span>
              </label>
            ))}
          </div>
          <label>{t('С каким ботом продолжать')}</label>
          <select value={bot} onChange={(e) => setBot(e.target.value)}>
            <option value="">{t('Любой (первый не главный)')}</option>
            {bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div className="modal-foot">
            <button className="btn ghost" onClick={() => setPrev(null)}>{t('Назад')}</button>
            <button className="btn primary" disabled={busy || !session || !Object.values(pick).some(Boolean)} onClick={doImport}><Download size={15} /> {t('Импортировать')}</button>
          </div>
        </div>
      )}
    </>
  )
}

export default function Tools() {
  const { setModal } = useStore()
  const [tab, setTab] = useState<Tab>('mcp')
  return (
    <Modal title={t('Инструменты и навыки')} onClose={() => setModal(null)} wide>
      <div className="tabs">
        {([['mcp', t('MCP-серверы')], ['skills', t('Навыки')], ['chats', t('Импорт переписок')]] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? 'sel' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'mcp' && <McpTab />}
      {tab === 'skills' && <SkillsTab />}
      {tab === 'chats' && <ChatsTab />}
    </Modal>
  )
}
