import type { ComponentType, MouseEvent, ReactNode } from 'react'
import type { ChangedFile } from '../../../shared/types'
import { splitPath } from '../../utils/format'
import { FileStatusBadge } from '../common/FileStatusBadge'

export interface RowAction<F> {
  icon: ComponentType<{ size?: number }>
  title: string
  onClick: (file: F) => void
  danger?: boolean
}

interface Props<F extends ChangedFile> {
  title: string
  files: F[]
  tone?: 'danger'
  headerAction?: ReactNode
  actions?: RowAction<F>[]
  isSelected: (file: F) => boolean
  onSelect: (file: F) => void
  onOpen?: (file: F) => void
  onContextMenu?: (e: MouseEvent, file: F) => void
}

export function FileChangeList<F extends ChangedFile>({ title, files, tone, headerAction, actions = [], isSelected, onSelect, onOpen, onContextMenu }: Props<F>) {
  return (
    <section>
      <div className="sticky top-0 z-10 flex h-7 items-center gap-2 border-b border-line bg-panel px-3">
        <span className={`text-[10px] font-semibold tracking-wider uppercase ${tone === 'danger' ? 'text-danger' : 'text-faint'}`}>
          {title} ({files.length})
        </span>
        <span className="ml-auto">{headerAction}</span>
      </div>
      {files.map((file) => {
        const { dir, name } = splitPath(file.path)
        return (
          <div
            key={file.path}
            title={file.originalPath ? `${file.originalPath} → ${file.path}` : file.path}
            onClick={() => onSelect(file)}
            onDoubleClick={() => onOpen?.(file)}
            onContextMenu={(e) => onContextMenu?.(e, file)}
            className={`group flex h-6 items-center gap-2 px-3 ${isSelected(file) ? 'bg-accent/25' : 'hover:bg-hover'}`}
          >
            <FileStatusBadge status={file.status} />
            <span className="min-w-0 flex-1 truncate">
              {name}
              {dir && <span className="ml-1.5 text-faint">{dir}</span>}
            </span>
            {actions.map(({ icon: Icon, title: label, onClick, danger }) => (
              <button
                key={label}
                title={label}
                className={`hidden rounded p-0.5 group-hover:block hover:bg-raised ${danger ? 'text-danger' : 'text-muted hover:text-fg'}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onClick(file)
                }}
              >
                <Icon size={13} />
              </button>
            ))}
          </div>
        )
      })}
    </section>
  )
}
