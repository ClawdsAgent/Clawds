import { execFile } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

const run = (cwd, args) =>
  new Promise((res) => {
    execFile('git', args, { cwd, windowsHide: true, timeout: 20000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) =>
      res({ ok: !err, out: String(stdout).trim(), err: String(stderr).trim() }),
    )
  })

// Папка может быть чужим репозиторием: init делаем только если репозитория нет, служебное прячем через info/exclude
export async function ensureRepo(dir) {
  const inside = await run(dir, ['rev-parse', '--is-inside-work-tree'])
  if (!(inside.ok && inside.out === 'true')) await run(dir, ['init', '-b', 'main'])
  const head = await run(dir, ['rev-parse', '--verify', 'HEAD'])
  if (!head.ok) await run(dir, ['-c', 'user.name=Clawds', '-c', 'user.email=clawds@localhost', 'commit', '--allow-empty', '-m', 'Clawds: начало работы'])
  const ex = await run(dir, ['rev-parse', '--git-path', 'info/exclude'])
  if (ex.ok) {
    const p = resolve(dir, ex.out)
    mkdirSync(dirname(p), { recursive: true })
    const cur = existsSync(p) ? readFileSync(p, 'utf8') : ''
    if (!cur.split(/\r?\n/).includes('.clawds/')) writeFileSync(p, cur + (cur && !cur.endsWith('\n') ? '\n' : '') + '.clawds/\n')
  }
}

export async function isGitRepo(dir) {
  const r = await run(dir, ['rev-parse', '--is-inside-work-tree'])
  return r.ok && r.out === 'true'
}

const SKIP = new Set(['.git', '.clawds', 'node_modules', 'bots', 'uploads'])
function tree(dir, depth = 0, budget = { n: 300 }) {
  if (depth > 3) return []
  let names
  try { names = readdirSync(dir) } catch { return [] }
  const out = []
  for (const name of names.sort()) {
    if (SKIP.has(name) || budget.n-- <= 0) continue
    const p = join(dir, name)
    let isDir = false
    try { isDir = statSync(p).isDirectory() } catch { continue }
    out.push(isDir ? { name, type: 'dir', children: tree(p, depth + 1, budget) } : { name, type: 'file' })
  }
  return out
}

export async function workspaceInfo(dir) {
  const [br, log, remote, st] = await Promise.all([
    run(dir, ['branch', '--format=%(refname:short)']),
    run(dir, ['log', '--all', '-n', '15', '--format=%h%x09%s%x09%an%x09%cr%x09%D']),
    run(dir, ['remote', 'get-url', 'origin']),
    run(dir, ['status', '--porcelain']),
  ])
  const commits = log.out
    ? log.out.split('\n').map((l) => {
        const [hash, msg, author, ago, refs] = l.split('\t')
        const branch = (refs || '').split(',').map((s) => s.replace('HEAD -> ', '').trim()).find((s) => s && !s.startsWith('origin/') && s !== 'HEAD') || ''
        return { hash, msg, author, ago, branch }
      })
    : []
  return {
    path: dir,
    remote: remote.ok ? remote.out : '',
    branches: br.out ? br.out.split('\n') : [],
    commits,
    tree: tree(dir),
    dirty: st.out ? st.out.split('\n').length : 0,
  }
}

export async function setRemote(dir, url) {
  const has = await run(dir, ['remote', 'get-url', 'origin'])
  return run(dir, has.ok ? ['remote', 'set-url', 'origin', url] : ['remote', 'add', 'origin', url])
}

// Отдельная рабочая копия бота, чтобы боты не переключали ветки друг у друга под ногами
export async function ensureWorktree(repo, path, branch) {
  if (existsSync(join(path, '.git'))) return true
  const r = await run(repo, ['worktree', 'add', '-b', branch, path, 'HEAD'])
  if (r.ok) return true
  return (await run(repo, ['worktree', 'add', path, branch])).ok
}

export async function removeWorktree(repo, path) {
  await run(repo, ['worktree', 'remove', '--force', path])
  await run(repo, ['worktree', 'prune'])
}

// Удаляет только ветки, подходящие под предикат (служебные ветки сессии), и никогда не текущую
export async function deleteBranches(repo, pred) {
  const cur = (await run(repo, ['branch', '--show-current'])).out
  const list = (await run(repo, ['branch', '--format=%(refname:short)'])).out.split('\n').filter(Boolean)
  for (const b of list) if (b !== cur && pred(b)) await run(repo, ['branch', '-D', b])
}
