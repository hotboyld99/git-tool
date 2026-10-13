import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { DiffHunk } from '../../../shared/types'
import { splitRows } from '../../utils/diff'
import { DiffLine, HunkHeader, LINE_HEIGHT } from './DiffLine'

export function SplitDiff({ hunks, language }: { hunks: DiffHunk[]; language: string | null }) {
  const rows = useMemo(() => splitRows(hunks), [hunks])
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => LINE_HEIGHT, overscan: 30 })

  return (
    <div ref={scrollRef} className="selectable h-full overflow-y-auto font-mono text-[12px] leading-5">
      <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          return (
            <div key={item.index} className="absolute right-0 left-0" style={{ height: LINE_HEIGHT, transform: `translateY(${item.start}px)` }}>
              {row.kind === 'hunk' ? (
                <HunkHeader header={row.header} />
              ) : (
                <div className="grid h-full grid-cols-2">
                  <div className="overflow-hidden border-r border-line">
                    <DiffLine line={row.left} language={language} numbers="old" />
                  </div>
                  <div className="overflow-hidden">
                    <DiffLine line={row.right} language={language} numbers="new" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
