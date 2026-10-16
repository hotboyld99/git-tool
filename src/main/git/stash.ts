import type { GitStash } from '../../shared/types'

export const STASH_LIST_ARGS = ['stash', 'list', '-z', '--format=%gd%x00%H%x00%P%x00%gs']

/** Parses STASH_LIST_ARGS output; subjects look like "On main: msg" or "WIP on main: abc123 msg". */
export function parseStashes(output: string): GitStash[] {
  const tokens = output.split('\0')
  const stashes: GitStash[] = []
  for (let i = 0; i + 4 <= tokens.length; i += 4) {
    const ref = tokens[i].replace(/^\n/, '')
    if (!ref) continue
    const subject = tokens[i + 3]
    const m = /^(?:WIP on|On) ([^:]+): (.*)$/s.exec(subject)
    stashes.push({
      index: Number(/\{(\d+)\}/.exec(ref)?.[1] ?? stashes.length),
      ref,
      hash: tokens[i + 1],
      base: tokens[i + 2].split(' ')[0],
      branch: m?.[1] ?? '',
      message: m?.[2] ?? subject
    })
  }
  return stashes
}
