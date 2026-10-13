import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { DiffHunk } from '../../../shared/types'
import { unifiedRows } from '../../utils/diff'
import { DiffLine, HunkHeader, LINE_HEIGHT } from './DiffLine'

export function UnifiedDiff({ hunks, language }: { hunks: DiffHunk[]; language: string | null }) {
  const rows = useMemo(() => unifiedRows(hunks), [hunks])
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => LINE_HEIGHT, overscan: 30 })

  return (
    <div ref={scrollRef} className="selectable h-full overflow-auto font-mono text-[12px] leading-5">
      <div className="relative min-w-max" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          return (
            <div key={item.index} className="absolute right-0 left-0" style={{ height: LINE_HEIGHT, transform: `translateY(${item.start}px)` }}>
              {row.kind === 'hunk' ? <HunkHeader header={row.header} /> : <DiffLine line={row.line} language={language} numbers="both" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
