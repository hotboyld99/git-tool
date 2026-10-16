import type { MouseEvent } from 'react'

interface Props {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  /** true when the resized panel is on the right of the handle */
  invert?: boolean
}

export function ResizeHandle({ value, min, max, onChange, invert }: Props) {
  const onMouseDown = (e: MouseEvent): void => {
    e.preventDefault()
    const startX = e.clientX
    const move = (ev: globalThis.MouseEvent): void => {
      const delta = invert ? startX - ev.clientX : ev.clientX - startX
      onChange(Math.min(max, Math.max(min, value + delta)))
    }
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    document.body.style.cursor = 'col-resize'
  }
  // the visible line is 1px; the invisible child widens the grab area to 9px
  return (
    <div className="group relative z-10 w-px shrink-0 bg-line hover:bg-accent">
      <div onMouseDown={onMouseDown} className="absolute inset-y-0 -right-1 -left-1 cursor-col-resize group-hover:bg-accent/30" />
    </div>
  )
}
