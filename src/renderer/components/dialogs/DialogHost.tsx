import { useUi } from '../../stores/ui.store'
import { ConfirmationDialog } from './ConfirmationDialog'
import { CreateBranchDialog } from './CreateBranchDialog'
import { StashDialog } from './StashDialog'
import { CreateTagDialog } from './CreateTagDialog'
import { ResetDialog } from './ResetDialog'
import { RemoteDialog } from './RemoteDialog'
import { SettingsDialog } from './SettingsDialog'

export function DialogHost() {
  const dialog = useUi((s) => s.dialog)
  switch (dialog?.type) {
    case 'confirm':
      return <ConfirmationDialog dialog={dialog} />
    case 'createBranch':
      return <CreateBranchDialog dialog={dialog} />
    case 'stash':
      return <StashDialog dialog={dialog} />
    case 'createTag':
      return <CreateTagDialog dialog={dialog} />
    case 'reset':
      return <ResetDialog dialog={dialog} />
    case 'remote':
      return <RemoteDialog dialog={dialog} />
    case 'settings':
      return <SettingsDialog />
    default:
      return null
  }
}
