import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { setUi, useUi } from '../../stores/ui.store'

export function ContextMenu() {
  const menu = useUi((s) => s.menu)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  // keep the menu inside the window
  useLayoutEffect(() => {
    if (!menu || !ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    setPos({ x: Math.min(menu.x, window.innerWidth - width - 4), y: Math.min(menu.y, window.innerHeight - height - 4) })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const close = (): void => setUi({ menu: null })
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('blur', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  if (!menu) return null
  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-48 rounded-md border border-line bg-raised py-1 shadow-xl"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {menu.items.map((item, i) =>
        item === 'separator' ? (
          <div key={i} className="my-1 border-t border-line" />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            className={`block w-full px-3 py-1.5 text-left hover:bg-accent/25 disabled:opacity-40 disabled:hover:bg-transparent ${item.danger ? 'text-danger' : ''}`}
            onClick={() => {
              setUi({ menu: null })
              item.onClick()
            }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
