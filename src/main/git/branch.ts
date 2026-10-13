import type { GitBranch, GitTag } from '../../shared/types'

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

const TAG_FIELDS = ['%(refname:short)', '%(objectname)', '%(*objectname)', '%(contents:subject)']
export const TAG_ARGS = ['for-each-ref', '--sort=-creatordate', `--format=${TAG_FIELDS.join('%00')}`, 'refs/tags']

/** Parses TAG_ARGS output; annotated tags point at a tag object, `*objectname` is the commit. */
export function parseTags(output: string): GitTag[] {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, object, peeled, message] = line.split('\0')
      return { name, hash: peeled || object, message: peeled ? message || undefined : undefined }
    })
}
