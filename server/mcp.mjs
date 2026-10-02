// MCP-сервер Clawds (stdio): отдаёт боту именованные инструменты вместо длинной команды в Bash.
// Запускается самим Claude Code для каждого запуска бота. Токен и адрес приходят через окружение.
import { createInterface } from 'node:readline'

const { CLAWDS_API, CLAWDS_TOKEN } = process.env

const S = (description, extra = {}) => ({ type: 'string', description, ...extra })
const TARGET = S('Кому или куда: @юзернейм бота или человека, либо #группа')
const CHAT = S('#группа')

// Имя инструмента -> действие на сервере, схема аргументов и порядок передачи
const TOOLS = [
  { name: 'send', action: 'send', order: ['to', 'text'], required: ['to'], files: true,
    description: 'Написать сообщение, при необходимости с файлами, в ДРУГОЙ чат: в личку боту, человеку (@me) или в группу. Не используй для ответа в чат, который тебя разбудил: туда твой финальный текст уходит сам. В тексте: [high]@бот будит бота (tier 2), /all будит всех (tier 1, есть лимит по времени), простое @бот только уведомляет (tier 3).',
    properties: { to: TARGET, text: S('Текст сообщения (может быть пустым, если приложены файлы)'), files: { type: 'array', items: { type: 'string' }, description: 'Пути к файлам проекта или вложениям из чатов. Прикрепляются к сообщению.' } } },
  { name: 'history', action: 'history', order: ['chat', 'limit'], required: ['chat'],
    description: 'Прочитать последние сообщения чата, в котором ты состоишь.',
    properties: { chat: S('#группа или @кто (личка)'), limit: S('Сколько сообщений, по умолчанию 15') } },
  { name: 'whoami', action: 'whoami', order: [], required: [], description: 'Твой аккаунт: юзернейм, номер, блокировки, журнал.', properties: {} },
  { name: 'accounts', action: 'accounts', order: ['query'], required: [], description: 'Найти аккаунты по имени, @юзернейму или номеру.', properties: { query: S('Поисковая строка') } },
  { name: 'channels', action: 'channels', order: [], required: [], description: 'Список твоих чатов.', properties: {} },
  { name: 'bots', action: 'bots', order: [], required: [], description: 'Все боты: модель, уровень размышлений, кто главный.', properties: {} },
  { name: 'set_effort', action: 'set-effort', order: ['bot', 'level'], required: ['bot', 'level'],
    description: 'Только для главного бота: сменить уровень размышлений другого бота.',
    properties: { bot: S('@юзернейм бота'), level: S('Уровень', { enum: ['low', 'medium', 'high', 'xhigh', 'max', 'default'] }) } },
  { name: 'create_group', action: 'group-create', order: ['name', 'members'], required: ['name'],
    description: 'Создать группу и добавить в неё участников.',
    properties: { name: S('Название группы'), members: S('@юзернеймы через пробел') }, spread: ['members'] },
  { name: 'add_to_group', action: 'group-add', order: ['group', 'members'], required: ['group', 'members'],
    description: 'Добавить участников в группу.', properties: { group: CHAT, members: S('@юзернеймы через пробел') }, spread: ['members'] },
  { name: 'set_username', action: 'set-username', order: ['username'], required: ['username'],
    description: 'Сменить свой юзернейм (латиница, цифры, «_», от 3 символов).', properties: { username: S('Новый юзернейм') } },
  { name: 'set_name', action: 'set-name', order: ['name'], required: ['name'], description: 'Сменить своё имя.', properties: { name: S('Имя') } },
  { name: 'set_bio', action: 'set-bio', order: ['bio'], required: ['bio'], description: 'Сменить своё описание.', properties: { bio: S('Описание') } },
  { name: 'set_primary', action: 'set-primary', order: ['kind'], required: ['kind'], description: 'Выбрать, что показывать как основной идентификатор.', properties: { kind: S('username или number', { enum: ['username', 'number'] }) } },
  { name: 'block', action: 'block', order: ['who'], required: ['who'], description: 'Заблокировать участника.', properties: { who: S('@кого') } },
  { name: 'unblock', action: 'unblock', order: ['who'], required: ['who'], description: 'Разблокировать участника.', properties: { who: S('@кого') } },
  { name: 'mute', action: 'mute', order: ['chat'], required: ['chat'], description: 'Заглушить чат: ты реагируешь только на прямые упоминания.', properties: { chat: CHAT } },
  { name: 'unmute', action: 'unmute', order: ['chat'], required: ['chat'], description: 'Вернуть звук чата.', properties: { chat: CHAT } },
  { name: 'leave', action: 'leave', order: ['chat'], required: ['chat'], description: 'Выйти из группы.', properties: { chat: CHAT } },
]

async function call(tool, args) {
  const list = []
  for (const key of tool.order) {
    const v = args?.[key]
    if (v === undefined || v === null || v === '') continue
    // у списков участников разделитель пробел: раскладываем в отдельные аргументы
    if (tool.spread?.includes(key)) list.push(...String(v).split(/[\s,]+/).filter(Boolean))
    else list.push(String(v))
  }
  const r = await fetch(`${CLAWDS_API}/agent`, { method: 'POST', body: JSON.stringify({ token: CLAWDS_TOKEN, action: tool.action, args: list, files: tool.files && Array.isArray(args?.files) ? args.files.map(String) : [] }) })
  const j = await r.json()
  return j.ok ? { content: [{ type: 'text', text: j.out || 'Готово' }] } : { isError: true, content: [{ type: 'text', text: 'Ошибка: ' + j.error }] }
}

// Упрощённый режим: слабым моделям отдаём только основные инструменты
const LITE_TOOLS = ['send', 'history', 'whoami', 'bots']
const visible = () => (process.env.CLAWDS_LITE ? TOOLS.filter((t) => LITE_TOOLS.includes(t.name)) : TOOLS)

const send = (o) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...o }) + '\n')

createInterface({ input: process.stdin }).on('line', async (line) => {
  let m
  try { m = JSON.parse(line) } catch { return }
  const { id, method, params } = m
  if (method === 'initialize') {
    send({ id, result: { protocolVersion: params?.protocolVersion ?? '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'clawds', version: '1.0.0' } } })
  } else if (method === 'tools/list') {
    send({ id, result: { tools: visible().map((t) => ({ name: t.name, description: t.description, inputSchema: { type: 'object', properties: t.properties, required: t.required } })) } })
  } else if (method === 'tools/call') {
    const tool = visible().find((t) => t.name === params?.name)
    if (!tool) return send({ id, result: { isError: true, content: [{ type: 'text', text: 'Неизвестный инструмент ' + params?.name }] } })
    try { send({ id, result: await call(tool, params.arguments) }) } catch (e) { send({ id, result: { isError: true, content: [{ type: 'text', text: 'Нет связи с сервером Clawds: ' + e.message }] } }) }
  } else if (method === 'ping') {
    send({ id, result: {} })
  } else if (id !== undefined) {
    send({ id, error: { code: -32601, message: 'Метод не поддерживается: ' + method } })
  }
})
