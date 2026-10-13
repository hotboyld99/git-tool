import { closeDialog, type Dialog } from '../../stores/ui.store'
import { Modal } from './Modal'

export function ConfirmationDialog({ dialog }: { dialog: Extract<Dialog, { type: 'confirm' }> }) {
  return (
    <Modal
      title={dialog.title}
      confirmLabel={dialog.confirmLabel}
      danger={dialog.danger}
      onConfirm={() => {
        closeDialog()
        dialog.onConfirm()
      }}
    >
      <p className="leading-relaxed text-muted">{dialog.message}</p>
    </Modal>
  )
}
