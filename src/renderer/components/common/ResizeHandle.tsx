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
  return <div onMouseDown={onMouseDown} className="w-px shrink-0 cursor-col-resize bg-line outline-2 outline-transparent hover:bg-accent hover:outline-accent/40" />
}
