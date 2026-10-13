import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { setUi, useUi } from '../../stores/ui.store'
import { errorSummary } from '../../utils/format'

const LABELS: Record<string, string> = { openDialog: 'Open repository', open: 'Open repository', session: 'Restore session' }

/** "stashPop" -> "Stash pop" */
function label(operation: string): string {
  const text = LABELS[operation] ?? operation.replace(/([A-Z])/g, ' $1').toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function ErrorToast() {
  const error = useUi((s) => s.error)
  const [details, setDetails] = useState(false)
  if (!error) return null
  const close = (): void => {
    setUi({ error: null })
    setDetails(false)
  }
  return (
    <div className="fixed right-4 bottom-10 z-40 w-110 rounded-md border border-danger/40 bg-raised shadow-2xl">
      <div className="flex items-start gap-2 p-3">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{label(error.operation)} failed</div>
          <div className="selectable mt-1 wrap-break-word text-muted">{errorSummary(error.stderr) || `Git exited with code ${error.exitCode}.`}</div>
          <button className="mt-2 text-accent hover:underline" onClick={() => setDetails(!details)}>
            {details ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
        <button className="rounded p-0.5 text-muted hover:bg-hover hover:text-fg" onClick={close}>
          <X size={14} />
        </button>
      </div>
      {details && (
        <pre className="selectable max-h-64 overflow-auto border-t border-line p-3 font-mono text-[11px] whitespace-pre-wrap text-muted">
          {[error.command && `$ ${error.command}`, error.stderr.trim(), error.stdout.trim()].filter(Boolean).join('\n\n')}
        </pre>
      )}
    </div>
  )
}
