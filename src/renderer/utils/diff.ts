import type { DiffHunk, DiffLine } from '../../shared/types'

export type UnifiedRow = { kind: 'hunk'; header: string } | { kind: 'line'; line: DiffLine }
export type SplitRow = { kind: 'hunk'; header: string } | { kind: 'pair'; left?: DiffLine; right?: DiffLine }

export function unifiedRows(hunks: DiffHunk[]): UnifiedRow[] {
  return hunks.flatMap((h) => [{ kind: 'hunk' as const, header: h.header }, ...h.lines.map((line) => ({ kind: 'line' as const, line }))])
}

/** Pairs each run of deletions with the following run of additions, side by side. */
export function splitRows(hunks: DiffHunk[]): SplitRow[] {
  const rows: SplitRow[] = []
  for (const hunk of hunks) {
    rows.push({ kind: 'hunk', header: hunk.header })
    let dels: DiffLine[] = []
    let adds: DiffLine[] = []
    const flush = (): void => {
      for (let i = 0; i < Math.max(dels.length, adds.length); i++) rows.push({ kind: 'pair', left: dels[i], right: adds[i] })
      dels = []
      adds = []
    }
    for (const line of hunk.lines) {
      if (line.type === 'del') {
        if (adds.length) flush()
        dels.push(line)
      } else if (line.type === 'add') adds.push(line)
      else {
        flush()
        rows.push({ kind: 'pair', left: line, right: line })
      }
    }
    flush()
  }
  return rows
}
