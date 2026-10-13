import type { ChangedFile, FileStatusKind } from '../../shared/types'

const KINDS: Record<string, FileStatusKind> = { A: 'added', C: 'added', D: 'deleted', M: 'modified', T: 'modified', R: 'renamed', U: 'conflicted' }

/** `git show -m --first-parent` diffs merges against their first parent and root commits against the empty tree. */
export function commitFilesArgs(hash: string): string[] {
  return ['show', '--format=', '--name-status', '-z', '-M', '-m', '--first-parent', hash]
}

/** Parses `--name-status -z`: "M\0path\0" or "R100\0old\0new\0". */
export function parseNameStatus(output: string): ChangedFile[] {
  const tokens = output.split('\0')
  const files: ChangedFile[] = []
  for (let i = 0; i < tokens.length; i++) {
    const code = tokens[i].replace(/^\n/, '')
    if (!code) continue
    const status = KINDS[code[0]] ?? 'modified'
    if (code[0] === 'R' || code[0] === 'C') {
      files.push({ originalPath: tokens[i + 1], path: tokens[i + 2], status })
      i += 2
    } else {
      files.push({ path: tokens[++i], status })
    }
  }
  return files
}
