import type { GitRemote } from '../../shared/types'

/** Parses `git remote -v`: "origin\tgit@host:repo.git (fetch)". */
export function parseRemotes(output: string): GitRemote[] {
  const remotes = new Map<string, GitRemote>()
  for (const line of output.split('\n')) {
    const m = /^(\S+)\t(.+) \((fetch|push)\)$/.exec(line)
    if (!m) continue
    const remote = remotes.get(m[1]) ?? { name: m[1], fetchUrl: '', pushUrl: '' }
    if (m[3] === 'fetch') remote.fetchUrl = m[2]
    else remote.pushUrl = m[2]
    remotes.set(m[1], remote)
  }
  return [...remotes.values()]
}
