import type { ReactNode } from 'react'
import { Check, Cloud, Laptop, Tag } from 'lucide-react'
import { branchColor } from '../../utils/colors'

interface Group {
  name: string
  local: boolean
  remote: boolean
  tag: boolean
  current: boolean
}

/** Merges "main" and "origin/main" into one badge, like GitKraken. */
function groupRefs(refs: string[], remotes: string[], currentBranch: string | null): Group[] {
  const groups = new Map<string, Group>()
  const headHere = refs.includes('HEAD')
  for (const ref of refs) {
    if (ref === 'HEAD') continue
    const tag = ref.startsWith('tag: ')
    const remote = !tag && remotes.find((r) => ref.startsWith(`${r}/`))
    const name = tag ? ref.slice(5) : remote ? ref.slice(remote.length + 1) : ref
    const key = (tag ? 'tag:' : '') + name
    const group = groups.get(key) ?? { name, local: false, remote: false, tag, current: false }
    if (remote) group.remote = true
    else if (!tag) {
      group.local = true
      group.current = headHere && name === currentBranch
    }
    groups.set(key, group)
  }
  // detached HEAD has no branch badge of its own
  if (headHere && currentBranch === null) groups.set('HEAD', { name: 'HEAD', local: false, remote: false, tag: false, current: true })
  // current branch first, then local branches, remote-only, tags
  const rank = (g: Group): number => (g.current ? 0 : g.local ? 1 : g.remote ? 2 : 3)
  return [...groups.values()].sort((a, b) => rank(a) - rank(b))
}

export function Badge({ color, title, children }: { color: string; title?: string; children: ReactNode }) {
  return (
    <span
      title={title}
      className="flex min-w-0 items-center gap-1 rounded border px-1.5 py-px text-[11px] font-medium"
      style={{ color, borderColor: `${color}66`, backgroundColor: `${color}22` }}
    >
      {children}
    </span>
  )
}

const TAG_COLOR = '#facc15'

function RefBadge({ group: g }: { group: Group }) {
  const color = g.tag ? TAG_COLOR : g.name === 'HEAD' && !g.local ? '#fbbf24' : branchColor(g.name)
  return (
    <Badge color={color}>
      {g.current && <Check size={11} className="shrink-0" />}
      {g.tag && <Tag size={11} className="shrink-0" />}
      <span className="truncate">{g.name}</span>
      {g.local && !g.current && <Laptop size={11} className="shrink-0 opacity-70" />}
      {g.remote && <Cloud size={11} className="shrink-0 opacity-70" />}
    </Badge>
  )
}

/** First branch (or tag) badge, plus the first tag when the commit has both, then "+N" for the rest. */
export function RefBadges({ refs, remotes, currentBranch }: { refs: string[]; remotes: string[]; currentBranch: string | null }) {
  const groups = groupRefs(refs, remotes, currentBranch)
  if (groups.length === 0) return null
  const first = groups[0]
  const tag = first.tag ? undefined : groups.find((g) => g.tag)
  const more = groups.length - (tag ? 2 : 1)
  return (
    <div className="flex min-w-0 items-center gap-1" title={refs.filter((r) => r !== 'HEAD').join('\n')}>
      <RefBadge group={first} />
      {tag && <RefBadge group={tag} />}
      {more > 0 && <span className="shrink-0 text-[10px] text-muted">+{more}</span>}
    </div>
  )
}
