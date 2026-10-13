import type { GitSubmodule, GitWorktree, LfsInfo } from '../../shared/types'

/** Parses `git worktree list --porcelain` (blank-line separated blocks, first block = main worktree). */
export function parseWorktrees(output: string): GitWorktree[] {
  return output
    .split(/\n\n+/)
    .filter((block) => block.startsWith('worktree '))
    .map((block, index) => {
      const lines = block.split('\n')
      const value = (key: string): string | undefined => lines.find((l) => l === key || l.startsWith(`${key} `))?.slice(key.length + 1)
      const branch = value('branch')
      return {
        path: value('worktree') ?? '',
        head: value('HEAD') ?? '',
        branch: branch ? branch.replace(/^refs\/heads\//, '') : null,
        isMain: index === 0,
        locked: lines.some((l) => l === 'locked' || l.startsWith('locked ')),
        prunable: lines.some((l) => l === 'prunable' || l.startsWith('prunable '))
      }
    })
}

const SUBMODULE_STATE: Record<string, GitSubmodule['state']> = { ' ': 'ok', '-': 'uninitialized', '+': 'modified', U: 'conflict' }

/** Parses `git submodule status`: "<state char><sha> <path>[ (describe)]". */
export function parseSubmodules(output: string): GitSubmodule[] {
  return output
    .split('\n')
    .map((line) => /^([ +\-U])([0-9a-f]+) (.+?)(?: \(.*\))?$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ state: SUBMODULE_STATE[m[1]], hash: m[2], path: m[3] }))
}

/** `git lfs track` -> patterns, `git lfs ls-files` -> files ("<oid> * path" downloaded, "<oid> - path" pointer only). */
export function parseLfs(track: string, files: string): Pick<LfsInfo, 'patterns' | 'files'> {
  return {
    patterns: track
      .split('\n')
      .map((l) => /^\s{4}(.+?) \(.+\)$/.exec(l)?.[1])
      .filter((p): p is string => !!p),
    files: files
      .split('\n')
      .map((l) => /^[0-9a-f]+ ([*-]) (.+)$/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => ({ path: m[2], downloaded: m[1] === '*' }))
  }
}
