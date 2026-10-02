import type { ReactNode } from 'react'

// Небольшой безопасный Markdown для чата: без HTML, без зависимостей. Упоминания и метки приоритета отдаёт вызывающий.
type Mention = (token: string, key: string) => ReactNode | null

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(~~[^~\n]+~~)|(\*[^*\s][^*\n]*\*)|(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))|((?:\[(?:high|low)\]\s*)?@\w+)|(\/all\b)|(https?:\/\/[^\s<)]+)/g

function inline(text: string, mention: Mention, key: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let n = 0
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0
    if (i > last) out.push(text.slice(last, i))
    const t = m[0]
    const k = `${key}-${n++}`
    if (m[1]) out.push(<code key={k} className="inline">{t.slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong key={k}>{inline(t.slice(2, -2), mention, k)}</strong>)
    else if (m[3]) out.push(<s key={k}>{t.slice(2, -2)}</s>)
    else if (m[4]) out.push(<em key={k}>{inline(t.slice(1, -1), mention, k)}</em>)
    else if (m[5]) {
      const mm = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(t)!
      out.push(<a key={k} href={mm[2]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{mm[1]}</a>)
    } else if (m[6] || m[7]) out.push(mention(t, k) ?? t)
    else if (m[8]) out.push(<a key={k} href={t} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{t}</a>)
    last = i + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const isTableSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l)
const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

export default function Markdown({ text, mention }: { text: string; mention: Mention }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let b = 0
  const key = () => `b${b++}`

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    // блок кода (незакрытый при стриминге тоже показываем как код)
    const fence = /^\s*```(\w*)\s*$/.exec(line)
    if (fence) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++])
      i++
      blocks.push(<pre key={key()} className="md-code"><code>{body.join('\n')}</code></pre>)
      continue
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) { blocks.push(<div key={key()} className={'md-h md-h' + h[1].length}>{inline(h[2], mention, key())}</div>); i++; continue }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { blocks.push(<hr key={key()} className="md-hr" />); i++; continue }

    if (/^\s*>/.test(line)) {
      const q: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''))
      blocks.push(<blockquote key={key()} className="md-quote">{inline(q.join('\n'), mention, key())}</blockquote>)
      continue
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]))
      blocks.push(
        <div key={key()} className="md-table-wrap">
          <table className="md-table">
            <thead><tr>{head.map((c, j) => <th key={j}>{inline(c, mention, key())}</th>)}</tr></thead>
            <tbody>{rows.map((r, j) => <tr key={j}>{r.map((c, k2) => <td key={k2}>{inline(c, mention, key())}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }

    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (li) {
      const ordered = /\d/.test(li[2])
      const items: { depth: number; text: string }[] = []
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i])
        if (!m) break
        items.push({ depth: Math.min(3, Math.floor(m[1].length / 2)), text: m[3] })
        i++
      }
      const Tag = ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag key={key()} className="md-list">
          {items.map((it, j) => <li key={j} style={{ marginLeft: it.depth * 16 }}>{inline(it.text, mention, key())}</li>)}
        </Tag>,
      )
      continue
    }

    // абзац: подряд идущие обычные строки, переносы сохраняются
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^\s*```/.test(lines[i]) && !/^(#{1,4})\s/.test(lines[i]) && !/^\s*>/.test(lines[i]) && !/^(\s*)([-*+]|\d+[.)])\s+/.test(lines[i])) {
      if (lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) break
      para.push(lines[i++])
    }
    blocks.push(<p key={key()} className="md-p">{inline(para.join('\n'), mention, key())}</p>)
  }
  return <>{blocks}</>
}
