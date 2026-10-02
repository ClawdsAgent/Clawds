import { useState, useRef } from 'react'
import { SendHorizonal, Paperclip, X, FileText } from 'lucide-react'
import { useStore } from '../store'
import type { Attachment } from '../types'
import { Avatar, fmtSize } from './ui'
import { call } from '../live'
import { t } from '../i18n'

export default function Composer({ channelId, threadOf, placeholder }: { channelId: string; threadOf?: string; placeholder?: string }) {
  const { send, bots, channels, accounts, unblock } = useStore()
  const [text, setText] = useState('')
  const [sel, setSel] = useState(0)
  const [files, setFiles] = useState<(Attachment & { uploading?: boolean })[]>([])
  const [drag, setDrag] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const pick_ = useRef<HTMLInputElement>(null)
  const ch = channels.find((c) => c.id === channelId)
  const peer = ch?.kind === 'dm' ? ch.members.find((m) => m !== 'me') : undefined
  const blocked = !!peer && accounts.me.blocked.includes(peer)

  const m = text.match(/@(\w*)$/)
  const sl = text.match(/(^|\s)\/(\w*)$/)
  const options = m
    ? [{ id: 'all', name: 'all' }, ...bots.filter((b) => ch?.members.includes(b.id))].filter((b) => b.name.startsWith(m[1]))
    : sl && ch?.kind === 'channel' && 'all'.startsWith(sl[2]) ? [{ id: '/all', name: '/all' }] : []

  const addFiles = (list: FileList | File[]) => {
    for (const f of [...list]) {
      const id = Math.random().toString(36).slice(2)
      const local = { id, name: f.name || t('вставленное.png'), size: f.size, mime: f.type || 'application/octet-stream', url: URL.createObjectURL(f), uploading: true }
      setFiles((cur) => [...cur, local])
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const data = String(reader.result).split(',')[1] ?? ''
          const up = await call<Attachment>('upload', { name: local.name, mime: local.mime, data })
          setFiles((cur) => cur.map((x) => (x.id === id ? { ...up, id, url: local.url, uploading: false, serverUrl: up.url } as any : x)))
        } catch (e) {
          setFiles((cur) => cur.filter((x) => x.id !== id))
          useStore.getState().say((e as Error).message)
        }
      }
      reader.readAsDataURL(f)
    }
  }
  const pick = (name: string) => {
    setText(name === '/all' ? text.replace(/\/(\w*)$/, '/all ') : text.replace(/@(\w*)$/, `@${name} `))
    setSel(0)
    ref.current?.focus()
  }
  const submit = () => {
    if ((!text.trim() && !files.length) || files.some((f) => f.uploading)) return
    send(channelId, text, threadOf, files.length ? files.map(({ uploading, serverUrl, ...a }: any) => ({ ...a, url: serverUrl ?? a.url })) : undefined)
    setText(''); setFiles([])
  }

  if (blocked) {
    return (
      <div className="composer blocked">
        <span>{t('Вы заблокировали этого бота')}</span>
        <button className="btn" onClick={() => unblock(peer!)}>{t('Разблокировать')}</button>
      </div>
    )
  }

  const ready = (!!text.trim() || files.length > 0) && !files.some((f) => f.uploading)
  return (
    <div
      className={'composer-wrap' + (drag ? ' drag' : '')}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files) }}
    >
      {files.length > 0 && (
        <div className="previews">
          {files.map((f) => (
            <div className="prev" key={f.id}>
              {f.mime.startsWith('image/') ? <img src={f.url} alt="" /> : <div className="prev-file"><FileText size={22} /><span>{f.name}</span><em>{fmtSize(f.size)}</em></div>}
              {f.uploading && <div className="up-spin"><span className="spin">◌</span></div>}
              <button className="prev-x" onClick={() => setFiles(files.filter((x) => x.id !== f.id))}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="composer">
        {options.length > 0 && (
          <div className="mention-list">
            {options.map((o, i) => (
              <button key={o.id} className={i === sel ? 'sel' : ''} onMouseDown={(e) => { e.preventDefault(); pick(o.name) }}>
                <Avatar id={o.id} size={22} /> {o.name.startsWith("/") ? o.name + ' · ' + t('важное для всех') : "@" + o.name}
              </button>
            ))}
          </div>
        )}
        <input ref={pick_} type="file" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
        <button className="icon-btn attach" title={t('Прикрепить')} onClick={() => pick_.current?.click()}><Paperclip size={19} /></button>
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder={drag ? t('Отпустите, чтобы прикрепить') : placeholder ?? t('Сообщение… @ чтобы упомянуть бота')}
          onChange={(e) => { setText(e.target.value); setSel(0) }}
          onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files) } }}
          onKeyDown={(e) => {
            if (options.length) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((sel + 1) % options.length); return }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((sel - 1 + options.length) % options.length); return }
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(options[sel].name); return }
            }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
          }}
        />
        <button className={'send' + (ready ? ' ready' : '')} disabled={!ready} onClick={submit}><SendHorizonal size={18} /></button>
      </div>
    </div>
  )
}
