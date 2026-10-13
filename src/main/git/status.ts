import type { FileStatusKind, GitStatus } from '../../shared/types'

export const STATUS_ARGS = ['status', '--porcelain=v2', '-z', '--branch', '--untracked-files=all']

function kind(code: string): FileStatusKind {
  switch (code) {
    case 'A':
    case 'C':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    default:
      return 'modified'
  }
}

/** Splits `line` into `count` space separated fields; the last one keeps its spaces (paths). */
function fields(line: string, count: number): string[] {
  const parts = line.split(' ')
  return [...parts.slice(0, count - 1), parts.slice(count - 1).join(' ')]
}

/** Parses `git status --porcelain=v2 -z --branch`. */
export function parseStatus(output: string): GitStatus {
  const status: GitStatus = {
    branch: null,
    head: '',
    ahead: 0,
    behind: 0,
    stagedFiles: [],
    unstagedFiles: [],
    conflictedFiles: [],
    operation: null
  }
  const entries = output.split('\0')

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (!entry) continue
    const type = entry[0]

    if (type === '#') {
      const [, key, ...rest] = entry.split(' ')
      const value = rest.join(' ')
      if (key === 'branch.oid') status.head = value === '(initial)' ? '' : value
      else if (key === 'branch.head') status.branch = value === '(detached)' ? null : value
      else if (key === 'branch.upstream') status.upstream = value
      else if (key === 'branch.ab') {
        const m = /^\+(\d+) -(\d+)$/.exec(value)
        if (m) [status.ahead, status.behind] = [Number(m[1]), Number(m[2])]
      }
    } else if (type === '1' || type === '2') {
      const f = fields(entry, type === '1' ? 9 : 10)
      const [x, y] = f[1]
      const path = f[f.length - 1]
      // renamed/copied entries are followed by the original path as a separate NUL entry
      const originalPath = type === '2' ? entries[++i] : undefined
      if (x !== '.') status.stagedFiles.push({ path, originalPath, status: kind(x), staged: true })
      if (y !== '.') status.unstagedFiles.push({ path, status: kind(y), staged: false })
    } else if (type === 'u') {
      status.conflictedFiles.push({ path: fields(entry, 11)[10], status: 'conflicted', staged: false })
    } else if (type === '?') {
      status.unstagedFiles.push({ path: entry.slice(2), status: 'untracked', staged: false })
    }
  }
  return status
}
