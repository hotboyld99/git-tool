import type { DiffHunk, FileDiff } from '../../shared/types'

/** Parses the unified diff of a single file. */
export function parseDiff(raw: string): FileDiff {
  const hunks: DiffHunk[] = []
  let binary = false
  let hunk: DiffHunk | null = null
  let oldNo = 0
  let newNo = 0

  for (const line of raw.split('\n')) {
    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (header) {
      hunk = { header: line, lines: [] }
      hunks.push(hunk)
      oldNo = Number(header[1])
      newNo = Number(header[2])
      continue
    }
    if (!hunk) {
      if (line.startsWith('Binary files ') || line === 'GIT binary patch') binary = true
      continue
    }
    const sign = line[0]
    const content = line.slice(1)
    if (sign === '+') hunk.lines.push({ type: 'add', newNo: newNo++, content })
    else if (sign === '-') hunk.lines.push({ type: 'del', oldNo: oldNo++, content })
    else if (sign === ' ') hunk.lines.push({ type: 'context', oldNo: oldNo++, newNo: newNo++, content })
    else if (sign === '\\') hunk.lines.push({ type: 'meta', content: line })
    else if (line.startsWith('diff --git')) hunk = null // next file (should not happen for single-file diffs)
  }
  return { raw, binary, hunks }
}
