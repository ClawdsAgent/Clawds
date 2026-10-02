import { useState } from 'react'
import { LogIn, Plus, RefreshCw, Trash2, Pencil, Search, X } from 'lucide-react'
import '../conn.css'
import { useStore } from '../store'
import type { Provider } from '../types'
import { Modal, Toggle } from './ui'

const PRESETS = [
  { label: 'OpenRouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api', auth: 'bearer', lite: false },
  { label: 'LM Studio', name: 'LM Studio', baseUrl: 'http://localhost:1234', auth: 'bearer', lite: true },
  { label: 'Ollama', name: 'Ollama', baseUrl: 'http://localhost:11434', auth: 'bearer', lite: true },
  { label: 'Другой', name: '', baseUrl: '', auth: 'bearer', lite: false },
]

// Вход в Claude одним нажатием: баннер для запуска и настроек
export function LoginBar() {
  const { conn, claudeLogin } = useStore()
  if (conn.loggedIn) return null
  return (
    <div className="login-bar">
      <div>
        <b>Вход в Claude не выполнен</b>
        <div className="sub">{conn.pending ? 'Открылось окно входа, завершите вход в браузере. Страница обновится сама.' : 'Боты на подписке не запустятся. Войдите или подключите свой эндпоинт.'}</div>
      </div>
      <button className="btn primary" disabled={conn.pending} onClick={claudeLogin}><LogIn size={15} /> {conn.pending ? 'Жду входа…' : 'Войти в Claude'}</button>
    </div>
  )
}

function Form({ initial, onDone }: { initial?: Provider; onDone: () => void }) {
  const { saveProvider } = useStore()
  const [name, setName] = useState(initial?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? '')
  const [apiKey, setApiKey] = useState('')
  const [auth, setAuth] = useState<string>(initial?.auth ?? 'bearer')
  const [lite, setLite] = useState(initial?.liteDefault ?? false)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const r = await saveProvider({ id: initial?.id, name, baseUrl, apiKey, auth, liteDefault: lite })
    setBusy(false)
    if (r) onDone()
  }

  return (
    <div className="conn-form">
      {!initial && (
        <div className="chips">
          {PRESETS.map((p) => (
            <button key={p.label} className="chip" onClick={() => { setName(p.name); setBaseUrl(p.baseUrl); setAuth(p.auth); setLite(p.lite) }}>{p.label}</button>
          ))}
        </div>
      )}
      <label>Название</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="например, OpenRouter" />
      <label>Адрес (Anthropic-совместимый)</label>
      <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api" />
      <label>API-ключ {initial?.hasKey && <span className="sub">сейчас …{initial.keyTail}, пустое поле оставит прежний</span>}</label>
      <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={initial?.hasKey ? '••••••••' : 'для локальных моделей можно пусто'} autoComplete="off" />
      <div className="two-col">
        <div>
          <label>Как передавать ключ</label>
          <select value={auth} onChange={(e) => setAuth(e.target.value)}>
            <option value="bearer">Authorization: Bearer (OpenRouter, LiteLLM)</option>
            <option value="x-api-key">x-api-key (как у Anthropic)</option>
          </select>
        </div>
        <div className="lite-new">
          <div><b>Упрощённо для новых моделей</b><div className="sub">Короткие правила и меньше инструментов. Для каждой модели меняется отдельно.</div></div>
          <Toggle on={lite} onChange={setLite} />
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn ghost" onClick={onDone}>Отмена</button>
        <button className="btn primary" disabled={busy || !baseUrl.trim()} onClick={save}>{busy ? 'Проверяю и загружаю модели…' : 'Сохранить'}</button>
      </div>
    </div>
  )
}

const CAP = 100

function Models({ p }: { p: Provider }) {
  const { setModelLite, addModel, removeModel } = useStore()
  const [q, setQ] = useState('')
  const [manual, setManual] = useState('')
  const ql = q.trim().toLowerCase()
  const list = p.models.filter((m) => !ql || m.id.toLowerCase().includes(ql) || m.name.toLowerCase().includes(ql))
  const liteCount = p.models.filter((m) => m.lite).length
  return (
    <div className="conn-models">
      <div className="mp-search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Поиск среди ${p.models.length} моделей`} /></div>
      <div className="conn-bulk">
        <span className="sub">Упрощённый режим: {liteCount} из {p.models.length}</span>
        <button className="btn small" onClick={() => setModelLite(p.id, undefined, true)}>Всем</button>
        <button className="btn small" onClick={() => setModelLite(p.id, undefined, false)}>Никому</button>
      </div>
      <div className="conn-mlist">
        {list.slice(0, CAP).map((m) => (
          <div className="conn-mrow" key={m.id}>
            <div className="grow"><b>{m.name}</b>{m.name !== m.id && <div className="sub">{m.id}</div>}</div>
            <label className="lite-check" title="Упрощённый режим только для этой модели"><input type="checkbox" checked={m.lite} onChange={(e) => setModelLite(p.id, m.id, e.target.checked)} /> упрощённо</label>
            {m.manual && <button className="icon-btn" title="Убрать" onClick={() => removeModel(p.id, m.id)}><X size={14} /></button>}
          </div>
        ))}
        {list.length > CAP && <div className="sub" style={{ padding: 8 }}>Показаны первые {CAP} из {list.length}. Уточните поиск.</div>}
        {list.length === 0 && <div className="sub" style={{ padding: 8 }}>Ничего не найдено</div>}
      </div>
      <div className="gen-row">
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Добавить модель вручную по ID" onKeyDown={(e) => { if (e.key === 'Enter' && manual.trim()) { addModel(p.id, manual.trim()); setManual('') } }} />
        <button className="btn" disabled={!manual.trim()} onClick={() => { addModel(p.id, manual.trim()); setManual('') }}>Добавить</button>
      </div>
    </div>
  )
}

export default function Connections() {
  const { conn, setModal, claudeLogin, refreshModels, deleteProvider } = useStore()
  const [edit, setEdit] = useState<'new' | string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <Modal title="Подключения" onClose={() => setModal(null)} wide>
      <h3>Подписка Claude</h3>
      <div className="conn-card">
        <div className="grow">
          <b>{conn.loggedIn ? 'Вход выполнен' : 'Вход не выполнен'}</b>
          <div className="sub">{conn.loggedIn ? 'Боты с моделями Claude работают по подписке. Данные входа хранятся только в папке server\\claude-config.' : conn.pending ? 'Завершите вход в открывшемся окне.' : 'Нажмите, откроется окно входа в Claude.'}</div>
        </div>
        <button className="btn primary" disabled={conn.pending} onClick={claudeLogin}><LogIn size={15} /> {conn.loggedIn ? 'Войти заново' : conn.pending ? 'Жду входа…' : 'Войти в Claude'}</button>
      </div>

      <h3>Свои эндпоинты и модели</h3>
      <div className="sub" style={{ marginBottom: 8 }}>Любой Anthropic-совместимый адрес: OpenRouter, LiteLLM, LM Studio, Ollama. Список моделей загружается сам, в выборе модели у бота по ним есть поиск.</div>
      {conn.providers.map((p) => (
        edit === p.id ? <Form key={p.id} initial={p} onDone={() => setEdit(null)} /> : (
          <div className="conn-block" key={p.id}>
            <div className="conn-card">
              <div className="grow">
                <b>{p.name}</b>
                <div className="sub rs-path">{p.baseUrl} · {p.hasKey ? 'ключ …' + p.keyTail : 'без ключа'} · моделей: {p.models.length}</div>
                {p.error && <div className="err">{p.error}</div>}
              </div>
              <button className="icon-btn" title="Обновить список моделей" onClick={() => refreshModels(p.id)}><RefreshCw size={16} /></button>
              <button className="icon-btn" title="Изменить" onClick={() => setEdit(p.id)}><Pencil size={16} /></button>
              <button className="icon-btn" title="Удалить" onClick={() => { if (confirm('Удалить эндпоинт «' + p.name + '»? Боты на его моделях перестанут запускаться.')) deleteProvider(p.id) }}><Trash2 size={16} /></button>
            </div>
            <button className="btn small" onClick={() => setOpenId(openId === p.id ? null : p.id)}>{openId === p.id ? 'Скрыть модели' : 'Модели и упрощённый режим'}</button>
            {openId === p.id && <Models p={p} />}
          </div>
        )
      ))}
      {edit === 'new' ? <Form onDone={() => setEdit(null)} /> : <button className="btn wide-btn" onClick={() => setEdit('new')}><Plus size={16} /> Добавить эндпоинт</button>}
    </Modal>
  )
}
