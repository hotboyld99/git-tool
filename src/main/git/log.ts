import type { GitCommit, LogOptions } from '../../shared/types'

// Fields are NUL separated and `-z` NUL-terminates each record, so every record is exactly
// FIELD_COUNT tokens. Commit messages cannot contain NUL, which makes this unambiguous.
const FORMAT = ['%H', '%h', '%P', '%an', '%ae', '%aI', '%s', '%b', '%D'].join('%x00')
const FIELD_COUNT = 9

export function logArgs({ skip, limit, search, author, ref }: LogOptions): string[] {
  const args = ['log', ...(ref ? [ref] : ['--exclude=refs/stash', '--all']), '--date-order', '-z', `--format=${FORMAT}`]
  // -F: search text is a literal, not a regex; -i applies to both --grep and --author
  if (search || author) args.push('-i', '-F')
  if (search) args.push(`--grep=${search}`)
  if (author) args.push(`--author=${author}`)
  // trailing "--" so a ref is never mistaken for a path
  return [...args, `--skip=${skip}`, `-n${limit}`, '--']
}

/** Single commit lookup (search by hash). */
export function showArgs(rev: string): string[] {
  return ['log', '-1', '-z', `--format=${FORMAT}`, rev, '--']
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
