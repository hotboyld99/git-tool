import { memo } from 'react'
import type { DiffLine as Line } from '../../../shared/types'
import { highlightLine } from '../../utils/highlight'

export const LINE_HEIGHT = 20

const BG: Record<Line['type'], string> = {
  add: 'bg-[#2ea04326]',
  del: 'bg-[#f8514926]',
  context: '',
  meta: 'text-faint italic'
}
const SIGN: Record<Line['type'], string> = { add: '+', del: '-', context: ' ', meta: '' }

function Gutter({ value }: { value?: number }) {
  return <span className="w-11 shrink-0 pr-2 text-right text-faint select-none">{value ?? ''}</span>
}

/** One code line; `numbers` selects which line-number gutters are shown. */
export const DiffLine = memo(function DiffLine({ line, language, numbers }: { line?: Line; language: string | null; numbers: 'both' | 'old' | 'new' }) {
  if (!line) return <div className="h-full bg-[#ffffff05]" />
  return (
    <div className={`flex h-full whitespace-pre ${BG[line.type]}`}>
      {numbers !== 'new' && <Gutter value={line.oldNo} />}
      {numbers !== 'old' && <Gutter value={line.newNo} />}
      <span className="w-4 shrink-0 text-faint select-none">{SIGN[line.type]}</span>
      {line.type === 'meta' ? <span>{line.content}</span> : <span dangerouslySetInnerHTML={{ __html: highlightLine(line.content, language) }} />}
    </div>
  )
})

export function HunkHeader({ header }: { header: string }) {
  return <div className="flex h-full items-center bg-accent/10 px-3 whitespace-pre text-muted">{header}</div>
}
