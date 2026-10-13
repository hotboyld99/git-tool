import { useState, type ComponentType, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export function SidebarSection({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="mb-2">
      <button
        className="flex w-full items-center gap-1 px-2 py-1 text-[10px] font-semibold tracking-wider text-faint uppercase hover:text-muted"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
        {count !== undefined && <span className="ml-auto font-normal">{count}</span>}
      </button>
      {open && children}
    </section>
  )
}

interface ItemProps {
  icon: ComponentType<{ size?: number; className?: string; style?: CSSProperties }>
  label: ReactNode
  title?: string
  color?: string
  active?: boolean
  bold?: boolean
  indent?: number
  right?: ReactNode
  onClick?: () => void
  onDoubleClick?: () => void
  onContextMenu?: (e: MouseEvent) => void
}

export function SidebarItem({ icon: Icon, label, title, color, active, bold, indent = 0, right, onClick, onDoubleClick, onContextMenu }: ItemProps) {
  return (
    <div
      title={title}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      style={{ paddingLeft: 20 + indent * 12 }}
      className={`flex h-6 items-center gap-1.5 pr-2 ${active ? 'bg-accent/20 text-fg' : 'hover:bg-hover'} ${bold ? 'font-semibold' : ''}`}
    >
      <Icon size={13} className="shrink-0" style={color ? { color } : undefined} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {right}
    </div>
  )
}
