import type { BlameCommit, FileBlame } from '../../shared/types'

export function blameArgs(path: string, hash: string | null): string[] {
  return ['blame', '--porcelain', ...(hash ? [hash] : []), '--', path]
}

/**
 * Parses `git blame --porcelain`: each line starts with "<hash> <orig> <final> [count]", commit headers
 * (author, author-time, summary...) follow only the first time a commit appears, then "\t<content>".
 */
export function parseBlame(output: string): FileBlame {
  const blame: FileBlame = { lines: [], commits: {} }
  let current: BlameCommit | null = null
  let line = 0

  for (const row of output.split('\n')) {
    if (row.startsWith('\t')) {
      if (current) blame.lines.push({ hash: current.hash, line, content: row.slice(1) })
      continue
    }
    const head = /^([0-9a-f]{40,64}) \d+ (\d+)/.exec(row)
    if (head) {
      line = Number(head[2])
      current = blame.commits[head[1]] ??= { hash: head[1], author: '', date: '', summary: '' }
      continue
    }
    if (!current) continue
    const space = row.indexOf(' ')
    const key = row.slice(0, space)
    const value = row.slice(space + 1)
    if (key === 'author') current.author = value
    else if (key === 'author-time') current.date = new Date(Number(value) * 1000).toISOString()
    else if (key === 'summary') current.summary = value
  }
  return blame
}
