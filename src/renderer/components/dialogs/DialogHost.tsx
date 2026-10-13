import { useUi } from '../../stores/ui.store'
import { ConfirmationDialog } from './ConfirmationDialog'
import { CreateBranchDialog } from './CreateBranchDialog'
import { StashDialog } from './StashDialog'

export function DialogHost() {
  const dialog = useUi((s) => s.dialog)
  switch (dialog?.type) {
    case 'confirm':
      return <ConfirmationDialog dialog={dialog} />
    case 'createBranch':
      return <CreateBranchDialog dialog={dialog} />
    case 'stash':
      return <StashDialog dialog={dialog} />
    default:
      return null
  }
}
