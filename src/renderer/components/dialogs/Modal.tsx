import { useEffect, type FormEvent, type ReactNode } from 'react'
import { closeDialog } from '../../stores/ui.store'
import { Button } from '../common/Button'

interface Props {
  title: string
  children: ReactNode
  confirmLabel: string
  danger?: boolean
  disabled?: boolean
  /** button focused on open; form dialogs leave it unset and focus their first input */
  initialFocus?: 'confirm' | 'cancel'
  wide?: boolean
  onConfirm: () => void
}

/** Modal form: Enter submits, Escape / Cancel closes. */
export function Modal({ title, children, confirmLabel, danger, disabled, initialFocus, wide, onConfirm }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeDialog()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    if (!disabled) onConfirm()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 pt-[15vh]" onMouseDown={closeDialog}>
      <form onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} className={`${wide ? 'w-180' : 'w-110'} max-w-[90vw] rounded-lg border border-line bg-raised shadow-2xl`}>
        <div className="border-b border-line px-4 py-3 text-[13px] font-semibold">{title}</div>
        <div className="space-y-3 px-4 py-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <Button type="button" onClick={closeDialog} autoFocus={initialFocus === 'cancel'}>
            Cancel
          </Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={disabled} autoFocus={initialFocus === 'confirm'}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  )
}

export const inputClass = 'w-full rounded border border-line bg-bg px-2 py-1.5 outline-none placeholder:text-faint focus:border-accent'
