import { useState } from 'react'
import { LogIn, Plus, RefreshCw, Trash2, Pencil, Search, X } from 'lucide-react'
import '../conn.css'
import { useStore } from '../store'
import type { Provider } from '../types'
import { Modal, Toggle } from './ui'
import { t } from '../i18n'

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
        <b>{t('Вход в Claude не выполнен')}</b>
        <div className="sub">{conn.pending ? t('Открылось окно входа, завершите вход в браузере. Страница обновится сама.') : t('Боты на подписке не запустятся. Войдите или подключите свой эндпоинт.')}</div>
      </div>
      <button className="btn primary" disabled={conn.pending} onClick={claudeLogin}><LogIn size={15} /> {conn.pending ? t('Жду входа…') : t('Войти в Claude')}</button>
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
            <button key={p.label} className="chip" onClick={() => { setName(p.name); setBaseUrl(p.baseUrl); setAuth(p.auth); setLite(p.lite) }}>{t(p.label)}</button>
          ))}
        </div>
      )}
      <label>{t('Название')}</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('например, OpenRouter')} />
      <label>{t('Адрес (Anthropic-совместимый)')}</label>
      <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api" />
      <label>{t('API-ключ')} {initial?.hasKey && <span className="sub">{t('сейчас …{tail}, пустое поле оставит прежний', { tail: initial.keyTail })}</span>}</label>
      <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={initial?.hasKey ? '••••••••' : t('для локальных моделей можно пусто')} autoComplete="off" />
      <div className="two-col">
        <div>
          <label>{t('Как передавать ключ')}</label>
          <select value={auth} onChange={(e) => setAuth(e.target.value)}>
            <option value="bearer">Authorization: Bearer (OpenRouter, LiteLLM)</option>
            <option value="x-api-key">{t('x-api-key (как у Anthropic)')}</option>
          </select>
        </div>
        <div className="lite-new">
          <div><b>{t('Упрощённо для новых моделей')}</b><div className="sub">{t('Короткие правила и меньше инструментов. Для каждой модели меняется отдельно.')}</div></div>
          <Toggle on={lite} onChange={setLite} />
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn ghost" onClick={onDone}>{t('Отмена')}</button>
        <button className="btn primary" disabled={busy || !baseUrl.trim()} onClick={save}>{busy ? t('Проверяю и загружаю модели…') : t('Сохранить')}</button>
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
      <div className="mp-search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Поиск среди {n} моделей', { n: p.models.length })} /></div>
      <div className="conn-bulk">
        <span className="sub">{t('Упрощённый режим: {a} из {b}', { a: liteCount, b: p.models.length })}</span>
        <button className="btn small" onClick={() => setModelLite(p.id, undefined, true)}>{t('Всем')}</button>
        <button className="btn small" onClick={() => setModelLite(p.id, undefined, false)}>{t('Никому')}</button>
      </div>
      <div className="conn-mlist">
        {list.slice(0, CAP).map((m) => (
          <div className="conn-mrow" key={m.id}>
            <div className="grow"><b>{m.name}</b>{m.name !== m.id && <div className="sub">{m.id}</div>}</div>
            <label className="lite-check" title={t('Упрощённый режим только для этой модели')}><input type="checkbox" checked={m.lite} onChange={(e) => setModelLite(p.id, m.id, e.target.checked)} /> {t('упрощённо')}</label>
            {m.manual && <button className="icon-btn" title={t('Убрать')} onClick={() => removeModel(p.id, m.id)}><X size={14} /></button>}
          </div>
        ))}
        {list.length > CAP && <div className="sub" style={{ padding: 8 }}>{t('Показаны первые {a} из {b}. Уточните поиск.', { a: CAP, b: list.length })}</div>}
        {list.length === 0 && <div className="sub" style={{ padding: 8 }}>{t('Ничего не найдено')}</div>}
      </div>
      <div className="gen-row">
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder={t('Добавить модель вручную по ID')} onKeyDown={(e) => { if (e.key === 'Enter' && manual.trim()) { addModel(p.id, manual.trim()); setManual('') } }} />
        <button className="btn" disabled={!manual.trim()} onClick={() => { addModel(p.id, manual.trim()); setManual('') }}>{t('Добавить')}</button>
      </div>
    </div>
  )
}

export default function Connections() {
  const { conn, setModal, claudeLogin, refreshModels, deleteProvider } = useStore()
  const [edit, setEdit] = useState<'new' | string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <Modal title={t('Подключения')} onClose={() => setModal(null)} wide>
      <h3>{t('Подписка Claude')}</h3>
      <div className="conn-card">
        <div className="grow">
          <b>{conn.loggedIn ? t('Вход выполнен') : t('Вход не выполнен')}</b>
          <div className="sub">{conn.loggedIn ? t('Боты с моделями Claude работают по подписке. Данные входа хранятся только в папке server\\claude-config.') : conn.pending ? t('Завершите вход в открывшемся окне.') : t('Нажмите, откроется окно входа в Claude.')}</div>
        </div>
        <button className="btn primary" disabled={conn.pending} onClick={claudeLogin}><LogIn size={15} /> {conn.loggedIn ? t('Войти заново') : conn.pending ? t('Жду входа…') : t('Войти в Claude')}</button>
      </div>

      <h3>{t('Свои эндпоинты и модели')}</h3>
      <div className="sub" style={{ marginBottom: 8 }}>{t('Любой Anthropic-совместимый адрес: OpenRouter, LiteLLM, LM Studio, Ollama. Список моделей загружается сам, в выборе модели у бота по ним есть поиск.')}</div>
      {conn.providers.map((p) => (
        edit === p.id ? <Form key={p.id} initial={p} onDone={() => setEdit(null)} /> : (
          <div className="conn-block" key={p.id}>
            <div className="conn-card">
              <div className="grow">
                <b>{p.name}</b>
                <div className="sub rs-path">{p.baseUrl} · {p.hasKey ? t('ключ …{tail}', { tail: p.keyTail }) : t('без ключа')} · {t('моделей:')} {p.models.length}</div>
                {p.error && <div className="err">{p.error}</div>}
              </div>
              <button className="icon-btn" title={t('Обновить список моделей')} onClick={() => refreshModels(p.id)}><RefreshCw size={16} /></button>
              <button className="icon-btn" title={t('Изменить')} onClick={() => setEdit(p.id)}><Pencil size={16} /></button>
              <button className="icon-btn" title={t('Удалить')} onClick={() => { if (confirm(t('Удалить эндпоинт «{name}»? Боты на его моделях перестанут запускаться.', { name: p.name }))) deleteProvider(p.id) }}><Trash2 size={16} /></button>
            </div>
            <button className="btn small" onClick={() => setOpenId(openId === p.id ? null : p.id)}>{openId === p.id ? t('Скрыть модели') : t('Модели и упрощённый режим')}</button>
            {openId === p.id && <Models p={p} />}
          </div>
        )
      ))}
      {edit === 'new' ? <Form onDone={() => setEdit(null)} /> : <button className="btn wide-btn" onClick={() => setEdit('new')}><Plus size={16} /> {t('Добавить эндпоинт')}</button>}
    </Modal>
  )
}
