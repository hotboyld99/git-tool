import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, ScrollText, X } from 'lucide-react'
import { useOperationLog, type LogEntry } from '../../stores/git.store'
import { setUi, useUi } from '../../stores/ui.store'
import { formatDuration } from '../../utils/format'
import { Spinner } from '../common/Spinner'

const time = (ms: number): string => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function StatusIcon({ entry }: { entry: LogEntry }) {
  if (entry.status === 'running') return <Spinner size={12} />
  return entry.status === 'success' ? <Check size={12} className="text-ok" /> : <X size={12} className="text-danger" />
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-line/50 px-3 py-1">
      <div className="flex items-center gap-2">
        <span className="text-faint">{time(entry.startedAt)}</span>
        <StatusIcon entry={entry} />
        <span className="text-muted">{entry.repoName}</span>
        <span className="truncate">{entry.label}</span>
        <span className="text-faint">
          {entry.status === 'running' ? 'running…' : `${entry.status === 'success' ? 'Completed' : 'Failed'} in ${formatDuration(entry.durationMs ?? 0)}`}
        </span>
        {entry.output && (
          <button className="ml-auto text-accent hover:underline" onClick={() => setOpen(!open)}>
            {open ? 'Hide Git Output' : 'Show Git Output'}
          </button>
        )}
      </div>
      {open && <pre className="selectable mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-muted">{entry.output.replace(/\r(?!\n)/g, '\n')}</pre>}
    </div>
  )
}

export function BottomPanel() {
  const entries = useOperationLog((s) => s.entries)
  const open = useUi((s) => s.logOpen)
  const last = entries[0]
  return (
    <footer className="shrink-0 border-t border-line bg-panel font-mono text-[11px]">
      <button className="flex h-6 w-full items-center gap-2 px-3 text-muted hover:text-fg" onClick={() => setUi({ logOpen: !open })}>
        <ScrollText size={12} />
        <span className="font-sans">Operations</span>
        {last && (
          <span className="flex min-w-0 items-center gap-1.5 text-faint">
            <StatusIcon entry={last} />
            <span className="truncate">{last.label}</span>
          </span>
        )}
        <span className="ml-auto">{open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}</span>
      </button>
      {open && (
        <div className="h-44 overflow-y-auto border-t border-line">
          {entries.length === 0 ? <div className="p-3 text-faint">No operations yet.</div> : entries.map((e) => <LogRow key={e.id} entry={e} />)}
        </div>
      )}
    </footer>
  )
}
