import type { FileStatusKind } from '../../../shared/types'

const BADGES: Record<FileStatusKind, { letter: string; className: string }> = {
  modified: { letter: 'M', className: 'text-warn' },
  added: { letter: 'A', className: 'text-ok' },
  deleted: { letter: 'D', className: 'text-danger' },
  renamed: { letter: 'R', className: 'text-accent' },
  untracked: { letter: '?', className: 'text-ok' },
  conflicted: { letter: '!', className: 'text-danger' }
}

export function FileStatusBadge({ status }: { status: FileStatusKind }) {
  const { letter, className } = BADGES[status]
  return (
    <span title={status} className={`w-3 shrink-0 text-center font-mono font-bold ${className}`}>
      {letter}
    </span>
  )
}
