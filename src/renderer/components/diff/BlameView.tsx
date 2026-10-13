import { useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { FileBlame, RepositoryId } from '../../../shared/types'
import { select } from '../../stores/repository.store'
import { branchColor } from '../../utils/colors'
import { formatDate } from '../../utils/format'
import { highlightLine } from '../../utils/highlight'
import { Spinner } from '../common/Spinner'
import { LINE_HEIGHT } from './DiffLine'

const UNCOMMITTED = /^0+$/

interface Props {
  id: RepositoryId
  path: string
  /** null blames the working tree file */
  hash: string | null
  language: string | null
  /** changes when the working tree changes, to reload */
  version: unknown
}

export function BlameView({ id, path, hash, language, version }: Props) {
  const [blame, setBlame] = useState<FileBlame | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    void window.git.blame(id, path, hash).then((r) => {
      if (cancelled) return
      setBlame(r.ok ? r.data : null)
      setError(r.ok ? null : r.error.stderr.trim() || 'Could not blame this file.')
    })
    return () => {
      cancelled = true
    }
  }, [id, path, hash, version])

  const lines = blame?.lines ?? []
  const virtualizer = useVirtualizer({ count: lines.length, getScrollElement: () => scrollRef.current, estimateSize: () => LINE_HEIGHT, overscan: 30 })

  if (error) return <div className="p-4 text-danger">{error}</div>
  if (!blame) {
    return (
      <div className="flex justify-center p-6 text-muted">
        <Spinner />
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="selectable h-full overflow-auto font-mono text-[12px] leading-5">
      <div className="relative min-w-max" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const line = lines[item.index]
          const commit = blame.commits[line.hash]
          // commit info only on the first line of each run of lines from the same commit
          const first = item.index === 0 || lines[item.index - 1].hash !== line.hash
          const uncommitted = UNCOMMITTED.test(line.hash)
          return (
            <div key={item.index} className="absolute right-0 left-0 flex" style={{ height: LINE_HEIGHT, transform: `translateY(${item.start}px)` }}>
              <div
                className={`flex w-80 shrink-0 items-center gap-2 border-l-2 px-2 font-sans text-[11px] text-muted ${first ? 'border-t border-t-line/60' : ''}`}
                style={{ borderLeftColor: uncommitted ? 'transparent' : branchColor(line.hash) }}
                title={commit ? `${commit.summary}\n${commit.author}, ${formatDate(commit.date)}` : undefined}
              >
                {first &&
                  (uncommitted ? (
                    <span className="text-warn">Not committed yet</span>
                  ) : (
                    <>
                      <button className="font-mono text-accent hover:underline" onClick={() => select(id, { type: 'commit', hash: line.hash })}>
                        {line.hash.slice(0, 7)}
                      </button>
                      <span className="min-w-0 flex-1 truncate">{commit?.summary}</span>
                      <span className="shrink-0 truncate text-faint">{commit?.author}</span>
                      <span className="shrink-0 text-faint">{commit ? formatDate(commit.date).slice(0, 10) : ''}</span>
                    </>
                  ))}
              </div>
              <span className="w-11 shrink-0 pr-2 text-right text-faint select-none">{line.line}</span>
              <span className="whitespace-pre" dangerouslySetInnerHTML={{ __html: highlightLine(line.content, language) }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
