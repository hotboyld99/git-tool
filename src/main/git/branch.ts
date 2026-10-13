import type { GitBranch } from '../../shared/types'

const FIELDS = ['%(refname)', '%(refname:short)', '%(objectname)', '%(HEAD)', '%(upstream:short)', '%(upstream:track,nobracket)', '%(symref)']
export const BRANCH_ARGS = ['for-each-ref', `--format=${FIELDS.join('%00')}`, 'refs/heads', 'refs/remotes']

/** Parses `git for-each-ref` output produced with BRANCH_ARGS. */
export function parseBranches(output: string): GitBranch[] {
  const branches: GitBranch[] = []
  for (const line of output.split('\n')) {
    if (!line) continue
    const [ref, name, hash, head, upstream, track, symref] = line.split('\0')
    if (symref) continue // origin/HEAD -> origin/main
    const isRemote = ref.startsWith('refs/remotes/')
    branches.push({
      name,
      hash,
      isRemote,
      remote: isRemote ? ref.slice('refs/remotes/'.length).split('/')[0] : undefined,
      isCurrent: head === '*',
      upstream: upstream || undefined,
      track: track || undefined
    })
  }
  return branches
}
