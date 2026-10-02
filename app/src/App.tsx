import { useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import SidePanel from './components/SidePanel'
import Modals, { Lightbox } from './components/Modals'
import Launcher from './components/Launcher'
import { Toast } from './components/ui'
import { useStore } from './store'
import { connect } from './live'
import { t } from './i18n'

function Offline() {
  return (
    <div className="offline">
      <div className="offline-card">
        <div className="dots big"><u /><u /><u /></div>
        <h1>{t('Сервер Clawds не запущен')}</h1>
        <p>{t('Запустите')} <code>start.cmd</code> {t('в папке')} <code>D:\Clawds</code> {t('или в двух терминалах:')}</p>
        <pre>{'cd D:\\Clawds\\server\nnpm start'}</pre>
        <p className="sub">{t('Страница подключится сама, как только сервер ответит.')}</p>
      </div>
    </div>
  )
}

export default function App() {
  const { mobileChat, ready, session, apply, setLive, lang } = useStore()
  useEffect(() => connect({ onEvent: apply, onStatus: setLive }), [apply, setLive])
  if (!ready) return <div key={lang}><Offline /><Toast /></div>
  if (!session) return <div key={lang}><Launcher /><Toast /></div>
  return (
    <div key={lang} className={'app' + (mobileChat ? ' m-chat' : '')}>
      <Sidebar />
      <ChatView />
      <SidePanel />
      <Modals />
      <Lightbox />
      <Toast />
    </div>
  )
}
