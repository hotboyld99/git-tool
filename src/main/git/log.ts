import type { GitCommit } from '../../shared/types'

// Fields are NUL separated and `-z` NUL-terminates each record, so every record is exactly
// FIELD_COUNT tokens. Commit messages cannot contain NUL, which makes this unambiguous.
const FORMAT = ['%H', '%h', '%P', '%an', '%ae', '%aI', '%s', '%b', '%D'].join('%x00')
const FIELD_COUNT = 9

export function logArgs(skip: number, limit: number): string[] {
  return ['log', '--exclude=refs/stash', '--all', '--date-order', '-z', `--format=${FORMAT}`, `--skip=${skip}`, `-n${limit}`]
}

/** "HEAD -> main, origin/main, origin/HEAD, tag: v1" -> ["HEAD", "main", "origin/main", "tag: v1"] */
export function parseRefs(decoration: string): string[] {
  const refs: string[] = []
  for (const part of decoration.split(', ')) {
    if (!part || part.endsWith('/HEAD')) continue
    if (part.startsWith('HEAD -> ')) refs.push('HEAD', part.slice(8))
    else refs.push(part)
  }
  return refs
}

export function parseLog(output: string): GitCommit[] {
  const tokens = output.split('\0')
  const commits: GitCommit[] = []
  for (let i = 0; i + FIELD_COUNT <= tokens.length; i += FIELD_COUNT) {
    const [hash, shortHash, parents, authorName, authorEmail, date, subject, body, refs] = tokens.slice(i, i + FIELD_COUNT)
    // records after the first start with the newline git puts between commits
    const h = hash.replace(/^\n/, '')
    if (!h) continue
    commits.push({
      hash: h,
      shortHash,
      parents: parents ? parents.split(' ') : [],
      authorName,
      authorEmail,
      date,
      subject,
      body: body.trim() || undefined,
      refs: parseRefs(refs)
    })
  }
  return commits
}
